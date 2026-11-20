import { describe, expect, it } from "vitest";
import { appLimitRefusal } from "./app-limit.ts";

const opts = (cap: number | "unlimited" | null, connected: string[], slug: string) => ({
  cap: () => cap,
  connected: async () => connected,
  slug,
});

describe("app limit", () => {
  it("lets anything through when nothing is unlocked or the unlock is unlimited", async () => {
    expect(await appLimitRefusal(opts(null, [], "gmail"))).toBe(null);
    expect(await appLimitRefusal(opts("unlimited", ["gmail"], "slack"))).toBe(null);
  });

  it("counts a new app against the cap", async () => {
    expect(await appLimitRefusal(opts(1, [], "gmail"))).toBe(null);
    const refused = await appLimitRefusal(opts(1, ["gmail"], "slack"));
    expect(refused?.code).toBe("app_limit");
    expect(refused?.error).toContain("1");
  });

  it("does not count a second account on an app already connected", async () => {
    expect(await appLimitRefusal(opts(1, ["gmail"], "gmail"))).toBe(null);
  });
});
