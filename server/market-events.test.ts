import { mkdtempSync } from "node:fs";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { librarySourceSlug, marketActor, marketEventsUrl, reportMarketEvent } from "./market-events.ts";

const jsonResponse = (status = 201): Response =>
  new Response(JSON.stringify({ ok: true }), { status, headers: { "content-type": "application/json" } });

describe("the market event reporter", () => {
  it("posts to the unified API and honours OMB_MARKET_API_BASE", () => {
    expect(marketEventsUrl({} as NodeJS.ProcessEnv)).toBe("https://api.mengbot.com.cn/api/v1/market/events");
    expect(marketEventsUrl({ OMB_MARKET_API_BASE: "https://mirror.test/" } as NodeJS.ProcessEnv)).toBe(
      "https://mirror.test/api/v1/market/events",
    );
  });

  it("keeps one anonymous actor per install", () => {
    const dir = mkdtempSync(join(tmpdir(), "market-actor-"));
    const first = marketActor(dir);
    expect(first).toBeTruthy();
    expect(marketActor(dir)).toBe(first);
    expect(readFileSync(join(dir, "market-actor"), "utf8").trim()).toBe(first);
  });

  it("reports a view with the actor, the desktop client and the version", async () => {
    const dir = mkdtempSync(join(tmpdir(), "market-report-"));
    const fetcher = vi.fn(async () => jsonResponse());
    const accepted = await reportMarketEvent({
      dataDir: dir,
      event: { type: "teams", id: "seo-growth", kind: "view" },
      version: "0.1.182",
      fetcher: fetcher as unknown as typeof fetch,
    });
    expect(accepted).toBe(true);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.mengbot.com.cn/api/v1/market/events");
    expect(JSON.parse(String(init.body))).toMatchObject({ type: "teams", id: "seo-growth", kind: "view", client: "desktop", version: "0.1.182" });
    expect(JSON.parse(String(init.body)).actor).toHaveLength(32);
  });

  it("stays silent when the market is unreachable or refuses", async () => {
    const dir = mkdtempSync(join(tmpdir(), "market-report-"));
    const down = vi.fn(async () => { throw new TypeError("fetch failed"); });
    await expect(reportMarketEvent({ dataDir: dir, event: { type: "teams", id: "x", kind: "install" }, fetcher: down as unknown as typeof fetch })).resolves.toBe(false);
    const refused = vi.fn(async () => jsonResponse(429));
    await expect(reportMarketEvent({ dataDir: dir, event: { type: "teams", id: "x", kind: "install" }, fetcher: refused as unknown as typeof fetch })).resolves.toBe(false);
  });
});

describe("the import's source parameter", () => {
  it("names a library template only for a valid slug", () => {
    expect(librarySourceSlug("library:seo-growth")).toBe("seo-growth");
    expect(librarySourceSlug("library:100x-marketing")).toBe("100x-marketing");
    expect(librarySourceSlug("library:../etc")).toBeNull();
    expect(librarySourceSlug("library:")).toBeNull();
    expect(librarySourceSlug("file")).toBeNull();
    expect(librarySourceSlug(null)).toBeNull();
  });
});
