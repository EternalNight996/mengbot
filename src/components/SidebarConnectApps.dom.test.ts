// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { initialState } from "@/state/store";

const inventory = vi.hoisted(() => ({ services: {} as Record<string, { connected: boolean }> }));

vi.mock("@/state/store", async (original) => ({ ...await original<typeof import("@/state/store")>(), useStore: () => ({ state: initialState, dispatch: vi.fn() }) }));
vi.mock("@/lib/connected-apps", () => ({ preloadConnectedApps: async () => ({ services: inventory.services, authoritative: true }) }));

import { SidebarConnectApps } from "./SidebarConnectApps";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function pill(services: Record<string, { connected: boolean }>, circle = false) {
  inventory.services = services;
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => { root.render(createElement(SidebarConnectApps, { circle })); });
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  const button = document.querySelector<HTMLButtonElement>('[data-sidebar-nav="apps"]')!;
  const seen = { label: circle ? button.getAttribute("aria-label") : button.firstElementChild!.textContent, glyphs: button.querySelectorAll(".lucide-puzzle").length };
  act(() => root.unmount());
  document.body.innerHTML = "";
  return seen;
}

it("asks to connect apps until one is connected, then is simply the way into Apps", async () => {
  expect(await pill({})).toEqual({ label: "Connect apps", glyphs: 1 });
  expect(await pill({ github: { connected: false } }), "an app that is only listed is not connected").toEqual({ label: "Connect apps", glyphs: 1 });
  expect(await pill({ github: { connected: true } })).toEqual({ label: "Apps", glyphs: 1 });
  expect((await pill({ github: { connected: true } }, true)).label, "and on the collapsed rail").toBe("Apps");
});
