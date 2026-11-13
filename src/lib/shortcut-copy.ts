import { t } from "./i18n";
import type { LocaleKey } from "@/locales";
import type { ShortcutGroup } from "./keyboard-shortcuts";

/** The cheat sheet in the reader's language; any key we have not translated falls back to its English copy. */
export function localizedShortcutGroups(groups: readonly ShortcutGroup[]): ShortcutGroup[] {
  return groups.map((group) => ({
    ...group,
    category: t(`shortcuts.category.${group.id}` as LocaleKey),
    items: group.items.map((item) => ({
      ...item,
      description: t(`shortcuts.${item.id}` as LocaleKey),
    })),
  }));
}
