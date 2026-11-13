// The desktop main process owns sending: this page only forwards allowlisted events over IPC. No third-party
// script is loaded here, and nothing is sent before the first-run prompt is answered.
const OPT_OUT_KEY = "omb-analytics-opt-out";
const desktop = () => globalThis.window?.ogb?.desktopAnalytics;

export function analyticsConsent(): "unknown" | "granted" | "denied" {
  const value = desktop()?.consent?.();
  return value === "granted" || value === "denied" ? value : "unknown";
}

export function setAnalyticsConsent(granted: boolean) {
  const pending = desktop()?.setConsent?.(granted);
  void pending?.catch(() => {});
  try { localStorage.setItem(OPT_OUT_KEY, granted ? "0" : "1"); } catch {}
}

export function analyticsEnabled(): boolean {
  const saved = desktop()?.enabled?.();
  if (typeof saved === "boolean") return saved;
  try { return localStorage.getItem(OPT_OUT_KEY) !== "1"; } catch { return true; }
}

export type OptAction = "init" | "opt-in" | "opt-out" | "none";
export function optAction(enabled: boolean, running: boolean): OptAction {
  if (!enabled) return running ? "opt-out" : "none";
  return running ? "opt-in" : "init";
}

export function setAnalyticsEnabled(enabled: boolean) {
  const on = enabled === true;
  setAnalyticsConsent(on);
  const pending = desktop()?.set?.(on);
  void pending?.catch(() => {});
  try { localStorage.setItem(OPT_OUT_KEY, on ? "0" : "1"); } catch {}
}

/** Kept for callers that used to warm PostHog; main now owns the queue, so there is nothing to load. */
export function initAnalytics(): Promise<void> {
  return Promise.resolve();
}

export function track(event: string, props?: Record<string, unknown>) {
  if (!analyticsEnabled() || analyticsConsent() !== "granted") return;
  desktop()?.track?.(event, props);
}

/** Kept for the existing tests/utilities; sending is main-process only. */
export function analyticsSurface(): "local" | "server" {
  return globalThis.window?.ogb?.environments ? "local" : "server";
}

/** Kept as a no-op: the old PostHog scrubber is no longer in the path. */
export function locationProperty(_key: string): boolean {
  return false;
}

export function withoutLocation<T>(event: T): T {
  return event;
}

const GATE_KEY = "omb-email-gate";
export function emailGateDone(): boolean {
  try { return Boolean(localStorage.getItem(GATE_KEY)); } catch { return false; }
}
export function setEmailGateDone(status: "submitted" | "skipped") {
  try { localStorage.setItem(GATE_KEY, status); } catch {}
}
