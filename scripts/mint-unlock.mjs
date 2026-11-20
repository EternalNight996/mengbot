#!/usr/bin/env node
// Mint one-time unlock codes. The private key lives outside the repo (default ~/.mengbot/unlock-key.pem),
// so codes can only be made on the machine that holds it.
import { createPrivateKey, generateKeyPairSync, sign } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DIR = join(homedir(), ".mengbot");
const KEY = join(DIR, "unlock-key.pem");
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const SKUS = { "extend-v1": "extend", "plus-lifetime": "plus", "supreme-lifetime": "supreme" };

if (args.includes("--init")) {
  mkdirSync(DIR, { recursive: true });
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  writeFileSync(KEY, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
  const raw = publicKey.export({ type: "spki", format: "der" }).subarray(-32).toString("base64");
  writeFileSync(join(DIR, "unlock-key.pub"), raw);
  console.log("私钥：" + KEY);
  console.log("公钥（写入 server/unlock-public-key.ts）：" + raw);
  process.exit(0);
}

const sku = arg("--sku", "extend-v1");
if (!SKUS[sku]) {
  console.error("未知 SKU：" + sku + "；可用：" + Object.keys(SKUS).join(", "));
  process.exit(1);
}
if (!existsSync(KEY)) {
  console.error("缺少私钥 " + KEY + "，先运行 node scripts/mint-unlock.mjs --init");
  process.exit(1);
}
const count = Number(arg("--count", "1"));
const prefix = arg("--prefix", "MB");
const privateKey = createPrivateKey(readFileSync(KEY, "utf8"));
const code = (payload) => {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  const signature = sign(null, body, privateKey);
  return "MBU1." + body.toString("base64url") + "." + signature.toString("base64url");
};
const lines = [];
for (let i = 0; i < count; i++) {
  const id = prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  lines.push(code({ sku, id }));
}
const text = lines.join("\n") + "\n";
const out = arg("--out", "");
if (out) writeFileSync(out, text, { mode: 0o600 });
console.log(text.trim());
