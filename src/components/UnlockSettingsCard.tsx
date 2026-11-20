import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2 } from "lucide-react";

import { t } from "@/lib/i18n";
import { api } from "@/state/api";
import { openExternalLink } from "@/lib/app-links";
import { useStore } from "@/state/store";
import { UNLOCK_SKUS, type UnlockSku } from "../../shared/unlock";

interface UnlockStatus {
  unlocked: boolean;
  grants: Array<{ sku: string; codeId: string; activatedAt: string }>;
  caps: { bots: number | null; apps: number | null; tasks: number | null; devices: number | null };
}

export function UnlockSettingsCard() {
  const { state } = useStore();
  const purchase = state.config?.purchase;
  const [status, setStatus] = useState<UnlockStatus | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    api<UnlockStatus>("/api/unlock").then((next) => { if (alive) setStatus(next); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const activate = async () => {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await api<UnlockStatus>("/api/unlock/activate", { method: "POST", body: JSON.stringify({ code: code.trim() }) });
      setStatus(next);
      setCode("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  const cap = (value: number | null) => (status?.unlocked && value === null ? t("settings.unlock.unlimited") : String(value ?? 0));
  const skuLabel = (sku: string) => {
    const known = UNLOCK_SKUS[sku as UnlockSku];
    return known ? known.label : sku;
  };
  const copyGrants = async () => {
    if (!status) return;
    const text = JSON.stringify({ caps: status.caps, grants: status.grants }, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t("settings.unlock.copyFailed"));
    }
  };

  return (
    <section className="rounded-2xl border border-hairline/50 bg-card p-5" data-testid="unlock-card" aria-label={t("settings.unlock.title")}>
      <div className="flex items-center gap-2">
        <KeyRound size={15} className="text-accent" />
        <h3 className="text-[15px] font-medium text-ink">{t("settings.unlock.title")}</h3>
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">{t("settings.unlock.desc")}</p>
      <p className="mt-2 text-[13px] text-ink">
        {status?.unlocked
          ? t("settings.unlock.caps", { bots: cap(status.caps.bots), apps: cap(status.caps.apps) })
          : status ? t("settings.unlock.inactive") : t("common.checking")}
      </p>
      {status?.unlocked && status.grants.length > 0 && (
        <div className="mt-3 rounded-lg border border-hairline/40 bg-inset/40 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-medium text-ink-secondary">{t("settings.unlock.grantsTitle")}</span>
            <button type="button" onClick={() => void copyGrants()} className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-ink-secondary hover:bg-control hover:text-ink">
              {copied ? <Check size={11} /> : <Copy size={11} />}{copied ? t("settings.unlock.copied") : t("settings.unlock.copy")}
            </button>
          </div>
          <ul className="mt-1.5 flex flex-col gap-1">
            {status.grants.map((grant) => (
              <li key={grant.codeId} className="flex items-center justify-between gap-2 text-[12px] text-ink">
                <span>{skuLabel(grant.sku)}</span>
                <span className="text-ink-tertiary">{new Date(grant.activatedAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") void activate(); }}
          placeholder={t("settings.unlock.placeholder")}
          disabled={busy}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border border-hairline/40 bg-inset px-3 py-2 font-mono text-[12px] text-ink placeholder:text-ink-secondary focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => void activate()}
          disabled={busy || !code.trim()}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-control px-3 py-2 text-[13px] text-ink hover:bg-raised-hover disabled:opacity-50"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          {busy ? t("settings.unlock.activating") : t("settings.unlock.activate")}
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-[12px] text-danger">{t("settings.unlock.error", { error })}</p>}
      {(purchase?.url || purchase?.contact) && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-ink-secondary">
          <span>{t("settings.unlock.buyHint")}</span>
          {purchase?.url && (
            <span className="flex flex-wrap gap-1.5">
              {(Object.entries(UNLOCK_SKUS) as Array<[UnlockSku, (typeof UNLOCK_SKUS)[UnlockSku]]>).map(([sku, info]) => (
                <button
                  key={sku}
                  type="button"
                  onClick={() => void openExternalLink(purchase.url! + (purchase.url!.includes("?") ? "&" : "?") + "sku=" + sku)}
                  className="rounded-md border border-hairline/40 px-2 py-1 text-[12px] text-accent hover:bg-raised/50"
                >
                  ¥{(info.priceFen / 100).toFixed(0)} {info.label}
                </button>
              ))}
            </span>
          )}
          {purchase?.contact && <span className="font-mono text-[11px] text-ink-tertiary">{purchase.contact}</span>}
        </p>
      )}
    </section>
  );
}