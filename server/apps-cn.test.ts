import { describe, expect, it } from "vitest";

import { CN_APPS, appsRegion } from "./apps-cn.ts";
import { listToolkits } from "./composio.ts";
import { setMarketAppsForTests } from "./market-apps.ts";

const withChinaRegion = async <T>(run: () => Promise<T>): Promise<T> => {
  const previous = process.env.OMB_APPS_REGION;
  process.env.OMB_APPS_REGION = "cn";
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env.OMB_APPS_REGION;
    else process.env.OMB_APPS_REGION = previous;
  }
};

describe("the China edition's app catalog", () => {
  it("is served from the bundle, with no duplicate app and a category on every card", () => {
    expect(new Set(CN_APPS.map((app) => app.slug)).size).toBe(CN_APPS.length);
    for (const app of CN_APPS) {
      expect(app.label.length, app.slug).toBeGreaterThan(0);
      expect(app.categories.length, app.slug).toBeGreaterThan(0);
      expect(app.logo, app.slug).toBeNull();
      expect(app.domain, app.slug).toBeNull();
      expect(app.region).toBe("cn");
    }
  });

  it("defaults to the overseas catalog unless OMB_APPS_REGION says cn", () => {
    expect(appsRegion({} as NodeJS.ProcessEnv)).toBe("global");
    expect(appsRegion({ OMB_APPS_REGION: " CN " } as NodeJS.ProcessEnv)).toBe("cn");
    expect(appsRegion({ OMB_APPS_REGION: "global" } as NodeJS.ProcessEnv)).toBe("global");
  });

  it("falls back to the bundled apps when the market catalog is unreachable", async () => {
    setMarketAppsForTests(async () => null);
    try {
      const catalog = await withChinaRegion(async () => listToolkits({} as never));
      expect(catalog.source).toBe("curated");
      expect(catalog.cards.map((card) => card.slug)).toEqual(CN_APPS.map((app) => app.slug));
      expect(catalog.cards.every((card) => card.region === "cn")).toBe(true);
    } finally {
      setMarketAppsForTests(null);
    }
  });

  it("serves the market site's own catalog when it publishes one", async () => {
    const market = [
      { slug: "feishu", label: "飞书", blurb: "市场站发布的应用", logo: null, domain: null, categories: ["communication"], region: "cn" as const },
    ];
    setMarketAppsForTests(async () => market);
    try {
      const catalog = await withChinaRegion(async () => listToolkits({} as never));
      expect(catalog.source).toBe("curated");
      expect(catalog.cards).toEqual(market);
    } finally {
      setMarketAppsForTests(null);
    }
  });
});
