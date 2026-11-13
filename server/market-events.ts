// The desktop app's side of the market's counters. Opening a template page counts a view and a finished import
// counts an install; the market stores them next to the web's own counts. Reporting is fire and forget: the window
// never waits for the market and a market outage stays silent.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_MARKET_API = "https://api.mengbot.com.cn";
const FETCH_TIMEOUT_MS = 5_000;

export function marketApiBase(environment: NodeJS.ProcessEnv = process.env): string {
  return (environment.OMB_MARKET_API_BASE?.trim() || DEFAULT_MARKET_API).replace(/\/+$/, "");
}

export function marketEventsUrl(environment: NodeJS.ProcessEnv = process.env): string {
  return `${marketApiBase(environment)}/api/v1/market/events`;
}

/** This install's anonymous id, kept in the data directory so a repeated action still counts once. */
export function marketActor(dataDir: string): string | null {
  const file = join(dataDir, "market-actor");
  try {
    if (existsSync(file)) {
      const existing = readFileSync(file, "utf8").trim();
      if (existing) return existing;
    }
    const created = createHash("sha256").update(`${process.pid}-${Date.now()}-${Math.random()}`).digest("hex").slice(0, 32);
    writeFileSync(file, created + "\n", { mode: 0o600 });
    return created;
  } catch {
    return null;
  }
}

export type MarketEventKind = "view" | "like" | "install";
export type MarketEventType = "skills" | "apps" | "mcp" | "teams" | "staff";

export interface MarketEvent {
  type: MarketEventType;
  id: string;
  kind: MarketEventKind;
}

export interface ReportInput {
  dataDir: string;
  event: MarketEvent;
  version?: string;
  fetcher?: typeof fetch;
  environment?: NodeJS.ProcessEnv;
}

/** Report one interaction. Resolves true when the market accepted it; never rejects. */
export async function reportMarketEvent(input: ReportInput): Promise<boolean> {
  const fetcher = input.fetcher ?? fetch;
  const actor = marketActor(input.dataDir);
  try {
    const response = await fetcher(marketEventsUrl(input.environment), {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        type: input.event.type,
        id: input.event.id,
        kind: input.event.kind,
        ...(actor ? { actor } : {}),
        client: "desktop",
        ...(input.version ? { version: input.version } : {}),
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Fire and forget: the caller answers the window now and the report settles on its own. */
export function reportMarketEventInBackground(input: ReportInput): void {
  void reportMarketEvent(input);
}

/** `source=library:<slug>` on the import request names the template the person installed. */
export function librarySourceSlug(source: string | null | undefined): string | null {
  const value = (source ?? "").trim();
  if (!value.startsWith("library:")) return null;
  const slug = value.slice("library:".length).trim();
  return /^[a-z0-9][a-z0-9-]*$/.test(slug) ? slug : null;
}
