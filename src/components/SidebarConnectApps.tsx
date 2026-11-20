import { Puzzle } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { useStore } from "@/state/store";

import { preloadConnectedApps } from "@/lib/connected-apps";
import { ELEVATED_CONTROL, ELEVATED_HOVER } from "./elevated";
import { SIMPLE_TOP_BUTTON } from "./SidebarSimpleTop";

/**
 * The pill carries one Apps glyph instead of sample Gmail/Slack/Notion faces:
 * third-party favicon fetches were often blocked, leaving blank white squares.
 */
function useAppsConnected(): boolean {
  const { state } = useStore();
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (state.pluginsOpen) return;
    let alive = true;
    void preloadConnectedApps()
      .then((inventory) => {
        if (alive) setConnected(Object.values(inventory.services).some((status) => status.connected));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [state.pluginsOpen]);
  return connected;
}

/** `circle` is the collapsed rail's round button. */
export function SidebarConnectApps({ circle = false }: { circle?: boolean }) {
  const { state, dispatch } = useStore();
  const connected = useAppsConnected();
  const label = connected ? t("sidebar.nav.apps") : t("sidebar.connectApps");
  return (
    <button
      type="button"
      data-tour="nav-apps"
      data-sidebar-nav="apps"
      aria-pressed={state.pluginsOpen}
      aria-label={circle ? label : undefined}
      title={circle ? label : undefined}
      onClick={() => dispatch({ type: "togglePlugins", open: true })}
      className={circle ? SIMPLE_TOP_BUTTON : cn("group/apps flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full pl-4 pr-3 text-[14px] font-medium leading-5 text-ink", ELEVATED_CONTROL, ELEVATED_HOVER)}
    >
      {circle ? <Puzzle size={18} strokeWidth={1.5} aria-hidden="true" /> : <>
        <span className="min-w-0 truncate">{label}</span>
        <Puzzle size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
      </>}
    </button>
  );
}
