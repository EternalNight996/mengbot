import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CLOUD_ENTITLEMENT_FILE, planCapsFrom, readPlanCaps } from "./cloud-entitlement.ts";

const now = Date.parse("2026-11-10T00:00:00Z");
const active = { status: "active", expiresAt: now + 86_400_000, caps: { bots: 10, apps: 5 }, plan: "pro", tier: "pro" };

describe("cloud plan caps", () => {
  let dir = "";
  afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); dir = ""; });

  it("reads active caps, including unlimited", () => {
    expect(planCapsFrom(active, now)).toEqual({ bots: 10, apps: 5 });
    expect(planCapsFrom({ ...active, caps: { bots: null, apps: null } }, now)).toEqual({ bots: null, apps: null });
  });

  it("grants nothing for inactive, expired or malformed state", () => {
    expect(planCapsFrom({ ...active, status: "inactive" }, now)).toBeNull();
    expect(planCapsFrom({ ...active, expiresAt: now - 1 }, now)).toBeNull();
    expect(planCapsFrom({ ...active, caps: { bots: "ten", apps: 5 } }, now)).toBeNull();
    expect(planCapsFrom(null, now)).toBeNull();
  });

  it("reads the file the desktop writes", () => {
    dir = mkdtempSync(join(tmpdir(), "mengbot-caps-"));
    expect(readPlanCaps(dir, now)).toBeNull();
    writeFileSync(join(dir, CLOUD_ENTITLEMENT_FILE), JSON.stringify(active));
    expect(readPlanCaps(dir, now)).toEqual({ bots: 10, apps: 5 });
  });
});
