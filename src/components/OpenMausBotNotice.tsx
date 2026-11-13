import { useState } from "react";

import { t } from "@/lib/i18n";
import { useStore } from "@/state/store";

const DISMISSED = "mengbot.openmausbotNotice.dismissed";

/** A fresh install that finds an OpenMausBot data folder offers to move it over, once. */
export function OpenMausBotNotice() {
  const { state, dispatch } = useStore();
  const suggestion = state.config?.openmausbot;
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(DISMISSED) === "1"; } catch { return false; }
  });
  if (hidden || !suggestion) return null;
  const dismiss = () => {
    setHidden(true);
    try { localStorage.setItem(DISMISSED, "1"); } catch { /* private mode: it just shows again next launch */ }
  };
  return (
    <div role="status" className="fixed bottom-4 left-4 z-50 w-[min(360px,calc(100vw-32px))] rounded-xl border border-hairline/50 bg-panel p-4 text-ink shadow-xl">
      <div className="text-[13px] font-medium">{t("migration.notice.title")}</div>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">{t("migration.notice.body", { bots: String(suggestion.bots) })}</p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" className="ui-button ui-button-md" onClick={dismiss}>{t("migration.notice.later")}</button>
        <button
          type="button"
          className="ui-button ui-button-md ui-button-primary"
          onClick={() => {
            dispatch({ type: "toggleAppSettings", open: true, section: "import" });
            dismiss();
          }}
        >{t("migration.notice.open")}</button>
      </div>
    </div>
  );
}
