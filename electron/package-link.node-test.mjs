import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { packageUrlFromCommandLine, packageUrlFromDeepLink } from "./package-link.mjs";

describe("BotMRR package deep links", () => {
  it("accepts a public GitHub package URL", () => {
    const target = "https://raw.githubusercontent.com/acme/bots/main/reddit-lead-miner.md";
    assert.equal(packageUrlFromDeepLink(`mengbot://install?url=${encodeURIComponent(target)}`), target);
    assert.equal(packageUrlFromCommandLine(["MengBot", "--flag", `mengbot://install?url=${encodeURIComponent(target)}`]), target);
  });

  it("accepts the market site's files root and the legacy Teams root", () => {
    for (const target of [
      "https://market.mengbot.com.cn/files/packages/engineering.md",
      "https://teams.mengbot.com.cn/files/packages/engineering.md",
    ]) {
      const live = "mengbot://install/?url=" + encodeURIComponent(target);
      assert.equal(packageUrlFromDeepLink(live), target);
      assert.equal(packageUrlFromCommandLine(["MengBot", live]), target);
    }
  });

  it("rejects other commands, hosts, protocols, credentials, and unsupported file types", () => {
    assert.equal(packageUrlFromDeepLink("mengbot://settings"), null);
    assert.equal(packageUrlFromDeepLink("mengbot://install?url=https://evil.example/bot.json"), null);
    assert.equal(packageUrlFromDeepLink("mengbot://install?url=http://raw.githubusercontent.com/a/b/main/bot.json"), null);
    assert.equal(packageUrlFromDeepLink("mengbot://install?url=https://user@example.com/bot.json"), null);
    assert.equal(packageUrlFromDeepLink("mengbot://install?url=https://github.com/acme/bot/run.sh"), null);
    assert.equal(packageUrlFromDeepLink("mengbot://install?url=https://x.ai/bot/d8OshqLZvtcKDcNluPuyo"), null);
    assert.equal(packageUrlFromDeepLink("mengbot://install?url=http://teams.mengbot.com.cn/files/packages/a.md"), null);
    assert.equal(packageUrlFromDeepLink("mengbot://install?url=https://teams.mengbot.com.cn/files/packages/a.sh"), null);
    assert.equal(packageUrlFromDeepLink("mengbot://install?url=https://teams.mengbot.com.cn.evil.example/files/a.md"), null);
  });
});
