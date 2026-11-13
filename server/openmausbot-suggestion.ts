// A fresh install that finds an OpenMausBot data folder gets one quiet suggestion to bring it over.
import { join } from "node:path";
import { previewOpenMausBot } from "./openmausbot-import.ts";

export interface OpenMausBotSuggestion {
  source: string;
  bots: number;
}

/** Null unless this computer has almost no bots of its own and an OpenMausBot folder has some. */
export function suggestOpenMausBot(home: string, ownBots: number): OpenMausBotSuggestion | null {
  if (ownBots > 3) return null;
  for (const name of [".openmausbot", ".opengrokbot"]) {
    const preview = previewOpenMausBot(join(home, name));
    if (preview && preview.bots > 0) return { source: preview.source, bots: preview.bots };
  }
  return null;
}

let cached: { at: number; value: OpenMausBotSuggestion | null } | null = null;

/** The same answer for a minute: config status is read on every broadcast, the disk is not. */
export function memoOpenMausBotSuggestion(home: string, ownBots: number): OpenMausBotSuggestion | null {
  if (ownBots > 3) return null;
  const now = Date.now();
  if (cached && now - cached.at < 60_000) return cached.value;
  const value = suggestOpenMausBot(home, ownBots);
  cached = { at: now, value };
  return value;
}
