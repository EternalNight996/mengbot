import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { suggestOpenMausBot } from "./openmausbot-suggestion.ts";

function home(bots: number): string {
  const dir = mkdtempSync(join(tmpdir(), "omb-home-"));
  const data = join(dir, ".openmausbot");
  mkdirSync(data, { recursive: true });
  writeFileSync(join(data, "bots.json"), JSON.stringify(Array.from({ length: bots }, (_, i) => ({ id: "b" + i }))));
  return dir;
}

describe("OpenMausBot suggestion", () => {
  it("suggests the folder on a fresh install", () => {
    expect(suggestOpenMausBot(home(3), 1)).toMatchObject({ bots: 3 });
  });

  it("stays quiet once this computer has its own bots", () => {
    expect(suggestOpenMausBot(home(3), 10)).toBe(null);
  });

  it("stays quiet when there is nothing to bring", () => {
    expect(suggestOpenMausBot(mkdtempSync(join(tmpdir(), "omb-empty-")), 0)).toBe(null);
  });
});
