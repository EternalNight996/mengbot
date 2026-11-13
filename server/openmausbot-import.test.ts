import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DatabaseSync } from "node:sqlite";

import { importOpenMausBot, mergeMcpServers, mergeMessagesDb, previewOpenMausBot } from "./openmausbot-import.ts";

function chatDb(path: string, threads: Record<string, number>): void {
  const db = new DatabaseSync(path);
  db.exec("CREATE TABLE messages (thread_id TEXT NOT NULL, id TEXT NOT NULL, at INTEGER NOT NULL, role TEXT NOT NULL, kind TEXT NOT NULL, text TEXT, json TEXT NOT NULL, PRIMARY KEY (thread_id, id))");
  db.exec("CREATE TABLE thread_state (thread_id TEXT PRIMARY KEY, active_leaf_id TEXT)");
  db.exec("CREATE VIRTUAL TABLE messages_fts USING fts5(text, content='messages', content_rowid='rowid')");
  for (const [thread, count] of Object.entries(threads)) {
    for (let i = 0; i < count; i += 1) {
      db.prepare("INSERT INTO messages (thread_id, id, at, role, kind, text, json) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(thread, thread + "-" + i, i, "user", "text", "hi " + thread + " " + i, "{}");
    }
    db.prepare("INSERT INTO thread_state (thread_id, active_leaf_id) VALUES (?, ?)").run(thread, thread + "-0");
  }
  db.close();
}

function source(): string {
  const dir = mkdtempSync(join(tmpdir(), "omb-import-"));
  writeFileSync(join(dir, "bots.json"), JSON.stringify([{ id: "a" }, { id: "b" }, { id: "c" }]));
  writeFileSync(join(dir, "messages.db"), "db");
  writeFileSync(join(dir, "routines.json"), JSON.stringify([{ id: "r1" }]));
  mkdirSync(join(dir, "imported-skills", "alpha"), { recursive: true });
  writeFileSync(join(dir, "imported-skills", "alpha", "SKILL.md"), "# alpha");
  mkdirSync(join(dir, "attachments"), { recursive: true });
  writeFileSync(join(dir, "attachments", "a.png"), "png");
  return dir;
}

describe("OpenMausBot import", () => {
  it("recognises a data directory and counts what it holds", () => {
    const preview = previewOpenMausBot(source());
    expect(preview).toMatchObject({ bots: 3, hasHistory: true, routines: 1, skills: 1 });
    expect(preview?.dirs).toContain("attachments");
  });

  it("returns null for a folder that is not one", () => {
    expect(previewOpenMausBot(mkdtempSync(join(tmpdir(), "omb-empty-")))).toBe(null);
  });

  it("does not write anything on a dry run", () => {
    const target = mkdtempSync(join(tmpdir(), "omb-target-"));
    const result = importOpenMausBot({ source: source(), target, apply: false });
    expect(result.applied).toBe(false);
    expect(existsSync(join(target, "bots.json"))).toBe(false);
  });

  it("copies bots, history, skills and attachments", () => {
    const target = mkdtempSync(join(tmpdir(), "omb-target-"));
    const result = importOpenMausBot({ source: source(), target, apply: true });
    expect(result.applied).toBe(true);
    expect(JSON.parse(readFileSync(join(target, "bots.json"), "utf8"))).toHaveLength(3);
    expect(existsSync(join(target, "messages.db"))).toBe(true);
    expect(existsSync(join(target, "imported-skills", "alpha", "SKILL.md"))).toBe(true);
    expect(existsSync(join(target, "attachments", "a.png"))).toBe(true);
  });

  it("refuses to import a folder into itself or a folder inside it", () => {
    const dir = source();
    expect(() => importOpenMausBot({ source: dir, target: dir, apply: false })).toThrow(/不能相同/);
    expect(() => importOpenMausBot({ source: dir, target: join(dir, "nested"), apply: false })).toThrow(/不能相同/);
  });

  it("merges an existing list by id and leaves the person's own entry alone", () => {
    const target = mkdtempSync(join(tmpdir(), "omb-target-"));
    writeFileSync(join(target, "bots.json"), JSON.stringify([{ id: "a", name: "mine" }]));
    const result = importOpenMausBot({ source: source(), target, apply: true });
    expect(result.merged["bots.json"]).toBe(2);
    const bots = JSON.parse(readFileSync(join(target, "bots.json"), "utf8"));
    expect(bots).toHaveLength(3);
    expect(bots[0]).toEqual({ id: "a", name: "mine" });
    expect(bots.map((bot: { id: string }) => bot.id)).toEqual(["a", "b", "c"]);
  });
});
describe("merging chat history", () => {
  it("adds only threads the target does not have, then rebuilds the index", () => {
    const dir = mkdtempSync(join(tmpdir(), "omb-db-"));
    const source = join(dir, "source.db");
    const target = join(dir, "target.db");
    chatDb(source, { "s-1": 2, "s-2": 1 });
    chatDb(target, { "t-1": 1 });
    expect(mergeMessagesDb(source, target)).toBe(3);
    const db = new DatabaseSync(target);
    expect((db.prepare("SELECT COUNT(*) AS c FROM messages").get() as { c: number }).c).toBe(4);
    expect((db.prepare("SELECT COUNT(*) AS c FROM messages WHERE thread_id = 's-1'").get() as { c: number }).c).toBe(2);
    db.close();
  });

  it("keeps both halves of a conversation continued on both sides", () => {
    const dir = mkdtempSync(join(tmpdir(), "omb-db-"));
    const source = join(dir, "source.db");
    const target = join(dir, "target.db");
    chatDb(source, { "s-1": 2, "s-2": 1 });
    chatDb(target, { "s-1": 1 });
    expect(mergeMessagesDb(source, target)).toBe(2);
    const db = new DatabaseSync(target);
    expect((db.prepare("SELECT COUNT(*) AS c FROM messages WHERE thread_id = 's-1'").get() as { c: number }).c).toBe(2);
    db.close();
  });

  it("adds nothing the second time", () => {
    const dir = mkdtempSync(join(tmpdir(), "omb-db-"));
    const source = join(dir, "source.db");
    const target = join(dir, "target.db");
    chatDb(source, { "s-1": 2 });
    chatDb(target, {});
    expect(mergeMessagesDb(source, target)).toBe(2);
    expect(mergeMessagesDb(source, target)).toBe(0);
  });

  it("merges files into directories that already exist", () => {
    const dir = mkdtempSync(join(tmpdir(), "omb-dir-"));
    const from = join(dir, "from");
    const to = join(dir, "to");
    writeFileSync(join(mkdtempSync(join(tmpdir(), "omb-src-")), "x"), "");
    mkdirSync(join(from, "attachments"), { recursive: true });
    mkdirSync(join(to, "attachments"), { recursive: true });
    writeFileSync(join(from, "bots.json"), "[]");
    mkdirSync(join(to, "attachments"), { recursive: true });
    writeFileSync(join(from, "attachments", "a.png"), "a");
    writeFileSync(join(to, "attachments", "b.png"), "b");
    const result = importOpenMausBot({ source: from, target: to, apply: true });
    expect(result.mergedFiles.attachments).toBe(1);
    expect(existsSync(join(to, "attachments", "a.png"))).toBe(true);
    expect(existsSync(join(to, "attachments", "b.png"))).toBe(true);
  });
});
describe("merging skills", () => {
  it("does not copy the same skill under another folder name", () => {
    const dir = mkdtempSync(join(tmpdir(), "omb-skill-"));
    const from = join(dir, "from");
    const to = join(dir, "to");
    mkdirSync(join(from, "imported-skills", "alpha"), { recursive: true });
    mkdirSync(join(to, "imported-skills", "beta"), { recursive: true });
    writeFileSync(join(from, "bots.json"), "[]");
    writeFileSync(join(from, "imported-skills", "alpha", "SKILL.md"), "# Same skill");
    writeFileSync(join(to, "imported-skills", "beta", "SKILL.md"), "# Same skill");
    importOpenMausBot({ source: from, target: to, apply: true });
    expect(existsSync(join(to, "imported-skills", "alpha"))).toBe(false);

    mkdirSync(join(from, "imported-skills", "gamma"), { recursive: true });
    writeFileSync(join(from, "imported-skills", "gamma", "SKILL.md"), "# Another skill");
    importOpenMausBot({ source: from, target: to, apply: true });
    expect(existsSync(join(to, "imported-skills", "gamma", "SKILL.md"))).toBe(true);
  });
});
describe("merging MCP servers", () => {
  const write = (dir: string, servers: Record<string, unknown>) => {
    const path = join(dir, "config.json");
    writeFileSync(path, JSON.stringify({ mcpServers: servers }));
    return path;
  };

  it("adds a server the target does not have", () => {
    const dir = mkdtempSync(join(tmpdir(), "omb-mcp-"));
    const source = write(dir, { whop: { type: "http", url: "https://mcp.whop.com/mcp" } });
    const target = write(mkdtempSync(join(tmpdir(), "omb-mcp-")), { memory: { command: "node", args: ["memory.mjs"] } });
    expect(mergeMcpServers(source, target)).toBe(1);
    expect(Object.keys(JSON.parse(readFileSync(target, "utf8")).mcpServers)).toEqual(expect.arrayContaining(["whop", "memory"]));
  });

  it("does not add the same endpoint under another name", () => {
    const dir = mkdtempSync(join(tmpdir(), "omb-mcp-"));
    const source = write(dir, { whop: { type: "http", url: "https://mcp.whop.com/mcp" } });
    const target = write(mkdtempSync(join(tmpdir(), "omb-mcp-")), { "whop-copy": { type: "http", url: "https://mcp.whop.com/mcp" } });
    expect(mergeMcpServers(source, target)).toBe(0);
  });

  it("does not add a server the target already has by name", () => {
    const dir = mkdtempSync(join(tmpdir(), "omb-mcp-"));
    const source = write(dir, { memory: { command: "node", args: ["other.mjs"] } });
    const target = write(mkdtempSync(join(tmpdir(), "omb-mcp-")), { memory: { command: "node", args: ["mine.mjs"] } });
    expect(mergeMcpServers(source, target)).toBe(0);
    expect(JSON.parse(readFileSync(target, "utf8")).mcpServers.memory.args).toEqual(["mine.mjs"]);
  });
});
describe("deduplicating template bots", () => {
  it("does not add a bot with the same name, role and template under another id", () => {
    const dir = mkdtempSync(join(tmpdir(), "omb-bot-"));
    const from = join(dir, "from");
    const to = join(dir, "to");
    mkdirSync(from, { recursive: true });
    mkdirSync(to, { recursive: true });
    writeFileSync(join(from, "bots.json"), JSON.stringify([
      { id: "s1", name: "Nova", title: "SEO Strategist", installedPackage: { id: "seo-growth" } },
      { id: "s2", name: "Fresh Bot", title: "Researcher" },
    ]));
    writeFileSync(join(to, "bots.json"), JSON.stringify([
      { id: "t1", name: "Nova", title: "SEO Strategist", installedPackage: { id: "seo-growth" } },
    ]));
    importOpenMausBot({ source: from, target: to, apply: true });
    const bots = JSON.parse(readFileSync(join(to, "bots.json"), "utf8"));
    expect(bots).toHaveLength(2);
    expect(bots.map((bot: { id: string }) => bot.id)).toEqual(["t1", "s2"]);
  });
});
