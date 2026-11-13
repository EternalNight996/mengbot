import { useEffect, useState, useSyncExternalStore } from "react";
import { loadLocale } from "@/lib/i18n";

export const LANGUAGE_KEY = "omb-language";

let sessionChoice: string | null | undefined;
let storedChoiceOffered = false;
const listeners = new Set<() => void>();

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

// Storage is per origin: this computer's page on each of its ports, My Cloud, a team and a saved server each have
// their own, so in the desktop app the choice lives in the app.
const desktop = () => globalThis.window?.ogb?.desktopLanguage;

function storedChoice(): string | null {
  try {
    return storage()?.getItem(LANGUAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

/** A pick saved in this page's storage before the app kept one becomes the app's pick. */
function desktopChoice(bridge: NonNullable<ReturnType<typeof desktop>>): string | null {
  const saved = bridge.choice();
  if (saved !== null || storedChoiceOffered) return saved;
  storedChoiceOffered = true;
  const earlier = storedChoice();
  if (earlier !== null) void bridge.set(earlier).catch(() => undefined);
  return earlier;
}

export function languageChoice(): string | null {
  if (sessionChoice !== undefined) return sessionChoice;
  const bridge = desktop();
  return bridge ? desktopChoice(bridge) : storedChoice();
}

export function effectiveLanguage(choice: string | null, serverDefault: string | undefined): string {
  return choice ?? serverDefault ?? "";
}

/** 中文为主：默认简体中文，繁体系统仍是繁体；英文界面需要在设置里主动选择（或配对页右上角切换）。 */
export function initialLanguage(tag: string | undefined): string {
  const language = (tag ?? "").toLowerCase();
  if (/^zh-(hant|tw|hk|mo)/.test(language)) return "zh-tw";
  return "zh";
}

function notify() {
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent) {
  if (event.key !== LANGUAGE_KEY && event.key !== null) return;
  if (event.storageArea && event.storageArea !== storage()) return;
  sessionChoice = undefined;
  notify();
}

function onDesktopChange() {
  sessionChoice = undefined;
  notify();
}

let stopDesktopChanges: (() => void) | undefined;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
    stopDesktopChanges = desktop()?.onChange(onDesktopChange);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
      stopDesktopChanges?.();
      stopDesktopChanges = undefined;
    }
  };
}

export function setLanguageChoice(language: string): void {
  sessionChoice = language;
  const bridge = desktop();
  if (bridge) {
    void bridge.set(language).catch(() => undefined);
    if (bridge.choice() === language) sessionChoice = undefined;
  }
  try {
    const local = storage();
    local?.setItem(LANGUAGE_KEY, language);
    if (!bridge && local?.getItem(LANGUAGE_KEY) === language) sessionChoice = undefined;
  } catch {
  }
  notify();
}

export function useLanguageChoice(): string | null {
  return useSyncExternalStore(subscribe, languageChoice, () => null);
}

/** The person's own language, loaded before a page first draws, so they never see another one first. */
export function loadPageLanguage(): Promise<string> {
  return loadLocale(effectiveLanguage(languageChoice(), undefined) || initialLanguage(globalThis.navigator?.language));
}

/** Shows `language` (the system's when empty) once its pack has loaded, and draws the caller again then. */
export function usePageLanguage(language: string): void {
  const [, setShown] = useState(0);
  useEffect(() => {
    void loadLocale(language || initialLanguage(globalThis.navigator?.language)).then(() => setShown((shown) => shown + 1));
  }, [language]);
}
