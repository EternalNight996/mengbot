// Modified by MengBot (惠州市梦游科技有限公司). Derived from OpenMausBot (Apache-2.0); see NOTICE.
// Upstream: https://github.com/milind-soni/OpenMausBot
// Bring an OpenMausBot install over: its bots, groups, routines, skills, attachments and chat history.
// The copy is additive and never overwrites a file the target already has; a fresh install is the easy case.
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";

/** The files that make a folder an OpenMausBot (or this app's older) data directory. */
const MARKERS = ["bots.json", "config.json", "messages.db"];

/** Copied as-is when present. Credentials are deliberately absent: they are sealed to the machine that made them. */
const FILES = [
  "bots.json", "default-bot.json", "groups.json", "routines.json", "owner-routines.json",
  "section-contexts.json", "person-languages.json", "places-elsewhere.json",
  "published-teams.json", "brief.json", "asked-at-filled", "bot-api.json",
  "messages.db", "messages.db-wal", "messages.db-shm",
  "runtime.db", "runtime.db-wal", "runtime.db-shm",
];

const DIRS = [
  "attachments", "imported-skills", "workspaces", "task-workspaces",
  "memory-journal", "prompt-split", "skill-state", "providers", "skill-state",
];

export interface ImportPreview {
  source: string;
  bots: number;
  hasHistory: boolean;
  skills: number;
  routines: number;
  files: string[];
  dirs: string[];
}

export interface ImportResult extends ImportPreview {
  /** False for a dry run: the preview only. */
  applied: boolean;
  copied: string[];
  skipped: string[];
  /** Per file, how many entries an existing list gained. */
  merged: Record<string, number>;
  /** Files copied into directories that already existed. */
  mergedFiles: Record<string, number>;
  /** Chat rows added from the source database. */
  messages: number;
  /** MCP servers added to the target's config. */
  mcpServers: number;
}

/** Lists that merge by id when the target already has one: the person's own entries always win. */
const MERGE_BY_ID = new Set(["bots.json", "groups.json", "routines.json", "owner-routines.json"]);

/** Two bots with the same name, role and template are the same bot even when their ids differ:
 * a template installed on both sides must not appear twice. */
function botIdentity(bot: unknown): string {
  const value = bot as { id?: unknown; name?: unknown; title?: unknown; installedPackage?: { id?: unknown } };
  const name = String(value?.name ?? "").trim();
  // A nameless record is never "the same bot": only a real name can make two copies of a template equal.
  if (!name) return "id:" + String(value?.id ?? "");
  return [name, String(value?.title ?? ""), String(value?.installedPackage?.id ?? "")].join("\u0000");
}

