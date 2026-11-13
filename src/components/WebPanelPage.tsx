// A pinned web page shown in place of the chat, like Team map. The page is
// framed under the name main gave this page — the app's own frame guard lets
// that one frame load anything, and no other — with a sandbox and no referrer;
// a page that refuses framing (or never loads) falls back to a button that
// opens it in the browser.
import { ExternalLink, Globe, RotateCw } from "lucide-react";
import { useEffect, useState } from "react";

import { openExternalLink } from "@/lib/app-links";
import { t } from "@/lib/i18n";
import { useWebPanels } from "@/lib/web-panel-preferences";
import { isAppOrigin, isLocalPageUrl } from "@/lib/web-panels";
import { api } from "@/state/api";
import { useStore } from "@/state/store";

const LOAD_TIMEOUT_MS = 10_000;

export function WebPanelPage() {
  const { state, dispatch } = useStore();
  const panels = useWebPanels();
  const panel = panels.find((entry) => entry.id === state.webPanelId);
  const [reloads, setReloads] = useState(0);
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  const [refusedUrl, setRefusedUrl] = useState<string>();
  const [unreachableUrl, setUnreachableUrl] = useState<string>();

  // A removed panel leaves nothing to show: go back to the conversation.
  useEffect(() => {
    if (!panel) dispatch({ type: "showChat" });
  }, [panel, dispatch]);

  useEffect(() => {
    setStatus("loading");
    const timer = setTimeout(() => setStatus((current) => (current === "loading" ? "failed" : current)), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [panel?.url, reloads]);

  // The browser fires load on a frame it refused or never reached, so only the page's own answer, read by the
  // server, tells: its headers refuse framing, or a local page did not answer at all because nothing is there.
  useEffect(() => {
    const url = panel?.url;
    if (!url) return;
    const check = new AbortController();
    api<{ framing?: string; reachable?: boolean | null }>(`/api/web-panels/framing?url=${encodeURIComponent(url)}&origin=${encodeURIComponent(window.location.origin)}`, { background: true, signal: check.signal })
      .then(({ framing, reachable }) => {
        setRefusedUrl(framing === "blocked" ? url : undefined);
        setUnreachableUrl(framing !== "blocked" && reachable === false && isLocalPageUrl(url) ? url : undefined);
      }, () => undefined);
    return () => check.abort();
  }, [panel?.url, reloads]);

  if (!panel) return null;
  const refused = refusedUrl === panel.url;
  const unreachable = unreachableUrl === panel.url;
  const openInBrowser = () => void openExternalLink(panel.url).catch(() => undefined);
  // The name main handed this page: without it the frame guard reads the frame as an app frame and cancels the load
  // (electron/app-frame-guard.mjs). Absent in a browser, where no guard runs.
  const frameName = window.ogb?.webPanelFrame;

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-app" aria-label={panel.name}>
      <header className="flex items-center gap-2 border-b border-hairline/40 px-4 py-2.5">
        <Globe size={16} className="shrink-0 text-ink-secondary" />
        <h1 className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink" title={panel.url}>{panel.name}</h1>
        <button
          type="button"
          className="ui-icon-button shrink-0"
          aria-label={t("webPanels.page.reload")}
          title={t("webPanels.page.reload")}
          onClick={() => setReloads((n) => n + 1)}
        >
          <RotateCw size={16} />
        </button>
        <button type="button" className="ui-button" onClick={openInBrowser}>
          <ExternalLink size={14} />
          {t("webPanels.page.openInBrowser")}
        </button>
      </header>
      {refused || unreachable || status === "failed" || isAppOrigin(panel.url, window.location.origin) ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-[14px] font-medium text-ink">{t(unreachable ? "webPanels.page.unreachable" : "webPanels.page.cantEmbed")}</p>
          <p className="max-w-sm text-[13px] text-ink-secondary">{unreachable ? t("webPanels.page.unreachableBody") : refused ? t("webPanels.page.refusedBody", { site: new URL(panel.url).host }) : t("webPanels.page.cantEmbedBody")}</p>
          <button type="button" className="ui-button ui-button-primary" onClick={openInBrowser}>
            {t("webPanels.page.openInBrowser")}
          </button>
        </div>
      ) : (
        <iframe
          key={`${panel.id}:${reloads}`}
          src={panel.url}
          name={frameName}
          title={panel.name}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          referrerPolicy="no-referrer"
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("failed")}
          className="min-h-0 w-full flex-1 border-0 bg-app"
        />
      )}
    </main>
  );
}
