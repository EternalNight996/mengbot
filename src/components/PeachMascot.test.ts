import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PeachMascot } from "./PeachMascot";

describe("PeachMascot", () => {
  it("renders an interactive peach character with an accessible click target", () => {
    const html = renderToStaticMarkup(createElement(PeachMascot, { size: 76 }));
    expect(html).toContain('aria-label="和 MengBot 桃子互动"');
    expect(html).toContain("<button");
    expect(html).toContain('viewBox="0 0 200 200"');
  });

  it("can render as a non-interactive illustration", () => {
    const html = renderToStaticMarkup(createElement(PeachMascot, { size: 40, interactive: false }));
    expect(html).not.toContain("aria-label=");
    expect(html).not.toContain("<button");
  });
});
