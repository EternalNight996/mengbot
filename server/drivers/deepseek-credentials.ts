import { chmodSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import { harnessHome } from "../env-path.ts";
import { writeFileAtomic } from "../atomic.ts";

export const DEEPSEEK_ACCOUNT_KEY = "deepseek-account-platform/default";
export const DEEPSEEK_DEVICE_KEY = "deepseek-account-platform/device";

type CredentialRecord = Record<string, unknown> & { kind?: unknown; payload?: unknown };
type CredentialStore = { version: 1; refs: Record<string, string>; records: Record<string, CredentialRecord> };

export function dshHome(env: Record<string, string | undefined>): string {
  return env.DSH_HOME || harnessHome("dsh", env);
}

export function deepSeekCredentialsFile(env: Record<string, string | undefined>): string {
  return join(dshHome(env), ".credentials.yaml");
}

function emptyStore(): CredentialStore {
  return { version: 1, refs: {}, records: {} };
}

function readStore(env: Record<string, string | undefined>): CredentialStore {
  const file = deepSeekCredentialsFile(env);
  if (!existsSync(file)) return emptyStore();
  const text = readFileSync(file, "utf8");
  if (!text.trim()) return emptyStore();
  let root: unknown;
  try {
    root = parseYaml(text);
  } catch {
    throw new Error(`DeepSeek Harness credentials could not be read (${file}). Fix or remove that file, then try again.`);
  }
  if (!root || typeof root !== "object" || Array.isArray(root)) {
    throw new Error(`DeepSeek Harness credentials are not a mapping (${file}).`);
  }
  const fields = root as Record<string, unknown>;
  if (fields.version !== 1) {
    throw new Error(`DeepSeek Harness credentials use an unsupported layout (${file}). Open DeepSeek Harness once to upgrade it.`);
  }
  const refs: Record<string, string> = {};
  const rawRefs = fields.refs;
  if (rawRefs !== undefined && rawRefs !== null) {
    if (typeof rawRefs !== "object" || Array.isArray(rawRefs)) throw new Error(`DeepSeek Harness credentials refs are invalid (${file}).`);
    for (const [key, value] of Object.entries(rawRefs)) if (typeof value === "string") refs[key] = value;
  }
  const records: Record<string, CredentialRecord> = {};
  const rawRecords = fields.records;
  if (rawRecords !== undefined && rawRecords !== null) {
    if (typeof rawRecords !== "object" || Array.isArray(rawRecords)) throw new Error(`DeepSeek Harness credentials records are invalid (${file}).`);
    for (const [key, value] of Object.entries(rawRecords)) {
      if (value && typeof value === "object" && !Array.isArray(value)) records[key] = value as CredentialRecord;
    }
  }
  return { version: 1, refs, records };
}

function writeStore(env: Record<string, string | undefined>, store: CredentialStore): void {
  const file = deepSeekCredentialsFile(env);
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  writeFileAtomic(file, stringifyYaml({ version: 1, refs: store.refs, records: store.records }), { mode: 0o600, durable: true });
  try {
    chmodSync(file, 0o600);
  } catch {
    // Windows does not model POSIX permission bits; the per-user profile directory is the boundary there.
  }
}

function recordToken(record: CredentialRecord | undefined): string | undefined {
  if (!record || record.kind !== "grant") return undefined;
  const payload = record.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const token = (payload as Record<string, unknown>).token;
  return typeof token === "string" && token.length > 0 ? token : undefined;
}

/** Whether DeepSeek Harness holds a DeepSeek Platform account grant for this home. */
export function hasDeepSeekAccount(env: Record<string, string | undefined>): boolean {
  try {
    return recordToken(readStore(env).records[DEEPSEEK_ACCOUNT_KEY]) !== undefined;
  } catch {
    return false;
  }
}

export function deepSeekAccountToken(env: Record<string, string | undefined>): string | undefined {
  try {
    return recordToken(readStore(env).records[DEEPSEEK_ACCOUNT_KEY]);
  } catch {
    return undefined;
  }
}

/** Save the account grant in the format the Harness credential store reads, preserving every other entry. */
export function saveDeepSeekAccountGrant(env: Record<string, string | undefined>, token: string, issuer: string): void {
  const store = readStore(env);
  store.records[DEEPSEEK_ACCOUNT_KEY] = { kind: "grant", payload: { version: 1, token, issuer } };
  writeStore(env, store);
}

export function clearDeepSeekAccountGrant(env: Record<string, string | undefined>): void {
  const store = readStore(env);
  if (!(DEEPSEEK_ACCOUNT_KEY in store.records)) return;
  delete store.records[DEEPSEEK_ACCOUNT_KEY];
  writeStore(env, store);
}

/** The stable device id the Platform grant flow attaches to an installation. */
export function deepSeekDeviceId(env: Record<string, string | undefined>, create: () => string): string {
  const store = readStore(env);
  const record = store.records[DEEPSEEK_DEVICE_KEY];
  const payload = record?.kind === "grant" && record.payload && typeof record.payload === "object" && !Array.isArray(record.payload)
    ? (record.payload as Record<string, unknown>)
    : undefined;
  const existing = payload?.id;
  if (typeof existing === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existing)) return existing;
  const id = create();
  store.records[DEEPSEEK_DEVICE_KEY] = { kind: "grant", payload: { id } };
  writeStore(env, store);
  return id;
}
