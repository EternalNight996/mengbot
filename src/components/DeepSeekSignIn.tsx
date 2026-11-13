import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, LogIn } from "lucide-react";

import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { api, useStore, type InstanceInfo } from "@/state/store";

type AuthStart = { phase: "waiting" | "succeeded"; flowId: string | null; authorizationUrl: string | null; expiresAt: string | null };
type AuthStatus = { phase: "waiting" | "succeeded" | "failed" | "expired" | "cancelled"; flowId: string | null; authorizationUrl: string | null; expiresAt: string | null; message?: string };
type Flow = { flowId: string; authorizationUrl: string; expiresAt: string | null };

const PRIMARY = "flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white hover:brightness-110 disabled:cursor-wait disabled:opacity-70";
const SECONDARY = "w-full rounded-lg bg-control px-3 py-2 text-[12px] font-semibold text-ink hover:bg-raised-hover disabled:opacity-50";

function authorizeLink(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "platform.deepseek.com" && url.pathname === "/dsh/authorize" &&
      !url.username && !url.password && !url.hash ? url.href : null;
  } catch {
    return null;
  }
}

export function DeepSeekSignIn({ instance, className, accountConnected = false, onDone }: { instance: InstanceInfo; className?: string; accountConnected?: boolean; onDone?: (signedIn: boolean) => void }) {
  const { refreshInstances, refreshModels } = useStore();
  const [flow, setFlow] = useState<Flow | null>(null);
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [busy, setBusy] = useState<"start" | "check" | "complete" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [callbackUrl, setCallbackUrl] = useState("");
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const base = `/api/instances/${encodeURIComponent(instance.instanceId)}/auth`;

  const refresh = async () => {
    try { await refreshInstances(); } catch {}
    try { await refreshModels(instance.instanceId); } catch {}
  };

  useEffect(() => {
    if (!flow || auth?.phase !== "waiting") return;
    const controller = new AbortController();
    const remaining = flow.expiresAt ? Date.parse(flow.expiresAt) - Date.now() : Number.NaN;
    const expiry = Number.isFinite(remaining)
      ? window.setTimeout(() => { controller.abort(); setAuth({ phase: "expired", flowId: null, authorizationUrl: null, expiresAt: null }); }, Math.max(0, remaining))
      : null;
    const timer = window.setTimeout(() => {
      void api(`${base}/status?flowId=${encodeURIComponent(flow.flowId)}`, { signal: controller.signal })
        .then(async ({ auth: next }: { auth: AuthStatus }) => {
          if (controller.signal.aborted || !alive.current) return;
          setAuth(next);
          setError(null);
          if (next.phase === "succeeded") {
            await refresh();
            onDone?.(true);
          }
        })
        .catch((cause: unknown) => {
          if (controller.signal.aborted || !alive.current) return;
          setError(cause instanceof Error ? cause.message : t("deepseekSignIn.failed"));
        });
    }, 2000);
    return () => {
      window.clearTimeout(timer);
      if (expiry !== null) window.clearTimeout(expiry);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, flow, base, instance.instanceId]);

  const start = async () => {
    setBusy("start");
    setError(null);
    try {
      const { auth: next }: { auth: AuthStart } = await api(`${base}/start`, { method: "POST" });
      if (next.phase === "succeeded") {
        setAuth({ ...next, phase: "succeeded" });
        await refresh();
        onDone?.(true);
        return;
      }
      const link = authorizeLink(next.authorizationUrl);
      if (!next.flowId || !link) throw new Error(t("deepseekSignIn.invalidLink"));
      const created = { flowId: next.flowId, authorizationUrl: link, expiresAt: next.expiresAt };
      setFlow(created);
      setAuth({ phase: "waiting", flowId: next.flowId, authorizationUrl: link, expiresAt: next.expiresAt });
      if (window.ogb?.openExternal) await window.ogb.openExternal(link);
      else window.open(link, "_blank", "noopener,noreferrer");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("deepseekSignIn.failed"));
    } finally {
      setBusy(null);
    }
  };

  const openAgain = () => {
    if (!flow) return;
    if (window.ogb?.openExternal) void window.ogb.openExternal(flow.authorizationUrl);
    else window.open(flow.authorizationUrl, "_blank", "noopener,noreferrer");
  };

  const check = async () => {
    setBusy("check");
    setError(null);
    try {
      const { auth: next }: { auth: AuthStatus } = await api(`${base}/status?flowId=${encodeURIComponent(flow!.flowId)}`);
      setAuth(next);
      if (next.phase === "succeeded") {
        await refresh();
        onDone?.(true);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("deepseekSignIn.failed"));
    } finally {
      setBusy(null);
    }
  };

  const complete = async () => {
    if (!flow) return;
    setBusy("complete");
    setError(null);
    try {
      await api(`${base}/complete`, { method: "POST", body: JSON.stringify({ flowId: flow.flowId, callbackUrl }) });
      setCallbackUrl("");
      await check();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("deepseekSignIn.failed"));
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    if (!flow) return;
    setBusy("cancel");
    setError(null);
    try {
      await api(`${base}/cancel`, { method: "POST", body: JSON.stringify({ flowId: flow.flowId }) });
      setAuth({ phase: "cancelled", flowId: null, authorizationUrl: null, expiresAt: null });
      setFlow(null);
      onDone?.(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("deepseekSignIn.failed"));
    } finally {
      setBusy(null);
    }
  };

  const phase = auth?.phase ?? (accountConnected ? "succeeded" : "idle");
  const waiting = phase === "waiting" && flow !== null;
  const succeeded = phase === "succeeded";

  return (
    <div className={cn("mt-3 space-y-2", className)} data-deepseek-sign-in>
      {succeeded ? (
        <p role="status" className="rounded-lg bg-inset px-2.5 py-2 text-[12px] text-success">{t("deepseekSignIn.success")}</p>
      ) : (
        <button type="button" disabled={busy !== null} onClick={() => void start()} className={PRIMARY}>
          {busy === "start" ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
          {waiting ? t("deepseekSignIn.openAgain") : phase === "idle" ? t("deepseekSignIn.start") : t("deepseekSignIn.retry")}
        </button>
      )}
      {waiting && (
        <>
          <p role="status" className="flex items-center gap-1.5 text-[12px] text-ink-secondary">
            <Loader2 size={12} className="animate-spin" /> {t("deepseekSignIn.waiting")}
          </p>
          <div className="flex gap-2">
            <button type="button" className={SECONDARY} aria-label={t("deepseekSignIn.openAgain")} title={t("deepseekSignIn.openAgain")} onClick={openAgain}>
              <ExternalLink size={12} className="mx-auto" />
            </button>
            <button type="button" className={SECONDARY} disabled={busy !== null} onClick={() => void check()}>
              {busy === "check" ? t("common.checking") : t("deepseekSignIn.finished")}
            </button>
            <button type="button" className={SECONDARY} disabled={busy !== null} onClick={() => void cancel()}>
              {t("common.cancel")}
            </button>
          </div>
          <details className="rounded-lg border border-hairline/50 bg-app px-2.5 py-2 text-[12px] text-ink-secondary">
            <summary className="cursor-pointer select-none">{t("deepseekSignIn.otherComputer")}</summary>
            <p className="mt-2 leading-relaxed">{t("deepseekSignIn.otherComputerHint")}</p>
            <input
              value={callbackUrl}
              onChange={(event) => setCallbackUrl(event.target.value)}
              aria-label={t("deepseekSignIn.callbackLabel")}
              placeholder="http://127.0.0.1:…/oauth/callback?code=…&state=…"
              className="mt-2 w-full rounded-md border border-hairline bg-inset px-2 py-1.5 text-[11px] text-ink outline-none focus:border-accent"
            />
            <button type="button" disabled={!callbackUrl.trim() || busy !== null} onClick={() => void complete()} className={cn(SECONDARY, "mt-2")}>
              {busy === "complete" ? t("engineSetup.sending") : t("deepseekSignIn.send")}
            </button>
          </details>
        </>
      )}
      {!succeeded && !waiting && (
        <p className="text-[11px] leading-relaxed text-ink-tertiary">{t("deepseekSignIn.keyHint")}</p>
      )}
      {error && <p role="alert" className="text-[12px] text-danger">{error}</p>}
    </div>
  );
}
