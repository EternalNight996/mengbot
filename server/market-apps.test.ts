import { describe, expect, it, vi } from "vitest";

import { loadMarketApps, marketAppsUrl, parseMarketApiApps, parseMarketApps, setMarketAppsForTests } from "./market-apps.ts";

const payload = [
  { slug: "feishu", label: "飞书", blurb: "消息、日历与云文档", categories: ["communication", "productivity"] },
  { slug: "wecom", label: "企业微信", blurb: "通讯录与群消息", categories: ["communication"] },
];

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("the market app catalog", () => {
  it("defaults to the unified API and honours OMB_MARKET_API_BASE", () => {
    expect(marketAppsUrl({} as NodeJS.ProcessEnv)).toBe("https://api.mengbot.com.cn/api/v1/market/items?type=apps&pageSize=100&region=cn");
    expect(marketAppsUrl({ OMB_MARKET_API_BASE: "https://mirror.example.test/" } as NodeJS.ProcessEnv)).toBe(
      "https://mirror.example.test/api/v1/market/items?type=apps&pageSize=100&region=cn",
    );
  });

  it("reads the API's catalog shape and maps it to cards", async () => {
    const cards = parseMarketApiApps({ items: [
      { type: "apps", id: "feishu", title: "飞书", summary: "消息、日历与云文档", tags: ["communication", "productivity"] },
      { type: "apps", id: "wecom", title: "企业微信", summary: "通讯录与群消息", tags: ["communication"] },
    ] });
    expect(cards).toEqual(payload.map((app) => ({ ...app, logo: null, domain: null, region: "cn" })));
  });

  it("maps entries to the bundled card shape", () => {
    expect(parseMarketApps(payload)).toEqual([
      { slug: "feishu", label: "飞书", blurb: "消息、日历与云文档", logo: null, domain: null, categories: ["communication", "productivity"], region: "cn" },
      { slug: "wecom", label: "企业微信", blurb: "通讯录与群消息", logo: null, domain: null, categories: ["communication"], region: "cn" },
    ]);
  });

  it("rejects an invalid catalog before it reaches the panel", () => {
    expect(() => parseMarketApps({})).toThrow("invalid");
    expect(() => parseMarketApps([])).toThrow("invalid");
    expect(() => parseMarketApps([{ slug: "Bad Slug", label: "x", blurb: "y" }])).toThrow("slug");
    expect(() => parseMarketApps([{ slug: "feishu", label: "", blurb: "y" }])).toThrow("label");
    expect(() => parseMarketApps([...payload, { slug: "feishu", label: "x", blurb: "y" }])).toThrow("slug");
  });

  it("reads the market file once and serves the cached copy", async () => {
    setMarketAppsForTests(null);
    const fetcher = vi.fn(async () => jsonResponse(payload));
    const first = await loadMarketApps({ fetcher: fetcher as unknown as typeof fetch, now: 1_000 });
    const second = await loadMarketApps({ fetcher: fetcher as unknown as typeof fetch, now: 61_000 });
    expect(first?.map((card) => card.slug)).toEqual(["feishu", "wecom"]);
    expect(second).toEqual(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns null so the caller falls back to the bundle", async () => {
    setMarketAppsForTests(null);
    expect(await loadMarketApps({ fetcher: (async () => jsonResponse({}, 404)) as unknown as typeof fetch, now: 1 })).toBeNull();
    expect(await loadMarketApps({ fetcher: (async () => jsonResponse([{ slug: "Bad Slug", label: "x", blurb: "y" }])) as unknown as typeof fetch, now: 2 })).toBeNull();
    expect(
      await loadMarketApps({ fetcher: (async () => { throw new TypeError("network down"); }) as unknown as typeof fetch, now: 3 }),
    ).toBeNull();
  });
});
