import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ServiceIcon } from "./ServiceIcon";

const card = (overrides: Record<string, unknown>) => ({
  slug: undefined,
  label: "App",
  logo: null,
  domain: null,
  ...overrides,
}) as never;

describe("the app icon", () => {
  it("draws the China edition's own letter tile instead of fetching a favicon", () => {
    const html = renderToStaticMarkup(createElement(ServiceIcon, { card: card({ slug: "feishu", label: "飞书" }) }));
    expect(html).toContain("飞");
    expect(html).toContain("#3370ff");
    expect(html).not.toContain("google");
    expect(html).not.toContain("<img");
  });

  it("falls back to the initial letter for an app with no tile", () => {
    const html = renderToStaticMarkup(createElement(ServiceIcon, { card: card({ slug: "unknown-app", label: "Zed" }) }));
    expect(html).toContain(">Z<");
    expect(html).not.toContain("google");
  });

  it("still prefers a logo the catalog supplies, and bears the broken-logo handler", () => {
    const html = renderToStaticMarkup(createElement(ServiceIcon, { card: card({ slug: "feishu", label: "飞书", logo: "/logos/feishu.png" }) }));
    expect(html).toContain('src="/logos/feishu.png"');
    expect(html).not.toContain("google");
  });
});
