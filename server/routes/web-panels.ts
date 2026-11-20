import { isLoopbackHost, isProxied } from "../request-auth.ts";
import { checkFraming } from "../web-panel-framing.ts";
import { PASS, type RouteHandler } from "./table.ts";

/** GET /api/web-panels/framing?url=…&origin=…: whether the page at `url` lets the app at `origin` frame it, and
 * whether it answered at all. Security: it answers with a verdict and never a page's content, and a page on this
 * computer or its local network is asked about only when the person is at this computer — a pinned local dashboard
 * has no other way to say why its frame stays blank. */
export const webPanelRoutes: RouteHandler = async ({ req, res, url, path, method, json }) => {
  if (path !== "/api/web-panels/framing" || method !== "GET") return PASS;
  const page = url.searchParams.get("url");
  const origin = url.searchParams.get("origin");
  if (!page || !origin) return json(res, 400, { error: "url and origin are required." });
  const here = !isProxied(req) && isLoopbackHost(req.socket?.remoteAddress);
  return json(res, 200, await checkFraming(page, origin, here ? { allowPrivate: true } : {}));
};
