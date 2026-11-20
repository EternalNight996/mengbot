// Security: the key is write-only; the server reports configured-or-not, never the value.
import { useState } from "react";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { api, useStore, type ConfigStatus } from "@/state/store";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import type { LocaleKey } from "@/locales";
import { Card, SettingRow, Switch } from "./SettingsPrimitives";
import { Select } from "./Select";
import { WorkersAiKeyCard } from "./WorkersAiKeyCard";

const KEY_URL = { jev: "https://typesafe.ai", lingdt: "https://maas.antdigital.com" } as const;
const LINGDT = {
  baseUrl: "https://maas.antdigital.com/v1/systemone/lingdt-decision-1.0",
  model: "lingdt-decision-1.0",
} as const;

type Provider = "jev" | "openrouter";
type Choice = "jev" | "workersai" | "lingdt";
type TestResult = { ok: true; latencyMs: number } | { ok: false; reason: string; status?: number };

const FAILURES: Record<string, LocaleKey> = {
  rejected: "decider.error.rejected",
  unreachable: "decider.error.unreachable",
  timeout: "decider.error.timeout",
  rate_limited: "decider.error.rateLimited",
  overloaded: "decider.error.overloaded",
  malformed: "decider.error.malformed",
  no_key: "decider.error.noKey",
  misconfigured: "decider.error.misconfigured",
};

const INCLUDED_FAILURES: Record<string, LocaleKey> = {
  rejected: "decider.included.error.rejected",
  rate_limited: "decider.included.error.limited",
};

const OPENROUTER_FAILURES: Record<string, LocaleKey> = {
  ...FAILURES,
  rejected: "decider.openrouter.error.rejected",
  unreachable: "decider.openrouter.error.unreachable",
  timeout: "decider.openrouter.error.timeout",
  rate_limited: "decider.openrouter.error.rateLimited",
  overloaded: "decider.openrouter.error.overloaded",
  malformed: "decider.openrouter.error.malformed",
};

const WORKERS_AI_FAILURES: Record<string, LocaleKey> = {
  ...FAILURES,
  rejected: "decider.workersAi.error.rejected",
  unreachable: "decider.workersAi.error.unreachable",
  timeout: "decider.workersAi.error.timeout",
  rate_limited: "decider.workersAi.error.rateLimited",
  overloaded: "decider.workersAi.error.overloaded",
  malformed: "decider.workersAi.error.malformed",
};

const BY: Record<"jev" | "workersai" | "openrouter", LocaleKey> = {
  jev: "decider.status.byJev", workersai: "decider.status.byWorkersAi", openrouter: "decider.status.byOpenRouter",
};

/** Who decides and who reads, in a word each: the person's own key, the Cloud plan's, or nothing yet. */
export function helpersStatusLine(config: ConfigStatus | null): string {
  const decider = config?.decider;
  const extraction = config?.helpers?.extraction;
  const workersAiOnly = config?.helpers?.own.workersAi === true && config?.helpers?.own.jev !== true;
  const decisions = !decider?.configured ? t("decider.status.notSetUp")
    : decider.included ? t("decider.status.byCloud")
      : decider.provider === "openrouter" ? "LingDT-Decision"
        : workersAiOnly ? t("decider.status.byWorkersAi") : t(BY[decider.provider] ?? BY.jev);
  const reading = !extraction?.provider ? t("decider.status.notSetUp")
    : extraction.included ? t("decider.status.byCloud") : t(BY[extraction.provider]);
  return t("decider.status.line", { decisions, extraction: reading });
}

