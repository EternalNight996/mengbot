import { describe, expect, it } from "vitest";

import en from "@/locales/en.json";
import zh from "@/locales/zh.json";

import { localize } from "./zh-hardcoded";

describe("localize", () => {
  it("never hands back the text it was given, so the page settles", () => {
    // Writing an unchanged value still fires the observer that calls this, which would spin on such a string forever.
    for (const [key, value] of Object.entries(en)) {
      if (typeof value !== "string" || !value.trim() || value.includes("{")) continue;
      const next = localize(value);
      if (next !== null) expect(next, key).not.toBe(value);
    }
  });

  it("translates what it has Chinese for", () => {
    expect(localize("Apps")).toBe("应用");
    expect(localize("Save")).toBe("保存");
    expect(localize("Worked for 12s")).toBe("用时 12 秒");
  });

  it("leaves Chinese, unknown and empty text alone", () => {
    expect(localize("应用")).toBeNull();
    expect(localize("Nothing to translate here")).toBeNull();
    expect(localize("   ")).toBeNull();
    expect(zh["sidebar.nav.apps"]).toBe("应用");
  });
});
