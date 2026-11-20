import { useEffect, useRef } from "react";

import {
  APP_AUTHOR,
  APP_COMPANY,
  APP_CONTACT_EMAIL,
  appVersion,
  platformLabel,
} from "@/lib/app-links";
import { productName } from "@/lib/brand";
import { t } from "@/lib/i18n";
import { useOtherServerName } from "@/lib/other-server";
import { PeachMascot } from "./PeachMascot";

/** The app's own version first; `server` (useOtherServerName: set only when the app's window shows another server) adds a
 * line naming it with the version its page runs. A browser, or an app too old to say, keeps the page's version on one line. */
export function aboutVersionLines({ app, bundle, platform, server }: {
  app?: { version: string } | null;
  bundle: string;
  platform: string | null;
  server: string | null;
}): string[] {
  const line = (version: string) => `${t("about.version", { version })}${platform ? ` · ${platform}` : ""}`;
  if (!app?.version) return [line(bundle)];
  return server ? [line(app.version), t("about.connectedTo", { name: server, version: bundle })] : [line(app.version)];
}

export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const server = useOtherServerName(open);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const [version, connected] = aboutVersionLines({ app: window.ogb?.app, bundle: appVersion(), platform: platformLabel(window.ogb?.platform), server });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-dialog-title"
        className="w-full max-w-[360px] rounded-2xl border border-hairline/50 bg-panel p-6 text-center shadow-2xl"
      >
        <PeachMascot size={76} interactive />
        <h2 id="about-dialog-title" className="mt-3 text-[17px] font-semibold text-ink">
          {productName()}
        </h2>
        <p className="mt-1 text-[13px] text-ink-secondary">{version}</p>
        {connected && <p className="mt-0.5 text-[13px] text-ink-secondary">{connected}</p>}
        <p className="mt-3 text-[13px] leading-relaxed text-ink-secondary">
          MengBot — 中文优先的 AI 机器人团队。
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">
          作者 {APP_AUTHOR} · {APP_COMPANY} ·{" "}
          <a href={`mailto:${APP_CONTACT_EMAIL}`} className="text-accent hover:underline">{APP_CONTACT_EMAIL}</a>
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">
          开源许可：Apache-2.0。版权与许可声明完整保留在安装目录 licenses/ 与仓库 NOTICE、LICENSE 中。
        </p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-raised px-4 py-2 text-[13px] font-medium text-ink hover:brightness-110"
        >
          {t("cloudAdd.close")}
        </button>
      </div>
    </div>
  );
}
