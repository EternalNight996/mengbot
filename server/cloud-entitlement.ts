// The desktop client writes the Cloud plan's caps into its data dir when the account state changes; the local
// server reads that file when a bot or app is added. A missing, expired or malformed file grants nothing.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface PlanCaps {
  bots: number | null;
  apps: number | null;
}

export const CLOUD_ENTITLEMENT_FILE = "cloud-entitlement.json";

function capValue(value: unknown): number | null | undefined {
  if (value === null) return null;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

export function planCapsFrom(value: unknown, now = Date.now()): PlanCaps | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as { status?: unknown; expiresAt?: unknown; caps?: unknown };
  if (record.status !== "active") return null;
  if (typeof record.expiresAt !== "number" || !Number.isFinite(record.expiresAt) || record.expiresAt <= now) return null;
  if (!record.caps || typeof record.caps !== "object" || Array.isArray(record.caps)) return null;
  const caps = record.caps as { bots?: unknown; apps?: unknown };
  const bots = capValue(caps.bots);
  const apps = capValue(caps.apps);
  if (bots === undefined || apps === undefined) return null;
  return { bots, apps };
}

export function readPlanCaps(dataDir: string, now = Date.now()): PlanCaps | null {
  try {
    return planCapsFrom(JSON.parse(readFileSync(join(dataDir, CLOUD_ENTITLEMENT_FILE), "utf8")), now);
  } catch {
    return null;
  }
}

export function writePlanCaps(dataDir: string, value: unknown): void {
  // Callers pass the entitlement from the Cloud session; planCapsFrom is the gate before it is written.
  if (!planCapsFrom(value)) return;
  const record = value as { status: string; expiresAt: number; caps: PlanCaps; tier?: string; plan?: string };
  const body = { status: record.status, expiresAt: record.expiresAt, caps: record.caps, plan: record.plan, tier: record.tier };
  writeFileSync(join(dataDir, CLOUD_ENTITLEMENT_FILE), JSON.stringify(body) + "\n", { mode: 0o600 });
}