/** A fixed sentence per failure: the vendor's own body never reaches the UI. */
export function deciderFailureText(result: { reason: string; status?: number }, included = false, provider: Provider | "workersai" = "jev"): string {
  if (provider === "workersai") {
    if (result.reason === "http_error") return t("decider.workersAi.error.http", { status: String(result.status ?? "?") });
    const key = WORKERS_AI_FAILURES[result.reason];
    return key ? t(key) : t("decider.error.other");
  }
  if (provider === "openrouter") {
    if (result.reason === "http_error") return t("decider.openrouter.error.http", { status: String(result.status ?? "?") });
    const key = OPENROUTER_FAILURES[result.reason];
    return key ? t(key) : t("decider.error.other");
  }
  if (included && result.reason === "http_error" && result.status === 402) return t("decider.included.error.subscription");
  if (included && INCLUDED_FAILURES[result.reason]) return t(INCLUDED_FAILURES[result.reason]!);
  if (result.reason === "http_error") return t("decider.error.http", { status: String(result.status ?? "?") });
  const key = FAILURES[result.reason];
  return key ? t(key) : t("decider.error.other");
}

export function DecisionModelSettings() {
  const { state, dispatch } = useStore();
  const decider = state.config?.decider;
  const [picked, setPicked] = useState<Choice | null>(null);
  const workersAiOnly = state.config?.helpers?.own.workersAi === true && state.config?.helpers?.own.jev !== true;
  const choice: Choice = picked ?? (decider?.provider === "openrouter" ? "lingdt" : workersAiOnly ? "workersai" : "jev");
  const provider: Provider = choice === "lingdt" ? "openrouter" : "jev";
  const configured = decider?.configured ?? false;
  const included = configured && decider?.included === true;
  const enabled = decider?.enabled ?? false;
  const roomRouting = decider?.jobs.roomRouting ?? true;
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null);
  const draft = value.trim();
  const ownKey = configured && !included;
  const clearing = !draft && ownKey;

  const applied = (config: ConfigStatus) => dispatch({ type: "configStatus", config });

  const patch = async (decision: Record<string, unknown>) => {
    if (switching) return;
    setSwitching(true);
    setError(null);
    setVerdict(null);
    try {
      applied(await api<ConfigStatus>("/api/config", { method: "PUT", body: JSON.stringify({ decider: decision }) }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSwitching(false);
    }
  };

  const choose = (next: Choice) => {
    setValue("");
    setVerdict(null);
    setPicked(next);
    if (next === "workersai") return;
    if (next === "jev") void patch({ provider: "jev" });
    else void patch({ provider: "openrouter", openrouterBaseUrl: LINGDT.baseUrl, openrouterModel: LINGDT.model, openrouterApi: "chat" });
  };

  const save = async () => {
    if (saving || (!draft && !ownKey)) return;
    setSaving(true);
    setError(null);
    setVerdict(null);
    try {
      const field = provider === "openrouter" ? "openrouterKey" : "key";
      const status = window.ogb?.setCredential
        ? await window.ogb.setCredential(provider === "openrouter" ? "openrouterDeciderKey" : "jevApiKey", draft)
        : await api<ConfigStatus>("/api/config", { method: "PUT", body: JSON.stringify({ decider: { [field]: draft } }) });
      applied(status);
      setValue("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    if (testing || saving || (!draft && !configured)) return;
    setTesting(true);
    setVerdict(null);
    setError(null);
    try {
      const result = await api<TestResult>("/api/decider/test", { method: "POST", body: JSON.stringify(draft ? { key: draft } : {}) });
      setVerdict(result.ok
        ? { ok: true, text: t(provider === "openrouter" ? "decider.openrouter.test.ok" : "decider.test.ok", { ms: String(result.latencyMs) }) }
        : { ok: false, text: deciderFailureText(result, included, provider) });
    } catch (cause) {
      setVerdict({ ok: false, text: cause instanceof Error ? cause.message : String(cause) });
    } finally {
      setTesting(false);
    }
  };

  const keyLabel = provider === "openrouter" ? "LingDT-Decision" : t("decider.key.label");
  const keyPlaceholder = provider === "openrouter" ? "API Key" : t("decider.key.placeholder");

  return (
    <>
      <section className="space-y-2 px-4">
        <p className="text-[13px] leading-relaxed text-ink-secondary">{t("decider.intro")}</p>
        <p role="status" data-testid="helpers-status" className="text-[13px] font-medium text-ink">{helpersStatusLine(state.config)}</p>
      </section>

      <SettingRow title={t("decider.provider.label")}>
        <Select className="w-56"
          data-testid="decider-provider"
          value={choice}
          onChange={(event) => choose(event.target.value as Choice)}
          disabled={switching || !state.config}
          aria-label={t("decider.provider.label")}
        >
          <option value="jev">Jev</option>
          <option value="workersai">{t("decider.workersAi.title")}</option>
          <option value="lingdt">LingDT-Decision（国内）</option>
        </Select>
      </SettingRow>

      {choice === "workersai" ? (
        <WorkersAiKeyCard failureText={(result) => deciderFailureText(result, false, "workersai")} />
      ) : (
        <Card title={keyLabel}>
          <div role="status" className="mb-2 flex items-center gap-2 text-[13px] text-ink-secondary">
            <span className={cn("size-1.5 rounded-full", configured ? "bg-success" : "bg-raised-hover")} />
            <span className={configured ? "text-success" : undefined}>
              {included ? t("keys.includedWithCloudPro") : configured ? t("decider.status.connected") : t("decider.status.notConnected")}
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              value={value}
              onChange={(event) => { setVerdict(null); setError(null); setValue(event.target.value); }}
              onKeyDown={(event) => event.key === "Enter" && void save()}
              disabled={saving}
              placeholder={ownKey ? t("keys.replace") : keyPlaceholder}
              aria-label={keyLabel}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2 text-[13px] text-ink placeholder:text-ink-secondary focus:outline-none"
            />
            <button
              type="button"
              data-testid="decider-save"
              onClick={() => void save()}
              disabled={saving || (!draft && !ownKey)}
              title={clearing ? t("keys.removeKey") : t("common.save")}
              className={cn(
                "flex w-[72px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-control py-2 text-[13px] hover:bg-raised-hover disabled:cursor-not-allowed disabled:opacity-50",
                clearing ? "text-danger" : "text-ink",
              )}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : clearing ? t("keys.clear") : <><Check size={13} />{t("common.save")}</>}
            </button>
            <button
              type="button"
              data-testid="decider-test"
              onClick={() => void test()}
              disabled={testing || saving || (!draft && !configured)}
              className="flex shrink-0 cursor-pointer items-center justify-center rounded-lg border border-hairline/40 px-3 py-2 text-[13px] text-ink-secondary hover:bg-raised/50 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {testing ? t("keys.testing") : t("keys.test")}
            </button>
          </div>
          {error && <p role="alert" className="mt-1 text-[12px] text-danger">{error}</p>}
          {verdict && <p role="status" className={cn("mt-1 text-[12px]", verdict.ok ? "text-success" : "text-danger")}>{verdict.text}</p>}
          <a
            href={KEY_URL[provider === "openrouter" ? "lingdt" : "jev"]}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex cursor-pointer items-center gap-1 text-[12px] text-accent hover:underline"
          >
            {provider === "openrouter" ? "maas.antdigital.com" : t("decider.key.getKey")}
            <ExternalLink size={11} aria-hidden="true" />
          </a>
        </Card>
      )}

      <SettingRow
        title={t("decider.master")}
        subtitle={configured ? undefined : t("decider.masterNeedsKey")}
      >
        <Switch
          data-testid="decider-master"
          aria-label={t("decider.master")}
          checked={enabled}
          disabled={!configured || switching || !state.config}
          onClick={() => void patch({ enabled: !enabled })}
          className="cursor-pointer"
        />
      </SettingRow>

      <Card title={t("decider.jobs.title")}>
        <div className="flex items-start justify-between gap-4 py-2">
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-ink">{t("decider.jobs.roomRouting")}</div>
            <div className="mt-0.5 text-[12px] leading-relaxed text-ink-secondary">{t("decider.jobs.roomRoutingDetail")}</div>
          </div>
          <Switch
            data-testid="decider-job-roomRouting"
            aria-label={t("decider.jobs.roomRouting")}
            checked={enabled && roomRouting}
            disabled={!enabled || switching}
            onClick={() => void patch({ jobs: { roomRouting: !roomRouting } })}
            className="cursor-pointer"
          />
        </div>
      </Card>
    </>
  );
}
