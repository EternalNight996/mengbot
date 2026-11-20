// Read before main.tsx's first-paint writes: applySkin stamps mb-skin on every boot.
const PRIOR_RUN_KEYS = ["mb-skin", "mb-installed", "mb-email-gate", "mb-drafts", "mb-show-threads"];

export function hasPriorRun(store: Pick<Storage, "getItem"> | undefined): boolean {
  try {
    return PRIOR_RUN_KEYS.some((key) => store?.getItem(key) != null);
  } catch {
    return false;
  }
}
