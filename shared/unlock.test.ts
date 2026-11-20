import { describe, expect, it } from "vitest";
import { capsForGrants, UNLOCK_SKUS, isUnlockSku } from "./unlock.ts";

const grant = (sku) => ({ sku, codeId: "x" + sku, activatedAt: "2026-01-01T00:00:00.000Z" });

describe("unlock caps", () => {
  it("has nothing when no grant is active", () => {
    expect(capsForGrants([])).toEqual({ bots: null, apps: null, tasks: null, devices: null });
  });

  it("uses the widest number each field sees", () => {
    expect(capsForGrants([grant("extend-v1")])).toEqual({ bots: 10, apps: 5, tasks: 20, devices: 1 });
    expect(capsForGrants([grant("extend-v1"), grant("plus-lifetime")])).toEqual({ bots: 30, apps: 20, tasks: null, devices: 3 });
  });

  it("treats a null cap as unlimited and leaves the field null", () => {
    expect(capsForGrants([grant("extend-v1"), grant("supreme-lifetime")])).toEqual({ bots: null, apps: null, tasks: null, devices: null });
  });

  it("names the three SKUs operators sell", () => {
    expect(Object.keys(UNLOCK_SKUS)).toEqual(["extend-v1", "plus-lifetime", "supreme-lifetime"]);
    expect(isUnlockSku("extend-v1")).toBe(true);
    expect(isUnlockSku("nope")).toBe(false);
  });
});