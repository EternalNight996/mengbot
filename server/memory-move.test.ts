import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { DATA_DIR } from "./config.ts";
import { journalFile, JOURNAL_DIR } from "./memory-journal.ts";
import { moveMemoryLayer } from "./memory-move.ts";
import { ensureWorkspace, isMemorySeed, workspaceDir } from "./workspace.ts";

const at = (layer: string, path: string) => join(workspaceDir(layer), path);
const put = (layer: string, path: string, text: string) => {
  mkdirSync(join(at(layer, path), ".."), { recursive: true });
  writeFileSync(at(layer, path), text);
};

describe("moving one memory layer's notes into another", () => {
  beforeEach(() => {
    rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it("moves the notes, topics, logs and journal, merging with what is there, and leaves an empty memory behind", async () => {
    ensureWorkspace("meng");
    put("meng", "MEMORY.md", "# Memory\n\n- old note\n");
    put("meng", "memory/people.md", "- Ada likes tea\n");
    put("meng", "memory/log/2026-11-01.md", "- talked about tea\n");
    put("meng--member-p", "MEMORY.md", "# Memory\n\n- her own note\n");
    put("meng--member-p", "memory/people.md", "- Ada is in Lisbon\n");
    mkdirSync(JOURNAL_DIR, { recursive: true });
    writeFileSync(journalFile("meng"), `${JSON.stringify({ id: "j1", botId: "meng", at: 1, path: "MEMORY.md", before: "x", canRevert: true })}\n`);

    expect(await moveMemoryLayer("meng", "meng--member-p")).toBe(true);
    expect(readFileSync(at("meng--member-p", "MEMORY.md"), "utf8")).toMatch(/her own note[\s\S]*old note/);
    expect(readFileSync(at("meng--member-p", "memory/people.md"), "utf8")).toMatch(/Lisbon[\s\S]*tea/);
    expect(readFileSync(at("meng--member-p", "memory/log/2026-11-01.md"), "utf8")).toContain("talked about tea");
    expect(isMemorySeed(readFileSync(at("meng", "MEMORY.md"), "utf8"))).toBe(true);
    expect(existsSync(at("meng", "memory/people.md"))).toBe(false);
    expect(existsSync(journalFile("meng"))).toBe(false);
    const row = JSON.parse(readFileSync(journalFile("meng--member-p"), "utf8").trim());
    expect(row).toMatchObject({ id: "j1", botId: "meng--member-p", before: null, canRevert: false });
  });

  it("moves nothing from a memory that holds nothing", async () => {
    ensureWorkspace("empty");
    expect(await moveMemoryLayer("empty", "empty--member-p")).toBe(false);
    expect(await moveMemoryLayer("missing", "missing--member-p")).toBe(false);
  });
});