function mergeBots(targetPath: string, sourcePath: string): { added: number; duplicates: number } {
  const read = (path: string): unknown[] => {
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const mine = read(targetPath);
  const theirs = read(sourcePath);
  const ids = new Set(mine.map((bot) => (bot as { id?: unknown })?.id).filter((id) => typeof id === "string"));
  const identities = new Set(mine.map(botIdentity));
  const added: unknown[] = [];
  let duplicates = 0;
  for (const bot of theirs) {
    const id = (bot as { id?: unknown })?.id;
    if (typeof id === "string" && ids.has(id)) { duplicates += 1; continue; }
    const identity = botIdentity(bot);
    if (identities.has(identity)) { duplicates += 1; continue; }
    added.push(bot);
    identities.add(identity);
  }
  if (added.length) writeFileSync(targetPath, JSON.stringify([...mine, ...added], null, 2) + "\n", { mode: 0o600 });
  return { added: added.length, duplicates };
}

function mergeById(targetPath: string, sourcePath: string): number {
  const read = (path: string): unknown[] => {
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const mine = read(targetPath);
  const theirs = read(sourcePath);
  const ids = new Set(mine.map((item) => (item as { id?: unknown })?.id).filter((id) => typeof id === "string"));
  const added = theirs.filter((item) => {
    const id = (item as { id?: unknown })?.id;
    return typeof id !== "string" || !ids.has(id);
  });
  if (added.length) writeFileSync(targetPath, JSON.stringify([...mine, ...added], null, 2) + "\n", { mode: 0o600 });
  return added.length;
}

function countJsonItems(path: string): number {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
  } catch {
    return 0;
  }
}

/** Null when the folder is not a data directory; otherwise what importing it would bring. */
export function previewOpenMausBot(source: string): ImportPreview | null {
  if (!existsSync(source) || !statSync(source).isDirectory()) return null;
  if (!MARKERS.some((name) => existsSync(join(source, name)))) return null;
  const files = FILES.filter((name) => existsSync(join(source, name)));
  const dirs = DIRS.filter((name) => existsSync(join(source, name)));
  const skillsDir = join(source, "imported-skills");
  let skills = 0;
  if (existsSync(skillsDir)) {
    try { skills = readdirSync(skillsDir).length; } catch { skills = 0; }
  }
  return {
    source,
    bots: countJsonItems(join(source, "bots.json")),
    hasHistory: existsSync(join(source, "messages.db")),
    skills,
    routines: countJsonItems(join(source, "routines.json")),
    files,
    dirs,
  };
}

/** The text a skill's identity is judged by: its SKILL.md, or its folder name when there is none. */
function skillSignature(dir: string, name: string): string {
  try {
    const text = readFileSync(join(dir, name, "SKILL.md"), "utf8").replace(/\r\n/g, "\n").trim();
    if (text) return createHash("sha256").update(text).digest("hex");
  } catch { /* fall through to the name */ }
  return "name:" + name;
}

/** Skills are merged by identity, not by folder: the same skill under another name is not copied twice. */
export function mergeImportedSkills(from: string, to: string): { added: number } {
  if (!existsSync(to)) {
    cpSync(from, to, { recursive: true, preserveTimestamps: true });
    return { added: readdirSync(from).length };
  }
  const known = new Set<string>();
  for (const name of readdirSync(to, { withFileTypes: true })) {
    if (name.isDirectory()) known.add(skillSignature(to, name.name));
  }
  let added = 0;
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const signature = skillSignature(from, entry.name);
    if (known.has(signature)) continue;
    const targetPath = join(to, entry.name);
    if (!existsSync(targetPath)) {
      cpSync(join(from, entry.name), targetPath, { recursive: true, preserveTimestamps: true });
      known.add(signature);
      added += 1;
    } else {
      added += copyMissing(join(from, entry.name), targetPath);
    }
  }
  return { added };
}

function serverFingerprint(server: unknown): string {
  const spec = server as { type?: string; url?: string; command?: string; args?: unknown };
  if (spec?.url) return "url:" + spec.url;
  return "cmd:" + [spec?.command ?? "", ...(Array.isArray(spec?.args) ? spec.args.map(String) : [])].join("\u0000");
}

/** Adds MCP servers the target does not have, by name and by endpoint. Returns how many were added. */
export function mergeMcpServers(sourceConfig: string, targetConfig: string): number {
  if (!existsSync(sourceConfig)) return 0;
  const read = (path: string): Record<string, unknown> => {
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8"));
      return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  };
  const from = read(sourceConfig);
  const sourceServers = from.mcpServers;
  if (!sourceServers || typeof sourceServers !== "object") return 0;
  const target = read(targetConfig);
  const mine = (target.mcpServers && typeof target.mcpServers === "object" ? target.mcpServers : {}) as Record<string, unknown>;
  const fingerprints = new Set(Object.values(mine).map(serverFingerprint));
  let added = 0;
  for (const [name, server] of Object.entries(sourceServers as Record<string, unknown>)) {
    if (Object.prototype.hasOwnProperty.call(mine, name)) continue;
    if (fingerprints.has(serverFingerprint(server))) continue;
    mine[name] = server;
    fingerprints.add(serverFingerprint(server));
    added += 1;
  }
  if (added > 0) {
    target.mcpServers = mine;
    writeFileSync(targetConfig, JSON.stringify(target, null, 2) + "\n", { mode: 0o600 });
  }
  return added;
}

/** Copies every file the target lacks, never replacing one. Returns how many files were added. */
function copyMissing(from: string, to: string): number {
  let added = 0;
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const sourcePath = join(from, entry.name);
    const targetPath = join(to, entry.name);
    const directory = entry.isDirectory();
    if (directory) {
      if (!existsSync(targetPath)) mkdirSync(targetPath, { recursive: true });
      added += copyMissing(sourcePath, targetPath);
      continue;
    }
    if (existsSync(targetPath)) continue;
    try {
      cpSync(sourcePath, targetPath, { recursive: entry.isSymbolicLink(), preserveTimestamps: true });
      added += 1;
    } catch {
      // A broken link or a file this account cannot read must not abandon the rest of the import.
    }
  }
  return added;
}

