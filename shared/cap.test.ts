import { describe, expect, it } from "vitest";
import { capFromPlan, mergeCaps } from "../shared/cap.ts";

describe("cap merge", () => {
  it("takes the most generous of unlock and plan", () => {
    expect(mergeCaps(5, 10)).toBe(10);
    expect(mergeCaps(10, 5)).toBe(10);
    expect(mergeCaps(null, 5)).toBe(5);
    expect(mergeCaps(null, null)).toBeNull();
    expect(mergeCaps(5, "unlimited")).toBe("unlimited");
  });

  it("reads one side of a plan's caps", () => {
    expect(capFromPlan({ bots: 10, apps: 3 }, "bots")).toBe(10);
    expect(capFromPlan({ bots: null, apps: null }, "apps")).toBe("unlimited");
    expect(capFromPlan(null, "bots")).toBeNull();
  });
});
