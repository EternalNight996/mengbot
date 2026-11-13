import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { isArchivePath, locateDataDir } from "./openmausbot-zip.ts";

describe("OpenMausBot archive", () => {
  it("recognises the archive extensions", () => {
    expect(isArchivePath("backup.zip")).toBe(true);
    expect(isArchivePath("backup.TAR.GZ")).toBe(true);
    expect(isArchivePath("data")).toBe(false);
  });

  it("finds the data directory at the archive root", () => {
    const root = mkdtempSync(join(tmpdir(), "omb-zip-"));
    writeFileSync(join(root, "bots.json"), "[]");
    expect(locateDataDir(root)).toBe(root);
  });

  it("finds it inside the single wrapper folder backups usually have", () => {
    const root = mkdtempSync(join(tmpdir(), "omb-zip-"));
    const inner = join(root, ".openmausbot");
    mkdirSync(inner, { recursive: true });
    writeFileSync(join(inner, "bots.json"), "[]");
    expect(locateDataDir(root)).toBe(inner);
  });

  it("gives up when nothing looks like a data directory", () => {
    const root = mkdtempSync(join(tmpdir(), "omb-zip-"));
    mkdirSync(join(root, "a"), { recursive: true });
    mkdirSync(join(root, "b"), { recursive: true });
    expect(locateDataDir(root)).toBe(null);
  });
});
