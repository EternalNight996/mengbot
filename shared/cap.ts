// A cap is a number, "unlimited", or null when the source does not set one. The effective cap is the most
// generous of the unlocked and subscribed limits: an unlock is a one-time purchase, a plan is recurring.
export type Cap = number | "unlimited" | null;

export function mergeCaps(...caps: Cap[]): Cap {
  if (caps.includes("unlimited")) return "unlimited";
  const numbers = caps.filter((cap): cap is number => typeof cap === "number" && Number.isFinite(cap));
  return numbers.length ? Math.max(...numbers) : null;
}

export function capFromPlan(caps: { bots: number | null; apps: number | null } | null, kind: "bots" | "apps"): Cap {
  if (!caps) return null;
  const value = caps[kind];
  return value === null ? "unlimited" : value;
}
