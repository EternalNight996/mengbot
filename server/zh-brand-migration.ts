import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setupChoices } from "./initial-greeting.ts";
import { isEnglishPickedName, pickBotName } from "./names.ts";
import { ZH_BOT_DESCRIPTIONS, ZH_BOT_NAMES, ZH_BOT_TITLES } from "../shared/zh-names.ts";
import type { Store } from "./store.ts";

const MARKER = "zh-bot-names-v4.json";
const GROUP_NAMES: Record<string, string> = {
  "Pickle & co.": "小泡协作组",
  "Zephyr & co.": "小风协作组",
};
const ENGLISH_CHOICES = [
  "Research and digging into topics",
  "Keeping an eye on things for me",
  "Email, calendar and messages",
  "Bookings, shopping and errands",
  "Data, spreadsheets and reports",
];

const chineseGreeting = (botName: string, person?: string): string => `嗨${person ? ` ${person}` : ""}，我是 ${botName}。你想让我做什么？`;

/** Renames the built-in helper, ready-made bots and untouched default names to Chinese, and rewrites greeting cards written before Chinese existed. */
export function applyChineseBotNames(store: Store, dataDir: string, language?: string): void {
  if (language?.trim() && !/^zh(?:-|$)/i.test(language.trim())) return;
  const marker = join(dataDir, MARKER);
  if (existsSync(marker)) return;

  const taken = new Set(store.bots.map((bot) => bot.name.trim().toLowerCase()));
  const renamed = new Map<string, string>();
  for (const bot of store.bots.slice()) {
    const known = ZH_BOT_NAMES[bot.name];
    const picked = !known && isEnglishPickedName(bot.name) ? pickBotName(taken, "zh") : undefined;
    const name = known ?? picked;
    const patch: { name?: string; title?: string; description?: string } = {};
    if (name && name !== bot.name) {
      patch.name = name;
      taken.delete(bot.name.trim().toLowerCase());
      taken.add(name.trim().toLowerCase());
      renamed.set(bot.name, name);
    }
    const title = ZH_BOT_TITLES[bot.title];
    if (title && title !== bot.title) patch.title = title;
    const description = ZH_BOT_DESCRIPTIONS[bot.description];
    if (description && description !== bot.description) patch.description = description;
    if (Object.keys(patch).length > 0) store.patchBot(bot.id, patch);
  }

  for (const bot of store.bots.slice()) {
    const threads = [bot.threadId, ...(bot.tasks ?? []).map((task) => task.threadId)];
    for (const threadId of threads) {
      for (const message of store.messagesFor(threadId)) {
        const text = message.text ?? "";
        if (message.role === "user" && message.setupRequest) {
          const index = ENGLISH_CHOICES.indexOf(text);
          const picked = index >= 0 ? setupChoices("zh")[index] : undefined;
          if (picked) store.patchMessage(threadId, message.id, { text: picked });
          continue;
        }
        if (message.role !== "bot") continue;
        const match = /^Hi(?: ([^,]+))?, I'm .+?\. What would you like me to do\?$/.exec(text);
        const choicesAreEnglish = Array.isArray(message.setupChoices)
          && message.setupChoices.length === ENGLISH_CHOICES.length
          && message.setupChoices.every((choice, index) => choice === ENGLISH_CHOICES[index]);
        if (!match && !choicesAreEnglish) continue;
        store.patchMessage(threadId, message.id, {
          ...(match ? { text: chineseGreeting(bot.name, match[1]) } : {}),
          ...(choicesAreEnglish ? { setupChoices: setupChoices("zh") } : {}),
        });
      }
    }
  }

  const groupsFile = join(dataDir, "groups.json");
  const groupName = (name: string): string | undefined => {
    if (GROUP_NAMES[name]) return GROUP_NAMES[name];
    const suffix = " & co.";
    if (!name.endsWith(suffix)) return undefined;
    const next = renamed.get(name.slice(0, -suffix.length));
    return next ? `${next}协作组` : undefined;
  };
  for (const group of store.groups) {
    const next = groupName(group.name);
    if (next) group.name = next;
  }
  if (existsSync(groupsFile)) {
    try {
      const groups = JSON.parse(readFileSync(groupsFile, "utf8")) as Array<{ name?: string }>;
      let changed = false;
      for (const group of groups) {
        const next = groupName(group.name ?? "");
        if (next) {
          group.name = next;
          changed = true;
        }
      }
      if (changed) writeFileSync(groupsFile, JSON.stringify(groups));
    } catch {
      // The in-memory rename still applies for this run; a malformed file is left untouched.
    }
  }
  writeFileSync(marker, JSON.stringify({ version: 3, at: Date.now() }));
}