/** Adds the source's threads that the target does not have, then rebuilds the full-text index. */
export function mergeMessagesDb(sourceDb: string, targetDb: string): number {
  if (!existsSync(sourceDb)) return 0;
  // A placeholder or corrupt file is not history: leave it alone rather than failing the whole import.
  try {
    const header = readFileSync(sourceDb, { encoding: null }).subarray(0, 16).toString("latin1");
    if (header !== "SQLite format 3\u0000") return 0;
  } catch {
    return 0;
  }
  const db = new DatabaseSync(targetDb);
  try {
    db.prepare("ATTACH DATABASE ? AS src").run(sourceDb);
    const before = (db.prepare("SELECT COUNT(*) AS c FROM main.messages").get() as { c: number }).c;
    // Per message, not per thread: a conversation continued on both sides keeps both halves
    // (the target's copy wins on an id collision).
    db.exec(`INSERT OR IGNORE INTO main.messages (thread_id, id, at, role, kind, text, json)
      SELECT thread_id, id, at, role, kind, text, json FROM src.messages`);
    db.exec(`INSERT OR IGNORE INTO main.thread_state (thread_id, active_leaf_id)
      SELECT thread_id, active_leaf_id FROM src.thread_state`);
    db.exec("INSERT INTO main.messages_fts(messages_fts) VALUES('rebuild')");
    const after = (db.prepare("SELECT COUNT(*) AS c FROM main.messages").get() as { c: number }).c;
    return after - before;
  } catch {
    return 0;
  } finally {
    try { db.exec("DETACH DATABASE src"); } catch { /* the handle closes next anyway */ }
    db.close();
  }
}

/** The source and target must be different trees: importing into the source itself would pollute both. */
function assertSeparate(source: string, target: string): void {
  const real = (path: string) => {
    try { return realpathSync(path); } catch { return resolve(path); }
  };
  const from = real(source);
  const to = real(target);
  const inside = (child: string, parent: string) => child === parent || child.startsWith(parent.endsWith(sep) ? parent : parent + sep);
  if (inside(to, from) || inside(from, to)) {
    throw new Error("源目录和目标目录不能相同或互相包含：请把 MengBot 的数据目录与 OpenMausBot 分开。");
  }
}

export function importOpenMausBot(opts: { source: string; target: string; apply: boolean }): ImportResult {
  if (!isAbsolute(opts.source) || !isAbsolute(opts.target)) throw new Error("源目录和目标目录都必须是完整路径。");
  assertSeparate(opts.source, opts.target);
  const preview = previewOpenMausBot(opts.source);
  if (!preview) throw new Error("这个文件夹不是 OpenMausBot 的数据目录（找不到 bots.json / config.json / messages.db）。");
  const result: ImportResult = { ...preview, applied: false, copied: [], skipped: [], merged: {}, mergedFiles: {}, messages: 0, mcpServers: 0 };
  if (!opts.apply) return result;

  mkdirSync(opts.target, { recursive: true });
  result.applied = true;
  for (const name of preview.files) {
    const from = join(opts.source, name);
    const to = join(opts.target, name);
    if (existsSync(to)) {
      if (name === "bots.json") {
        const bots = mergeBots(to, from);
        if (bots.added > 0) result.merged[name] = bots.added;
        else result.skipped.push(name);
      } else if (MERGE_BY_ID.has(name)) {
        const added = mergeById(to, from);
        if (added > 0) result.merged[name] = added;
        else result.skipped.push(name);
      } else {
        result.skipped.push(name);
      }
      continue;
    }
    cpSync(from, to, { preserveTimestamps: true });
    result.copied.push(name);
  }
  for (const name of preview.dirs) {
    const from = join(opts.source, name);
    const to = join(opts.target, name);
    if (name === "imported-skills") {
      const skills = mergeImportedSkills(from, to);
      if (skills.added > 0) result.mergedFiles[name] = skills.added;
      else result.skipped.push(name);
      continue;
    }
    if (!existsSync(to)) {
      cpSync(from, to, { recursive: true, preserveTimestamps: true });
      result.copied.push(name);
      continue;
    }
    const added = copyMissing(from, to);
    if (added > 0) result.mergedFiles[name] = added;
    else result.skipped.push(name);
  }
  // Plugins are folded into the target's config, never copied over it: an existing server of the same
  // name or the same endpoint stays the one the person already has.
  result.mcpServers = mergeMcpServers(join(opts.source, "config.json"), join(opts.target, "config.json"));

  // History last: it needs both databases open, and only after the bots that name these threads exist.
  if (preview.hasHistory && existsSync(join(opts.target, "messages.db"))) {
    result.messages = mergeMessagesDb(join(opts.source, "messages.db"), join(opts.target, "messages.db"));
  }
  return result;
}