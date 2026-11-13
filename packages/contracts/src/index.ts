// Shared contracts for every MengBot layer: unlock SKUs, prices, order shapes.
// Keep this package dependency-free so it can be imported by the desktop app, the
// service, the admin BFF and the cloud runtime without pulling a framework in.

export const UNLOCK_SKUS = {
  "extend-v1": { label: "扩展解锁", priceFen: 900, bots: 10, apps: 5, tasks: 20, devices: 1 },
  "plus-lifetime": { label: "进阶永久", priceFen: 9900, bots: 30, apps: 20, tasks: null, devices: 3 },
  "supreme-lifetime": { label: "至尊永久", priceFen: 29900, bots: null, apps: null, tasks: null, devices: null },
} as const;

export type UnlockSku = keyof typeof UNLOCK_SKUS;

export interface UnlockGrant {
  sku: UnlockSku;
  codeId: string;
  activatedAt: string;
}

export interface UnlockCaps {
  bots: number | null;
  apps: number | null;
  tasks: number | null;
  devices: number | null;
}

export interface UnlockStatus {
  unlocked: boolean;
  grants: UnlockGrant[];
  caps: UnlockCaps;
}

export const NO_UNLOCK_CAPS: UnlockCaps = { bots: null, apps: null, tasks: null, devices: null };

export function capsForGrants(grants: readonly UnlockGrant[]): UnlockCaps {
  const keys = ["bots", "apps", "tasks", "devices"] as const;
  const unlimited = { bots: false, apps: false, tasks: false, devices: false };
  const numbers = { bots: null as number | null, apps: null as number | null, tasks: null as number | null, devices: null as number | null };
  for (const grant of grants) {
    const sku = UNLOCK_SKUS[grant.sku];
    if (!sku) continue;
    for (const key of keys) {
      const value = sku[key];
      if (value === null) unlimited[key] = true;
      else numbers[key] = Math.max(numbers[key] ?? 0, value);
    }
  }
  const caps: UnlockCaps = { ...NO_UNLOCK_CAPS };
  for (const key of keys) caps[key] = unlimited[key] ? null : (numbers[key] ?? null);
  return caps;
}

export function isUnlockSku(value: string): value is UnlockSku {
  return Object.prototype.hasOwnProperty.call(UNLOCK_SKUS, value);
}

export interface RedeemPayload {
  sku: UnlockSku;
  id: string;
}

/** One-time unlock prices in fen, derived from the SKU table. */
export const SKU_PRICES_FEN: Record<UnlockSku, number> = {
  "extend-v1": UNLOCK_SKUS["extend-v1"].priceFen,
  "plus-lifetime": UNLOCK_SKUS["plus-lifetime"].priceFen,
  "supreme-lifetime": UNLOCK_SKUS["supreme-lifetime"].priceFen,
};

export type PayKind = "unlock" | "subscription";

export type PayOrderStatus = "new" | "review" | "paid" | "expired" | "refunded";

export interface SubscriptionPlan {
  id: string;
  name: string;
  priceFen: number;
  /** How long one payment keeps the plan. */
  days: number;
  bots: number | null;
  apps: number | null;
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  "sub-personal": { id: "sub-personal", name: "MengBot 个人版（月付）", priceFen: 3900, days: 30, bots: 10, apps: 3 },
  "sub-pro": { id: "sub-pro", name: "MengBot 个人 Pro（月付）", priceFen: 7900, days: 30, bots: 10, apps: 5 },
  "sub-max": { id: "sub-max", name: "MengBot Max（月付）", priceFen: 32900, days: 30, bots: null, apps: null },
};

export interface OrderSummary {
  id: string;
  sku: string;
  kind: PayKind;
  priceFen: number;
  status: PayOrderStatus;
  phone?: string;
  code?: string;
  createdAt: string;
}
