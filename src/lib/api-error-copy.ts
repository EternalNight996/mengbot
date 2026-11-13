// Server refusals arrive as English prose. The ones with a stable shape are translated here, so a
// Chinese window does not show "forbidden: this change must come from the desktop app".
import { t } from "./i18n";
import type { LocaleKey } from "@/locales";

const RULES: Array<{ pattern: RegExp; key: LocaleKey; scope?: (match: RegExpMatchArray) => string }> = [
  { pattern: /^forbidden: this change must come from the desktop app/i, key: "api.error.desktopOnly" },
  { pattern: /^unauthorized: this session has expired/i, key: "api.error.sessionExpired" },
  { pattern: /^forbidden: this session lacks the (.+) scope/i, key: "api.error.missingScope", scope: (m) => m[1] ?? "" },
  { pattern: /^forbidden: loopback host required/i, key: "api.error.loopbackOnly" },
  { pattern: /^forbidden: cross-origin request/i, key: "api.error.crossOrigin" },
  { pattern: /^no such bot$/i, key: "api.error.noSuchBot" },
  { pattern: /^no such thread$/i, key: "api.error.noSuchThread" },
  { pattern: /Cloud home is asleep/i, key: "api.error.cloudAsleep" },
  { pattern: /^not found$/i, key: "api.error.notFound" },
  { pattern: /^Enter the address of the login page/i, key: "api.error.loginSite" },
  { pattern: /^Enter the password\.$/i, key: "api.error.loginPassword" },
  { pattern: /^Usernames and passwords can be at most \d+ characters\./i, key: "api.error.loginLong" },
  { pattern: /^That 2FA key is not valid/i, key: "api.error.loginTotp" },
  { pattern: /^Choose every bot, or bots that exist\./i, key: "api.error.loginBots" },
  { pattern: /^This login is in 1Password\./i, key: "api.error.loginReadOnly" },
  { pattern: /^forbidden: /i, key: "api.error.forbidden" },
  { pattern: /^unauthorized: /i, key: "api.error.unauthorized" },
];

/** The message to show for a refused request: a translation when its shape is known, otherwise the server's own words. */
export function apiErrorCopy(message: string): string {
  const text = message.trim();
  for (const rule of RULES) {
    const match = text.match(rule.pattern);
    if (!match) continue;
    return rule.scope ? t(rule.key, { scope: rule.scope(match) }) : t(rule.key);
  }
  return message;
}