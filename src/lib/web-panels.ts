// Pinned web panels: a few pages (a local dashboard, a CI page) the person
// keeps one click away in the sidebar. Renderer-only data — no bot sees it,
// no server stores it. Only plain http(s) pages without credentials are
// accepted, because the URL is framed in the app and handed to the browser.

export interface WebPanel {
  id: string;
  name: string;
  url: string;
}

export const MAX_WEB_PANELS = 6;
export const MAX_WEB_PANEL_NAME = 40;

export type WebPanelInput = { name: string; url: string };
export type WebPanelCheck =
  | { ok: true; name: string; url: string }
  | { ok: false; error: "name" | "url" | "self" };

/** A trimmed name of 1–40 characters and an absolute http(s) URL with no
 * user name or password in it, never on `appOrigin`. */
export function validateWebPanel(input: WebPanelInput, appOrigin?: string): WebPanelCheck {
  const name = input.name.trim();
  if (!name || name.length > MAX_WEB_PANEL_NAME) return { ok: false, error: "name" };
  let parsed: URL;
  try {
    parsed = new URL(input.url.trim());
  } catch {
    return { ok: false, error: "url" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return { ok: false, error: "url" };
  if (parsed.username || parsed.password || !parsed.hostname) return { ok: false, error: "url" };
  if (appOrigin && isAppOrigin(parsed.href, appOrigin)) return { ok: false, error: "self" };
  return { ok: true, name, url: parsed.href };
}

/** Security: the frame keeps its page's origin (allow-same-origin), so a page on the app's own origin would run with
 * the app's own access. Such a page is never framed. */
export function isAppOrigin(url: string, appOrigin: string): boolean {
  try {
    return new URL(url).origin === appOrigin;
  } catch {
    return false;
  }
}

const LOCAL_V6 = /^(?:f[cd][0-9a-f]{2}|fe[89ab][0-9a-f]):/;

/** A page this computer or its local network serves. The server's framing check answers only when the page did, so a
 * local page that did not answer is one this computer really cannot show — the page a panel would leave blank. */
export function isLocalPageUrl(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, "");
  } catch {
    return false;
  }
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) return true;
  if (hostname === "::1" || hostname === "0:0:0:0:0:0:0:1" || LOCAL_V6.test(hostname)) return true;
  const parts = hostname.split(".").map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : Number.NaN));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part > 255)) return false;
  const [first, second] = parts;
  return first === 10 || first === 127 || (first === 169 && second === 254) || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}

/** The stored list, keeping only entries that still validate, at most six.
 * Never throws: a corrupt value reads as no panels. */
export function parseWebPanels(raw: string | null | undefined): WebPanel[] {
  if (!raw) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  const panels: WebPanel[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (panels.length >= MAX_WEB_PANELS) break;
    if (!entry || typeof entry !== "object") continue;
    const { id, name, url } = entry as Record<string, unknown>;
    if (typeof id !== "string" || !id || seen.has(id) || typeof name !== "string" || typeof url !== "string") continue;
    const check = validateWebPanel({ name, url });
    if (!check.ok) continue;
    seen.add(id);
    panels.push({ id, name: check.name, url: check.url });
  }
  return panels;
}

export function newWebPanelId(existing: readonly WebPanel[]): string {
  let n = existing.length + 1;
  const taken = new Set(existing.map((panel) => panel.id));
  while (taken.has(`panel-${n}`)) n++;
  return `panel-${n}`;
}
