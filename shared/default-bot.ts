import type { HelperFollowupField } from "./helper-followup.ts";
import type { MengColor } from "./wire.ts";

/** MengBot: every person's built-in helper. A new install's first bot (its Chief of Staff too); an existing place or
 * person without one is given one once. It can be renamed and recoloured, hidden from the sidebar, never deleted. */
export const DEFAULT_BOT_NAME = "小梦";
export const DEFAULT_BOT_NAME_EN = "MengBot";

/** The built-in helper's name in the app's language: Chinese in Chinese (and before a language is saved), English everywhere else. */
export function defaultBotName(language?: string): string {
  if (!language?.trim()) return DEFAULT_BOT_NAME;
  return /^zh(?:-|$)/i.test(language.trim()) ? DEFAULT_BOT_NAME : DEFAULT_BOT_NAME_EN;
}
export const DEFAULT_BOT_COLOR: MengColor = "chrome";

export interface DefaultBotMark {
  /** Team Cloud only: the lowercased email of the member this MengBot belongs to. Absent: the place's own. */
  person?: string;
}

export interface DefaultBotFields {
  /** This bot is its place's (or, on a Team Cloud, its member's) MengBot. Never deleted or archived. */
  defaultBot?: DefaultBotMark;
  /** Settings → General "Show MengBot in the sidebar" is off: the bot keeps working, only its sidebar row is gone. */
  sidebarHidden?: boolean;
  /** Its person has seen MengBot's first-launch welcome here and chose Add or Not now. */
  welcomed?: boolean;
}

export interface HelperIntroField extends HelperFollowupField {
  /** MengBot's introduction. Clients that know it say it in the viewer's language with example asks; `text` is the
   * English fallback the model and older clients read. */
  helperIntro?: true;
}

export const defaultBotPerson = (bot: DefaultBotFields): string => bot.defaultBot?.person?.trim().toLowerCase() ?? "";

/** The MengBot a viewer sees as theirs: their own on a Team Cloud (by email), else the place's. */
export function viewersDefaultBot<T extends DefaultBotFields>(bots: readonly T[], email?: string | null): T | undefined {
  const person = email?.trim().toLowerCase() ?? "";
  return (person ? bots.find((bot) => bot.defaultBot && defaultBotPerson(bot) === person) : undefined)
    ?? bots.find((bot) => bot.defaultBot && !defaultBotPerson(bot));
}
