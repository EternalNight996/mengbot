import assert from "node:assert/strict";
import test from "node:test";

import { appFrameNavigationAllowed, createPanelFrameLookup, isAppLink } from "./app-frame-guard.mjs";

const appFrame = (url) => ({ isMainFrame: false, url, frame: { origin: "null", url: "" } });
const PANEL = "omb-web-panel-4f1c2b8a";

test("an app frame may load its own document", () => {
  assert.equal(appFrameNavigationAllowed(appFrame("about:srcdoc")), true);
  assert.equal(appFrameNavigationAllowed(appFrame("about:blank")), true);
  assert.equal(appFrameNavigationAllowed(appFrame("about:srcdoc#totals")), true);
});

test("an app frame may not navigate anywhere else", () => {
  for (const url of [
    "http://127.0.0.1:9/sink",
    "https://example.com/",
    "https://cdnjs.cloudflare.com/ajax/libs/x.js",
    "http://localhost:8799/",
    "data:text/html,<p>hi</p>",
    "blob:null/1234",
    "javascript:alert(1)",
    "file:///etc/passwd",
    "about:srcdocx",
    "about:blank/../srcdoc",
    "",
    undefined,
  ]) assert.equal(appFrameNavigationAllowed(appFrame(url)), false, String(url));
});

test("cancels, and never throws, when the frame can no longer be read", () => {
  // Electron throws from WebFrameMain's getters once its render frame is gone.
  const disposed = { get origin() { throw new Error("Render frame was disposed before WebFrameMain could be accessed"); } };
  assert.equal(appFrameNavigationAllowed({ isMainFrame: false, url: "http://127.0.0.1:9/location", frame: disposed }), false);
  assert.equal(appFrameNavigationAllowed({ isMainFrame: false, url: "about:srcdoc", frame: disposed }), true);
  assert.equal(appFrameNavigationAllowed({ isMainFrame: true, url: "http://127.0.0.1:9/", frame: disposed }), true);
});

test("leaves main frames and frames with a real origin alone", () => {
  assert.equal(appFrameNavigationAllowed({ isMainFrame: true, url: "https://example.com/", frame: { origin: "null" } }), true);
  assert.equal(appFrameNavigationAllowed({ isMainFrame: false, url: "https://example.com/", frame: { origin: "http://127.0.0.1:5199" } }), true);
  assert.equal(appFrameNavigationAllowed({ isMainFrame: false, url: "https://example.com/", frame: null }), true);
  assert.equal(appFrameNavigationAllowed(null), true);
  assert.equal(appFrameNavigationAllowed(undefined), true);
});

test("the person's pinned page may load web pages, and only web pages", () => {
  const panel = (url, name = PANEL) => ({ isMainFrame: false, url, frame: { origin: "null", url: "", name } });
  assert.equal(appFrameNavigationAllowed(panel("https://market.mengbot.com.cn/"), PANEL), true);
  assert.equal(appFrameNavigationAllowed(panel("http://127.0.0.1:3000/dashboard#today"), PANEL), true);
  for (const url of ["file:///etc/passwd", "data:text/html,<p>hi</p>", "blob:null/1234", "javascript:alert(1)", "about:srcdocx"]) {
    assert.equal(appFrameNavigationAllowed(panel(url), PANEL), false, url);
  }
});

test("a frame that is not this app's pinned page gains nothing by naming itself", () => {
  const appFrame = (url, name) => ({ isMainFrame: false, url, frame: { origin: "null", url: "", name } });
  assert.equal(appFrameNavigationAllowed(appFrame("https://example.com/")), false);
  assert.equal(appFrameNavigationAllowed(appFrame("https://example.com/", ""), PANEL), false);
  assert.equal(appFrameNavigationAllowed(appFrame("https://example.com/", "panel-1"), PANEL), false);
  // A frame with a real origin is left alone whatever its name.
  assert.equal(appFrameNavigationAllowed({ isMainFrame: false, url: "https://example.com/", frame: { origin: "https://example.com", name: PANEL } }, PANEL), true);
});

test("the pinned page's frame stays known after the page renames its own browsing context", () => {
  const nameOf = createPanelFrameLookup(PANEL);
  const frame = { name: PANEL, frameTreeNodeId: 42 };
  assert.equal(nameOf({ frame }), PANEL);
  frame.name = "renamed-by-the-page";
  const known = nameOf({ frame });
  assert.equal(known, PANEL);
  assert.equal(appFrameNavigationAllowed({ isMainFrame: false, url: "https://market.mengbot.com.cn/browse/", frame }, known), true);
  assert.equal(nameOf({ frame: { name: PANEL, frameTreeNodeId: 43 } }), PANEL);
  assert.equal(nameOf({ frame: { name: "other", frameTreeNodeId: 44 } }), "");
  assert.equal(nameOf({ frame: { name: "", frameTreeNodeId: 45 } }), "");
  assert.equal(nameOf(null), "");
  assert.equal(nameOf({ frame: null }), "");
  // A frame whose render frame is gone is never trusted, however it is named.
  assert.equal(nameOf({ frame: { get name() { throw new Error("Render frame was disposed"); } } }), "");
  assert.equal(createPanelFrameLookup("")({ frame: { name: "", frameTreeNodeId: 1 } }), "");
});

test("only this app's own links are taken from the pinned page", () => {
  assert.equal(isAppLink("mengbot://install?url=https%3A%2F%2Fmarket.mengbot.com.cn%2Ffiles%2Fpackages%2Fzh%2Fqa.md"), true);
  assert.equal(isAppLink("MENGBOT://thread/abc?bot=scout"), true);
  assert.equal(isAppLink("mengbot://"), true);
  for (const value of ["https://market.mengbot.com.cn/", "mengbot:", "mengbot:/install", "javascript:alert(1)", "", null, undefined, 42, "mengbot://" + "x".repeat(2100)]) {
    assert.equal(isAppLink(value), false, String(value).slice(0, 40));
  }
});
