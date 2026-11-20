// One-time unlock codes, verified offline. The signed payload says which SKU and carries a unique
// id; the activation is stored on this computer only, so a code cannot be used twice here.
import { createPublicKey, verify } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  UNLOCK_SKUS, capsForGrants, isUnlockSku,
  type RedeemPayload, type UnlockGrant, type UnlockStatus,
} from "../shared/unlock.ts";
import { UNLOCK_PUBLIC_KEY_PEM } from "./unlock-public-key.ts";

const CODE_PREFIX = "MBU1";

export class UnlockCodeError extends Error {}

export function formatUnlockCode(payload: RedeemPayload, signature: Uint8Array): string {
  return `${CODE_PREFIX}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${Buffer.from(signature).toString("base64url")}`;
}

/** The payload and signature a code carries; null when it is not shaped like one of ours. */
export function parseUnlockCode(code: string): { payload: RedeemPayload; signature: Uint8Array; signed: Uint8Array } | null {
  const parts = code.trim().split(".");
  if (parts.length !== 3 || parts[0] !== CODE_PREFIX) return null;
  try {
    const signed = Buffer.from(parts[1]!, "base64url");
    const payload = JSON.parse(signed.toString("utf8")) as RedeemPayload;
    if (!payload || typeof payload.id !== "string" || payload.id.length < 4 || !isUnlockSku(String(payload.sku))) return null;
    return { payload, signature: new Uint8Array(Buffer.from(parts[2]!, "base64url")), signed: new Uint8Array(signed) };
  } catch {
    return null;
  }
}

export function verifyUnlockCode(code: string, publicKeyPem: string = UNLOCK_PUBLIC_KEY_PEM): RedeemPayload {
  const parsed = parseUnlockCode(code);
  if (!parsed) throw new UnlockCodeError("这不是有效的解锁码，请检查是否完整。");
  const key = createPublicKey(publicKeyPem);
  if (!verify(null, parsed.signed, key, parsed.signature)) {
    throw new UnlockCodeError("解锁码的签名不对，可能被修改或不是我们发出的。");
  }
  return parsed.payload;
}

interface UnlockFile { grants: UnlockGrant[] }

export interface UnlockStore {
  status(): UnlockStatus;
  activate(code: string): UnlockStatus;
  /** The most bots an unlock allows: a number, "unlimited", or null when nothing is unlocked. */
  botCap(): number | "unlimited" | null;
  appsCap(): number | "unlimited" | null;
  tasksCap(): number | "unlimited" | null;
}

export function createUnlockStore(deps: {
  dataDir: string;
  publicKeyPem?: string;
  now?: () => Date;
}): UnlockStore {
  const file = join(deps.dataDir, "unlock.json");
  const now = deps.now ?? (() => new Date());
  let grants: UnlockGrant[] = [];
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<UnlockFile>;
    if (Array.isArray(parsed.grants)) {
      grants = parsed.grants.filter((grant): grant is UnlockGrant =>
        !!grant && isUnlockSku(String(grant.sku)) && typeof grant.codeId === "string" && typeof grant.activatedAt === "string");
    }
  } catch {
    grants = [];
  }

  const persist = () => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ grants } satisfies UnlockFile, null, 2) + "\n", { mode: 0o600 });
  };

  const status = (): UnlockStatus => {
    const caps = capsForGrants(grants);
    return { unlocked: grants.length > 0, grants: [...grants], caps };
  };

  return {
    status,
    activate(code: string) {
      const payload = verifyUnlockCode(code, deps.publicKeyPem);
      if (grants.some((grant) => grant.codeId === payload.id)) {
        throw new UnlockCodeError("这个解锁码已经在本机激活过了。");
      }
      grants = [...grants, { sku: payload.sku, codeId: payload.id, activatedAt: now().toISOString() }];
      persist();
      return status();
    },
    botCap() {
      const caps = capsForGrants(grants);
      if (!grants.length) return null;
      return caps.bots === null ? "unlimited" : caps.bots;
    },
    appsCap() {
      const caps = capsForGrants(grants);
      if (!grants.length) return null;
      return caps.apps === null ? "unlimited" : caps.apps;
    },
    tasksCap() {
      const caps = capsForGrants(grants);
      if (!grants.length) return null;
      return caps.tasks === null ? "unlimited" : caps.tasks;
    },
  };
}

export function unlockSkuLabel(sku: string): string {
  return isUnlockSku(sku) ? UNLOCK_SKUS[sku].label : sku;
}