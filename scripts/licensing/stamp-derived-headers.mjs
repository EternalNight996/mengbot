#!/usr/bin/env node
// Modified by MengBot (惠州市梦游科技有限公司). Derived from OpenMausBot (Apache-2.0); see NOTICE.
//
// 给「继承自 OpenMausBot 的文件」补 Apache-2.0 §4(b) 要求的修改声明头。
//
// 背景：本仓库 UPSTREAM-INHERITED-FILES.txt 列出的路径与上游 OpenMausBot
// （https://github.com/milind-soni/OpenMausBot，Apache-2.0）同路径文件对应。
// Apache-2.0 §4(b) 要求分发时对「被修改过的文件」显著标注已作修改，本脚本
// 幂等地补上这行头注释，已标注过的文件会跳过。
//
// 用法：
//   node scripts/licensing/stamp-derived-headers.mjs --dry-run
//   node scripts/licensing/stamp-derived-headers.mjs --dry-run --scope server,src
//   node scripts/licensing/stamp-derived-headers.mjs --apply --scope server,src,shared
//   node scripts/licensing/stamp-derived-headers.mjs --apply --limit 20
//   node scripts/licensing/stamp-derived-headers.mjs --apply --paths server/index.ts,src/main.tsx
//
// 参数：
//   --apply            真正写文件（默认 dry-run，只打印统计与前若干个待处理文件）
//   --scope a,b,c      只处理这些顶层目录（默认全部）
//   --paths p1,p2      只处理指定文件（相对仓库根，优先于 --scope）
//   --manifest <file>  继承清单，默认 UPSTREAM-INHERITED-FILES.txt
//   --limit N          最多处理 N 个文件（0 = 不限）
//
// 安全边界：
//   - 只碰可安全加行注释的源码扩展名
//   - 跳过 third_party/、dist*/、release/、node_modules/、tmp/
//   - shebang 保持在第一行
//   - 文件顶部若已有块注释（如 /* ... */ 或某段 license 头），插到它之后
//   - 已含 "Modified by MengBot" 的文件跳过（幂等）

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const TAG = "Modified by MengBot";
const HEADER = [
  `// ${TAG} (惠州市梦游科技有限公司). Derived from OpenMausBot (Apache-2.0); see NOTICE.`,
  "// Upstream: https://github.com/milind-soni/OpenMausBot",
].join("\n");

const EXT_OK = new Set([".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx"]);
const SKIP_PREFIX = ["third_party/", "node_modules/", "release/", "tmp/", ".git/"];
const SKIP_PREFIX_RE = /^(dist|dist-|backup)/;

function parseArgs(argv) {
  const out = { apply: false, scope: null, paths: null, manifest: "UPSTREAM-INHERITED-FILES.txt", limit: 0 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") out.apply = true;
    else if (a === "--dry-run") out.apply = false;
    else if (a === "--scope") out.scope = (argv[++i] ?? "").split(",").map(s => s.trim()).filter(Boolean);
    else if (a === "--paths") out.paths = (argv[++i] ?? "").split(",").map(s => s.trim()).filter(Boolean);
    else if (a === "--manifest") out.manifest = argv[++i] ?? out.manifest;
    else if (a === "--limit") out.limit = Number(argv[++i] ?? 0) || 0;
    else if (a === "--help" || a === "-h") { console.log(readFileSync(new URL(import.meta.url)).toString().split("\n").slice(1, 40).join("\n")); process.exit(0); }
    else { console.error(`未知参数: ${a}`); process.exit(2); }
  }
  return out;
}

function loadManifest(rel) {
  const abs = path.join(ROOT, rel);
  if (!existsSync(abs)) {
    console.error(`找不到清单 ${rel}，先执行 scripts/licensing/gen-upstream-manifest.mjs`);
    process.exit(2);
  }
  return readFileSync(abs, "utf8")
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith("#"));
}

function shouldSkip(rel) {
  if (SKIP_PREFIX.some(p => rel.startsWith(p))) return true;
  if (SKIP_PREFIX_RE.test(rel)) return true;
  if (!EXT_OK.has(path.extname(rel))) return true;
  return false;
}

/** 计算插入位置：跳过 shebang 与文件顶部已有的块注释/连续行注释头。 */
function insertionIndex(text) {
  const lines = text.split(/\r?\n/);
  let i = 0;
  if (lines[0]?.startsWith("#!")) i = 1;
  // 跳过紧邻顶部的一块 /* ... */ 注释（保留原 license 头在最前）
  if (lines[i]?.trim().startsWith("/*")) {
    while (i < lines.length && !lines[i].includes("*/")) i++;
    i++;
  }
  return { lines, i };
}

const args = parseArgs(process.argv.slice(2));
let candidates = args.paths ?? loadManifest(args.manifest);

if (args.paths) {
  // --paths 允许显式指定清单外的文件，但要过滤掉明显不该动的
  candidates = candidates.filter(p => !p.startsWith("third_party/") && !p.startsWith("node_modules/"));
  if (args.scope) console.warn("提示：同时给了 --paths 与 --scope，按 --paths 执行。");
} else if (args.scope) {
  candidates = candidates.filter(p => args.scope.some(s => p === s || p.startsWith(s + "/")));
}

let scanned = 0, skippedExisting = 0, skippedType = 0, missing = 0, changed = 0;
const changedList = [];

for (const rel of candidates) {
  if (shouldSkip(rel)) { skippedType++; continue; }
  const abs = path.join(ROOT, rel);
  if (!existsSync(abs)) { missing++; continue; }
  scanned++;

  const text = readFileSync(abs, "utf8");
  if (text.includes(TAG)) { skippedExisting++; continue; }

  const { lines, i } = insertionIndex(text);
  const next = [...lines.slice(0, i), HEADER, ...lines.slice(i)].join("\n");

  changed++;
  changedList.push(rel);
  if (args.apply) writeFileSync(abs, next, "utf8");
  if (args.limit && changed >= args.limit) break;
}

console.log(`${args.apply ? "已写入" : "dry-run"}：扫描 ${scanned}，待改 ${changed}，已有标识 ${skippedExisting}，非源码类跳过 ${skippedType}，文件缺失 ${missing}`);
for (const p of changedList.slice(0, 20)) console.log(`  ${p}`);
if (changedList.length > 20) console.log(`  ... 共 ${changedList.length} 个`);
if (!args.apply) console.log("\n加 --apply 才会真正写文件。建议先小范围验证：\n  node scripts/licensing/stamp-derived-headers.mjs --apply --limit 5");
