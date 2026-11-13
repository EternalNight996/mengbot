#!/usr/bin/env node
// Modified by MengBot (惠州市梦游科技有限公司). Derived from OpenMausBot (Apache-2.0); see NOTICE.
//
// 重新生成 UPSTREAM-INHERITED-FILES.txt：求出「本仓库 git 跟踪文件」与「上游
// OpenMausBot 同路径文件」的交集。清单本身是 Apache-2.0 §4(b)/§4(d) 合规记录的一部分，
// 也是 scripts/licensing/stamp-derived-headers.mjs 的输入。
//
// 用法：
//   node scripts/licensing/gen-upstream-manifest.mjs
//   node scripts/licensing/gen-upstream-manifest.mjs --ref v2026.1.0
//   node scripts/licensing/gen-upstream-manifest.mjs --tree-json path/to/tree.json  # 离线复用已抓取的 tree
//
// 网络：只访问 api.github.com（公开仓库、无需令牌；命中速率限制时会明确报错）。
// 若所在网络无法直连 api.github.com，可先用其它方式取得
// https://api.github.com/repos/milind-soni/OpenMausBot/git/trees/<ref>?recursive=1
// 的响应保存为文件，再用 --tree-json 传入。

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const UPSTREAM = "milind-soni/OpenMausBot";
const OUT = "UPSTREAM-INHERITED-FILES.txt";
const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();

const argv = process.argv.slice(2);
function flag(name, fallback) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
}
const ref = flag("--ref", "main");
const treeJson = flag("--tree-json", null);

async function fetchTree() {
  const url = `https://api.github.com/repos/${UPSTREAM}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
  const res = await fetch(url, { headers: { "user-agent": "mengbot-licensing", accept: "application/vnd.github+json" } });
  if (!res.ok) {
    throw new Error(
      `GitHub API ${res.status} ${res.statusText}（${url}）\n` +
        "可能原因：网络无法直连 api.github.com，或未认证请求触发速率限制。\n" +
        "处理：先把上述 URL 的响应存成本地文件，再执行 --tree-json <文件>。",
    );
  }
  return res.json();
}

const tree = treeJson ? JSON.parse(readFileSync(path.resolve(treeJson), "utf8")) : await fetchTree();
if (!Array.isArray(tree.tree)) throw new Error("tree 响应格式不符：缺少 tree 数组");
if (tree.truncated) console.warn("注意：上游 tree 响应被截断，清单可能不完整。");

const upstreamPaths = new Set(tree.tree.filter(e => e.type === "blob").map(e => e.path));
const localPaths = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
  .split(/\r?\n/)
  .map(l => l.trim())
  .filter(Boolean);

const shared = localPaths.filter(p => upstreamPaths.has(p)).sort();

const header = [
  "# 继承自上游 OpenMausBot 的文件清单（UPSTREAM-INHERITED-FILES）",
  "#",
  "# 由 scripts/licensing/gen-upstream-manifest.mjs 生成，勿手工编辑。",
  `# 上游：OpenMausBot  https://github.com/${UPSTREAM}`,
  "#      Copyright 2026 Milind Soni and OpenMausBot contributors / Apache-2.0",
  `# 对照上游 ref：${ref}`,
  "#",
  `# 内容：本仓库 git 跟踪文件与上游同路径完全相同的文件（${shared.length} 个）。`,
  "# 这些路径的文件继承自上游，本项目对其做过品牌、本地化、功能或结构上的修改。",
  "# 依 Apache-2.0 §4(b)，修改记录见 MODIFICATIONS.md；逐文件可见声明可用",
  "# scripts/licensing/stamp-derived-headers.mjs 补齐。归属声明见 NOTICE。",
  "#",
  "# 格式：每行一个相对仓库根的路径",
  "",
];

writeFileSync(path.join(ROOT, OUT), [...header, ...shared].join("\n") + "\n", "utf8");
console.log(`上游 blob ${upstreamPaths.size} 个，本仓跟踪 ${localPaths.length} 个，同路径交集 ${shared.length} 个 → ${OUT}`);
