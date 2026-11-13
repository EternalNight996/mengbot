import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createUnlockStore, formatUnlockCode, UnlockCodeError } from "./unlock.ts";

function keypair() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    privateKey,
    pem: publicKey.export({ type: "spki", format: "pem" }) as string,
  };
}

function code(privateKey: KeyObject, sku: string, id = "code-" + Math.random().toString(36).slice(2)) {
  const body = Buffer.from(JSON.stringify({ sku, id }), "utf8");
  return formatUnlockCode({ sku: sku as never, id }, sign(null, body, privateKey));
}

describe("unlock store", () => {
  it("activates a signed code and reports the SKU's caps", () => {
    const { privateKey, pem } = keypair();
    const dir = mkdtempSync(join(tmpdir(), "unlock-"));
    const unlock = createUnlockStore({ dataDir: dir, publicKeyPem: pem });
    expect(unlock.status().unlocked).toBe(false);
    expect(unlock.botCap()).toBe(null);

    const status = unlock.activate(code(privateKey, "extend-v1"));
    expect(status.unlocked).toBe(true);
    expect(status.caps.bots).toBe(10);
    expect(unlock.botCap()).toBe(10);
    expect(JSON.parse(readFileSync(join(dir, "unlock.json"), "utf8")).grants).toHaveLength(1);
  });

  it("refuses the same code twice on this computer", () => {
    const { privateKey, pem } = keypair();
    const unlock = createUnlockStore({ dataDir: mkdtempSync(join(tmpdir(), "unlock-")), publicKeyPem: pem });
    const same = code(privateKey, "extend-v1", "fixed-id-1234");
    unlock.activate(same);
    expect(() => unlock.activate(same)).toThrow(UnlockCodeError);
  });

  it("rejects a tampered code and keeps working with another key's code out", () => {
    const { privateKey } = keypair();
    const { pem } = keypair();
    const unlock = createUnlockStore({ dataDir: mkdtempSync(join(tmpdir(), "unlock-")), publicKeyPem: pem });
    expect(() => unlock.activate(code(privateKey, "extend-v1"))).toThrow(UnlockCodeError);
  });

  it("keeps grants across a restart", () => {
    const { privateKey, pem } = keypair();
    const dir = mkdtempSync(join(tmpdir(), "unlock-"));
    createUnlockStore({ dataDir: dir, publicKeyPem: pem }).activate(code(privateKey, "plus-lifetime"));
    const reopened = createUnlockStore({ dataDir: dir, publicKeyPem: pem });
    expect(reopened.botCap()).toBe(30);
    expect(reopened.status().grants[0]?.sku).toBe("plus-lifetime");
  });

  it("treats the supreme SKU as unlimited bots", () => {
    const { privateKey, pem } = keypair();
    const unlock = createUnlockStore({ dataDir: mkdtempSync(join(tmpdir(), "unlock-")), publicKeyPem: pem });
    unlock.activate(code(privateKey, "supreme-lifetime"));
    expect(unlock.botCap()).toBe("unlimited");
    expect(unlock.appsCap()).toBe("unlimited");
  });

  it("reports the task cap per SKU", () => {
    const { privateKey, pem } = keypair();
    const dir = mkdtempSync(join(tmpdir(), "unlock-"));
    const extend = createUnlockStore({ dataDir: dir, publicKeyPem: pem });
    extend.activate(code(privateKey, "extend-v1"));
    expect(extend.tasksCap()).toBe(20);
    const plus = createUnlockStore({ dataDir: mkdtempSync(join(tmpdir(), "unlock-")), publicKeyPem: pem });
    plus.activate(code(privateKey, "plus-lifetime"));
    expect(plus.tasksCap()).toBe("unlimited");
  });

  it("ignores a corrupt unlock file instead of refusing to start", () => {
    const dir = mkdtempSync(join(tmpdir(), "unlock-"));
    writeFileSync(join(dir, "unlock.json"), "{not json");
    const unlock = createUnlockStore({ dataDir: dir });
    expect(unlock.status().unlocked).toBe(false);
  });
});