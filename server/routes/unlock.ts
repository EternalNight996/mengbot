import type { UnlockStore } from "../unlock.ts";
import { UnlockCodeError } from "../unlock.ts";
import { PASS, type RouteHandler } from "./table.ts";

export function createUnlockRoutes(deps: {
  unlock: UnlockStore;
  broadcast(payload: Record<string, unknown>): void;
}): RouteHandler {
  return async ({ req, res, path, method, json, readBody }) => {
    if (method === "GET" && path === "/api/unlock") {
      return json(res, 200, deps.unlock.status());
    }
    if (method === "POST" && path === "/api/unlock/activate") {
      const body = await readBody(req).catch(() => null) as { code?: unknown } | null;
      const code = typeof body?.code === "string" ? body.code : "";
      if (!code.trim()) return json(res, 400, { error: "请填写解锁码。" });
      try {
        const status = deps.unlock.activate(code);
        deps.broadcast({ kind: "config" });
        return json(res, 200, status);
      } catch (error) {
        if (error instanceof UnlockCodeError) return json(res, 400, { error: error.message });
        throw error;
      }
    }
    return PASS;
  };
}
