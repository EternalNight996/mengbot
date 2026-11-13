import { Check, FolderInput, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { t } from "@/lib/i18n";
import { api } from "@/state/api";

interface ImportPreview {
  source: string;
  bots: number;
  hasHistory: boolean;
  skills: number;
  routines: number;
  applied: boolean;
  copied: string[];
  skipped: string[];
  merged?: Record<string, number>;
  mergedFiles?: Record<string, number>;
  messages?: number;
  restarting?: boolean;
}

const buttonClass = "inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-[13px] font-medium text-accent-ink disabled:opacity-40";

export function OpenMausBotImportSection() {
  const [dir, setDir] = useState("");
  const [busy, setBusy] = useState<"check" | "import" | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [done, setDone] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [zipPath, setZipPath] = useState("");

  useEffect(() => {
    let alive = true;
    // Offer the folder we can find and the result of the last run, so the card says something after the restart.
    api<{ candidates?: string[] }>("/api/import/openmausbot").then((found) => {
      if (!alive) return;
      const first = found.candidates?.[0];
      if (first) setDir((current) => current || first);
    }).catch(() => {});
    api<{ last: ImportPreview | null }>("/api/import/openmausbot/last").then((found) => {
      if (alive && found.last) setDone(found.last);
    }).catch(() => {}).finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, []);

  const call = async (apply: boolean) => {
    if ((!dir.trim() && !zipPath) || busy) return;
    setBusy(apply ? "import" : "check");
    setError(null);
    try {
      const before = apply ? await api<{ pid?: number }>("/api/health").catch(() => null) : null;
      const result = zipPath
        ? await api<ImportPreview>("/api/import/openmausbot/zip", { method: "POST", body: JSON.stringify({ path: zipPath, apply }) })
        : await api<ImportPreview>("/api/import/openmausbot", { method: "POST", body: JSON.stringify({ dir: dir.trim(), apply }) });
      if (apply) {
        setDone(result);
        // The window stays open while the server restarts behind it: reload as soon as /api/health
        // answers with a different process, usually two or three seconds.
        if (result.restarting) {
          const baseline = before?.pid ?? null;
          const started = Date.now();
          const waitForNewServer = async () => {
            try {
              const health = await api<{ pid?: number }>("/api/health");
              const changed = baseline === null ? Date.now() - started > 1500 : health.pid !== baseline;
              if (changed) { window.location.reload(); return; }
            } catch { /* the old server is going down; try again */ }
            if (Date.now() - started < 25_000) setTimeout(() => void waitForNewServer(), 700);
            else window.location.reload();
          };
          setTimeout(() => void waitForNewServer(), 900);
        }
      } else {
        setPreview(result);
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section data-import-section="openmausbot" className="rounded-xl bg-card p-4">
      <div className="flex items-center gap-2 text-[15px] font-medium text-ink"><FolderInput size={15} />{t("settings.import.openmausTitle")}</div>
      <div className="mt-0.5 text-[13px] leading-relaxed text-ink-secondary">{t("settings.import.openmausSubtitle")}</div>
      <label className="mt-3 block text-[12px] text-ink-secondary">
        {t("settings.import.openmausDirLabel")}
        <input
          value={dir}
          onChange={(event) => { setDir(event.target.value); setPreview(null); setDone(null); }}
          placeholder={t("settings.import.openmausDirHint")}
          disabled={busy !== null}
          spellCheck={false}
          className="mt-1 w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2 font-mono text-[12px] text-ink placeholder:text-ink-secondary focus:outline-none disabled:opacity-50"
        />
      </label>
      <label className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-ink-secondary">
        <span className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-hairline/40 px-2.5 py-1.5 hover:bg-raised/50">
          <FolderInput size={13} />{t("settings.import.openmausZip")}
          <input
            type="file"
            accept=".zip,.tar,.tar.gz,.tgz"
            className="sr-only"
            disabled={busy !== null}
            onChange={(event) => {
              const file = event.target.files?.[0] as (File & { path?: string }) | undefined;
              const path = file?.path ?? "";
              setZipPath(path);
              setDone(null);
              setPreview(null);
              if (path) void (async () => {
                setBusy("check");
                setError(null);
                try { setPreview(await api<ImportPreview>("/api/import/openmausbot/zip", { method: "POST", body: JSON.stringify({ path, apply: false }) })); }
                catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
                finally { setBusy(null); }
              })();
            }}
          />
        </span>
        {zipPath && <span className="min-w-0 truncate font-mono text-[11px] text-ink-tertiary">{zipPath.split(/[\\/]/).pop()}</span>}
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void call(false)} disabled={busy !== null || (!dir.trim() && !zipPath)} className="rounded-lg border border-hairline/40 px-3 py-2 text-[13px] text-ink hover:bg-raised/50 disabled:opacity-40">
          {busy === "check" ? <Loader2 size={13} className="animate-spin" /> : null}{t("settings.import.openmausCheck")}
        </button>
        <button type="button" onClick={() => void call(true)} disabled={busy !== null || (!dir.trim() && !zipPath)} className={buttonClass}>
          {busy === "import" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}{t("settings.import.openmausImport")}
        </button>
      </div>
      {checking && !done && <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-secondary"><Loader2 size={13} className="animate-spin" />{t("common.checking")}</p>}
      {preview && !done && (
        <p className="mt-3 text-[13px] text-ink">
          {t("settings.import.openmausFound", { bots: String(preview.bots), routines: String(preview.routines), skills: String(preview.skills) })}
          {preview.hasHistory ? ` · ${t("settings.import.openmausHistory")}` : ""}
        </p>
      )}
      {done && (
        <div role="status" className="mt-3 flex flex-col gap-1 text-[13px] text-ink">
          <p>{t("settings.import.openmausDone", { files: String(done.copied.length), skipped: String(done.skipped.length) })}</p>
          {(() => {
            const bots = done.merged?.["bots.json"] ?? 0;
            const messages = done.messages ?? 0;
            const skills = done.mergedFiles?.["imported-skills"] ?? 0;
            const nothing = bots === 0 && messages === 0 && skills === 0 && done.copied.length === 0;
            return (
              <p className="text-ink-secondary">
                {nothing ? t("settings.import.openmausNothingNew")
                  : t("settings.import.openmausMerged", { bots: String(bots), messages: String(messages), skills: String(skills) })}
              </p>
            );
          })()}
          {done.restarting && <p className="text-accent">{t("settings.import.openmausRestarting")}</p>}
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-[12px] text-danger">{error}</p>}
    </section>
  );
}