import { useState } from "react";
import { Check, ShieldCheck, X } from "lucide-react";

import { analyticsConsent, setAnalyticsConsent } from "@/lib/analytics";

/** First-run consent for anonymous product analytics. The preference may already be on, but main sends nothing
 * until this answer is saved, and the prompt only exists on this computer's own page. */
export function AnalyticsConsent() {
  const [state, setState] = useState(() => analyticsConsent());
  if (state !== "unknown") return null;
  if (!window.ogb?.desktopAnalytics?.setConsent) return null;
  const choose = (granted: boolean) => {
    setAnalyticsConsent(granted);
    setState(granted ? "granted" : "denied");
  };
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]" data-analytics-consent="">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="analytics-consent-title"
        className="w-full max-w-[460px] overflow-hidden rounded-[24px] border border-[var(--hairline)] bg-[var(--card)] shadow-[0_24px_80px_rgb(0_0_0/0.28)]"
      >
        <div className="flex items-start gap-3 px-6 pb-4 pt-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-[var(--accent)]/12 text-[var(--accent)]">
            <ShieldCheck size={21} strokeWidth={1.9} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="analytics-consent-title" className="text-[17px] font-semibold leading-6 text-[var(--text)]">帮助改进 MengBot</h2>
            <p className="mt-1 text-[13px] leading-5 text-[var(--muted)]">是否允许发送匿名使用统计？选什么都不会影响功能。</p>
          </div>
        </div>

        <div className="mx-6 rounded-2xl border border-[var(--hairline)] bg-[var(--inset,var(--card))] p-4">
          <div className="flex gap-2.5">
            <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" aria-hidden="true" />
            <div className="min-w-0 text-[13px] leading-5 text-[var(--text)]">
              <b className="font-medium">会发送</b>
              <p className="mt-0.5 text-[var(--muted)]">功能使用次数、版本、平台、崩溃/错误计数。</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2.5 border-t border-[var(--hairline)] pt-3">
            <X size={16} className="mt-0.5 shrink-0 text-[var(--muted)]" aria-hidden="true" />
            <div className="min-w-0 text-[13px] leading-5 text-[var(--text)]">
              <b className="font-medium">不会发送</b>
              <p className="mt-0.5 text-[var(--muted)]">聊天内容、文件、邮箱、网址、密钥，都不会采集。</p>
            </div>
          </div>
        </div>

        <p className="px-6 pt-4 text-[12px] leading-5 text-[var(--muted)]">发送到境内自建统计服务；可随时在 设置 → 隐私 中关闭。</p>

        <div className="flex flex-col-reverse gap-2 px-6 pb-6 pt-5 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => choose(false)} className="rounded-xl px-4 py-2.5 text-[13px] font-medium text-[var(--muted)] transition-colors hover:bg-black/[0.05]">
            暂不启用
          </button>
          <button type="button" onClick={() => choose(true)} className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90">
            允许匿名统计
          </button>
        </div>

        <div className="border-t border-[var(--hairline)] px-6 py-3 text-center">
          <a className="text-[12px] text-[var(--accent)] hover:underline" href="https://github.com/EternalNight996/mengbot/blob/main/PRIVACY.md" target="_blank" rel="noreferrer">
            查看隐私说明
          </a>
        </div>
      </div>
    </div>
  );
}
