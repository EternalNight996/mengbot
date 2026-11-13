import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { PassThrough } from "node:stream";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { json } from "../harness/http.ts";
import type { RouteContext } from "./table.ts";
import { webPanelRoutes } from "./web-panels.ts";

const APP = "http://127.0.0.1:8799";
const PATH = "/api/web-panels/framing";

/** One request to the route, from a peer on this computer or through a proxy, with the answer it wrote. */
function answer(page: string | null, peer: { address?: string; forwarded?: boolean } = {}) {
  const req = Object.assign(new PassThrough(), {
    method: "GET",
    headers: peer.forwarded ? { "x-forwarded-for": "203.0.113.9" } : {},
    socket: { remoteAddress: peer.address ?? "127.0.0.1" },
  }) as unknown as IncomingMessage;
  let status = 0;
  let body = "";
  const res = {
    writeHead(code: number) { status = code; },
    end(data: string) { body = data; },
    setHeader() {},
  } as unknown as ServerResponse;
  const query = page === null ? "" : `?url=${encodeURIComponent(page)}&origin=${encodeURIComponent(APP)}`;
  const url = new URL(`${PATH}${query}`, "http://127.0.0.1");
  const ctx = { req, res, url, path: url.pathname, method: "GET", json } as unknown as RouteContext;
  return {
    run: () => webPanelRoutes(ctx),
    read: () => ({ status, body: body ? JSON.parse(body) : null }),
  };
}

describe("GET /api/web-panels/framing", () => {
  let server: Server;
  let port = 0;
  beforeAll(async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { "x-frame-options": "DENY" }).end("no");
    });
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => {
    server.closeAllConnections();
    server.close();
  });

  it("reads this computer's page for a person at this computer, so a pinned local dashboard can say it refuses framing", async () => {
    const local = answer(`http://127.0.0.1:${port}/`);
    await local.run();
    expect(local.read()).toEqual({ status: 200, body: { framing: "blocked", reachable: true } });
  });

  it("never asks this computer's pages for a remote or proxied caller", async () => {
    for (const peer of [{ forwarded: true }, { address: "203.0.113.9" }]) {
      const elsewhere = answer(`http://127.0.0.1:${port}/`, peer);
      await elsewhere.run();
      expect(elsewhere.read()).toEqual({ status: 200, body: { framing: "unknown", reachable: null } });
    }
  });

  it("needs both a page and the app's origin", async () => {
    const missing = answer(null);
    await missing.run();
    expect(missing.read()).toEqual({ status: 400, body: { error: "url and origin are required." } });
  });
});
