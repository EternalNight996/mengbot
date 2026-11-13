import type { CnAppCard } from "./apps-cn.ts";

/**
 * The China edition's app library is maintained in the market, not in the bundle: the unified API publishes the
 * catalog at `/api/v1/market/catalog?type=apps` (each entry naming its static detail page), and every desktop client
 * reads that so new apps appear — and a removed one disappears — without a client release. The bundled catalog stays
 * as the offline fallback.
 */
const DEFAULT_MARKET_BASE = "https://market.mengbot.com.cn";
const DEFAULT_MARKET_API = "https://api.mengbot.com.cn";
export const MARKET_APPS_PATH = "/api/v1/market/items?type=apps&pageSize=100&region=cn";

const MAX_APPS = 200;
const MAX_APPS_BYTES = 512 * 1024;
const CACHE_TTL_MS = 10 * 60_000;
const FETCH_TIMEOUT_MS = 8_000;

type Fetcher = typeof fetch;

export function marketBaseUrl(environment: NodeJS.ProcessEnv = process.env): string {
  return (environment.OMB_MARKET_BASE?.trim() || DEFAULT_MARKET_BASE).replace(/\/+$/, "");
}

/** Where the catalog lives: the unified API, unless a build points somewhere else. */
export function marketApiBase(environment: NodeJS.ProcessEnv = process.env): string {
  return (environment.OMB_MARKET_API_BASE?.trim() || DEFAULT_MARKET_API).replace(/\/+$/, "");
}

export function marketAppsUrl(environment: NodeJS.ProcessEnv = process.env): string {
  return `${marketApiBase(environment)}${MARKET_APPS_PATH}`;
}

/** The API's catalog shape (`{ items: [...] }`), mapped to the panel's card shape. */
export function parseMarketApiApps(value: unknown): CnAppCard[] {
  const items = value && typeof value === "object" && !Array.isArray(value) ? (value as { items?: unknown }).items : null;
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_APPS) throw new Error("The market app catalog is invalid");
  const slugs = new Set<string>();
  return items.map((raw, index): CnAppCard => {
    const field = `apps[${index}]`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`${field} is invalid`);
    const record = raw as Record<string, unknown>;
    const slug = cardText(record.id, `${field}.id`, 80);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug) || slugs.has(slug)) throw new Error(`${field}.id is invalid`);
    slugs.add(slug);
    const categories = Array.isArray(record.tags)
      ? record.tags.map((item, itemIndex) => cardText(item, `${field}.tags[${itemIndex}]`, 40))
      : [];
    return { slug, label: cardText(record.title, `${field}.title`, 120), blurb: cardText(record.summary, `${field}.summary`, 240), logo: null, domain: null, categories, region: "cn" };
  });
}

const cardText = (value: unknown, field: string, max: number): string => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  const normalized = value.trim();
  if (normalized.length > max) throw new Error(`${field} is too long`);
  return normalized;
};

/** Validate the remotely maintained catalog before any of it reaches the panel. */
export function parseMarketApps(value: unknown): CnAppCard[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_APPS) {
    throw new Error("The market app catalog is invalid");
  }
  const slugs = new Set<string>();
  return value.map((raw, index): CnAppCard => {
    const field = `apps[${index}]`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`${field} is invalid`);
    const record = raw as Record<string, unknown>;
    const slug = cardText(record.slug, `${field}.slug`, 80);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug) || slugs.has(slug)) throw new Error(`${field}.slug is invalid`);
    slugs.add(slug);
    const categories = Array.isArray(record.categories)
      ? record.categories.map((item, itemIndex) => cardText(item, `${field}.categories[${itemIndex}]`, 40))
      : [];
    return {
      slug,
      label: cardText(record.label, `${field}.label`, 120),
      blurb: cardText(record.blurb, `${field}.blurb`, 240),
      logo: null,
      domain: null,
      categories,
      region: "cn",
    };
  });
}

type MarketAppsLoader = () => Promise<CnAppCard[] | null>;
let testLoader: MarketAppsLoader | null = null;
let cache: { at: number; cards: CnAppCard[] } | null = null;

/** Test seam: replace the network read, or pass null to restore it. */
export function setMarketAppsForTests(loader: MarketAppsLoader | null): void {
  testLoader = loader;
  cache = null;
}

/** The market catalog when it is reachable and valid; null so the caller can fall back to the bundle. */
export async function loadMarketApps({
  fetcher = fetch,
  now = Date.now(),
}: { fetcher?: Fetcher; now?: number } = {}): Promise<CnAppCard[] | null> {
  if (testLoader) return testLoader();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.cards;
  try {
    const response = await fetcher(marketAppsUrl(), {
      headers: { accept: "application/json, text/plain;q=0.9" },
      redirect: "error",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const announced = Number(response.headers.get("content-length") ?? 0);
    if (announced > MAX_APPS_BYTES) return null;
    const raw = await response.text();
    if (Buffer.byteLength(raw) > MAX_APPS_BYTES) return null;
    const parsed = JSON.parse(raw);
    const cards = Array.isArray(parsed) ? parseMarketApps(parsed) : parseMarketApiApps(parsed);
    cache = { at: now, cards };
    return cards;
  } catch {
    return null;
  }
}
