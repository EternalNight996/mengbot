import assert from "node:assert/strict";
import test from "node:test";

import { trayLanguage, trayText } from "./tray-text.mjs";

test("the tray speaks the language this desktop shows", () => {
  assert.equal(trayLanguage("zh"), "zh");
  assert.equal(trayLanguage("zh-CN"), "zh");
  assert.equal(trayLanguage("zh-TW"), "zh-tw");
  assert.equal(trayLanguage("zh-HK"), "zh-tw");
  assert.equal(trayText("zh-CN").open, "打开 MengBot");
  assert.equal(trayText("zh-CN").quit, "退出 MengBot");
  assert.equal(trayText("zh-TW").quit, "結束 MengBot");
  assert.equal(trayText("en-US").open, "Open MengBot");
  assert.equal(trayLanguage("pt-br"), "pt-br");
  assert.equal(trayLanguage("pt-PT"), "pt-br");
  assert.equal(trayLanguage("de-AT"), "de");
  assert.equal(trayLanguage("fr"), "fr");
  assert.equal(trayLanguage("ja-JP"), "ja");
});

test("a language the tray has no words for falls back to English", () => {
  for (const tag of ["", "  ", "xx", "xx-YY", null, undefined, 42]) {
    assert.equal(trayLanguage(tag), "en", String(tag));
    assert.equal(trayText(tag).quit, "Quit MengBot");
  }
});

test("every language has both actions", () => {
  for (const tag of ["en", "zh", "zh-tw", "ja", "ko", "ru", "uk", "pt-br", "it", "de", "es", "fr", "tr", "pl", "vi", "hi"]) {
    const text = trayText(tag);
    assert.ok(text.open.includes("MengBot"), tag);
    assert.ok(text.quit.includes("MengBot"), tag);
    assert.notEqual(text.open, text.quit, tag);
  }
});
