// The unlock's app cap, checked when a new app connection starts. Reconnecting an app that is
// already connected (a second account) is not a new app and never counts.
import type { AppConfig } from "./config.ts";
import type { UnlockStore } from "./unlock.ts";

export const APP_LIMIT_CODE = "app_limit";

export interface AppLimitRefusal {
  error: string;
  code: typeof APP_LIMIT_CODE;
}

export async function appLimitRefusal(opts: {
  cap(): number | "unlimited" | null;
  connected(): Promise<readonly string[]>;
  slug: string;
}): Promise<AppLimitRefusal | null> {
  const cap = opts.cap();
  if (cap === null || cap === "unlimited") return null;
  const connected = await opts.connected();
  if (connected.includes(opts.slug)) return null;
  if (connected.length < cap) return null;
  return {
    error: `当前套餐或解锁包含 ${cap} 个应用连接，已经用完。升级套餐或解锁可以连接更多应用。`,
    code: APP_LIMIT_CODE,
  };
}

export function appCapOf(unlock: Pick<UnlockStore, "appsCap">): number | "unlimited" | null {
  return unlock.appsCap();
}

export type { AppConfig };
