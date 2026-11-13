// A backup archive of an OpenMausBot data folder: unpack it somewhere temporary, find the
// directory that holds bots.json, and hand that to the same importer a live folder uses.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MARKERS = ["bots.json", "config.json", "messages.db"];
const ARCHIVE = /\.(zip|tar|tar\.gz|tgz)$/i;

export function isArchivePath(path: string): boolean {
  return ARCHIVE.test(path);
}

export interface ExtractedArchive {
  root: string;
  /** Call when done: removes the temporary directory. */
  cleanup(): void;
}

function hasMarkers(dir: string): boolean {
  return MARKERS.some((name) => existsSync(join(dir, name)));
}

/** The data directory inside an archive: the root itself, or the one folder a backup usually wraps it in. */
export function locateDataDir(root: string): string | null {
  if (hasMarkers(root)) return root;
  const entries = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  if (entries.length !== 1) return null;
  const inner = join(root, entries[0]!.name);
  return hasMarkers(inner) ? inner : null;
}

/** Unpacks with the system tar (Windows 10+ and Linux both read zip and tar), capped to keep a zip bomb out. */
export function extractArchive(archive: string, maxBytes = 4 * 1024 * 1024 * 1024): ExtractedArchive {
  const size = statSync(archive).size;
  if (size > maxBytes) throw new Error("压缩包太大（超过 4GB），请先解压后再选择文件夹。");
  const root = mkdtempSync(join(tmpdir(), "omb-archive-"));
  try {
    execFileSync("tar", ["-xf", archive, "-C", root], { timeout: 300_000, stdio: "ignore" });
    return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw new Error("解压失败：请确认这是有效的 zip 或 tar 备份包。" + (error instanceof Error ? " " + error.message : ""));
  }
}
