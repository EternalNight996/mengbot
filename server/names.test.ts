import { describe, expect, it } from "vitest";

import { initialGreeting, setupChoices } from "./initial-greeting.ts";
import { isEnglishPickedName, isPickedBotName, pickBotName } from "./names.ts";

describe("Chinese first-run content", () => {
  it("greets and offers setup answers in Chinese", () => {
    expect(initialGreeting("小梦", "zh-CN")).toBe("嗨，我是 小梦。你想让我做什么？");
    expect(initialGreeting("小梦", "zh", "阿明")).toBe("嗨 阿明，我是 小梦。你想让我做什么？");
    expect(setupChoices("zh-CN")[0]).toBe("调研和深挖各种主题");
  });

  it("picks a Chinese name when the language is Chinese", () => {
    const name = pickBotName([], "zh-CN");
    expect(name).toMatch(/^小./);
    expect(isPickedBotName(name)).toBe(true);
    expect(isEnglishPickedName(name)).toBe(false);
  });
});
