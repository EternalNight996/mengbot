import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

import { importOpenMausBot, previewOpenMausBot } from "../openmausbot-import.ts";
import { extractArchive, isArchivePath, locateDataDir } from "../openmausbot-zip.ts";
import { PASS, type RouteHandler } from "./table.ts";

/** Dry run and apply share one endpoint: `apply: false` answers the preview. */
const LAST_IMPORT = "last-openmausbot-import.json";

/** Where an OpenMausBot install usually keeps its data, so the page can offer it instead of asking for a path. */
function candidateDirs(): string[] {
  return [".openmausbot", ".opengrokbot"]
    .map((name) => join(homedir(), name))
    .filter((dir) => existsSync(dir) && previewOpenMausBot(dir) !== null);
}

export function createOpenMausBotImportRoutes(deps: { target: string; restart?: () => void }): RouteHandler {
  return async ({ req, res, url, path, method, json, readBody }) => {
    if (path === "/api/import/openmausbot/last" && method === "GET") {
      try {
        return json(res, 200, { last: JSON.parse(readFileSync(join(deps.target, LAST_IMPORT), "utf8")) });
      } catch {
        return json(res, 200, { last: null });
      }
    }
    if (path === "/api/import/openmausbot" && method === "GET" && !(url.searchParams.get("dir") ?? "").trim()) {
      return json(res, 200, { candidates: candidateDirs() });
    }
    // A read-only preview is also a GET, so a support engineer can check a folder without the app.
    if (path === "/api/import/openmausbot" && method === "GET") {
      const dir = (url.searchParams.get("dir") ?? "").trim();
      if (!dir || !isAbsolute(dir)) return json(res, 400, { error: "请填写 OpenMausBot 数据目录的完整路径。" });
      const preview = previewOpenMausBot(dir);
      if (!preview) return json(res, 400, { error: "这个文件夹不是 OpenMausBot 的数据目录。" });
      return json(res, 200, { ...preview, applied: false, copied: [], skipped: [] });
    }
    // A backup archive: unpack it, find the data directory, then run the same preview or import.
    if (path === "/api/import/openmausbot/zip" && method === "POST") {
      const body = await readBody(req).catch(() => null) as { path?: unknown; apply?: unknown } | null;
      const archive = typeof body?.path === "string" ? body.path.trim() : "";
      if (!archive || !isAbsolute(archive)) return json(res, 400, { error: "请选择 OpenMausBot 的备份包（.zip / .tar.gz）。" });
      if (!isArchivePath(archive)) return json(res, 400, { error: "只支持 .zip、.tar、.tar.gz 备份包。" });
      let extracted: ReturnType<typeof extractArchive> | null = null;
      try {
        extracted = extractArchive(archive);
        const root = locateDataDir(extracted.root);
        if (!root) return json(res, 400, { error: "备份包里找不到 bots.json，可能不是 OpenMausBot 的数据备份。" });
        const apply = body?.apply === true;
        if (!apply) {
          const preview = previewOpenMausBot(root);
          if (!preview) return json(res, 400, { error: "备份包里的数据目录不完整。" });
          return json(res, 200, { ...preview, source: archive, applied: false, copied: [], skipped: [] });
        }
        const result = importOpenMausBot({ source: root, target: deps.target, apply: true });
        try { writeFileSync(join(deps.target, LAST_IMPORT), JSON.stringify({ ...result, at: new Date().toISOString() }), { mode: 0o600 }); } catch { /* the import itself already succeeded */ }
        if (deps.restart) setTimeout(() => deps.restart?.(), 400);
        return json(res, 200, { ...result, restarting: Boolean(deps.restart) });
      } catch (error) {
        return json(res, 400, { error: error instanceof Error ? error.message : String(error) });
      } finally {
        extracted?.cleanup();
      }
    }

    if (path !== "/api/import/openmausbot" || method !== "POST") return PASS;
    const body = await readBody(req).catch(() => null) as { dir?: unknown; apply?: unknown } | null;
    const dir = typeof body?.dir === "string" ? body.dir.trim() : "";
    if (!dir || !isAbsolute(dir)) return json(res, 400, { error: "请填写 OpenMausBot 数据目录的完整路径。" });
    const apply = body?.apply === true;
    try {
      if (!apply) {
        const preview = previewOpenMausBot(dir);
        if (!preview) return json(res, 400, { error: "这个文件夹不是 OpenMausBot 的数据目录。" });
        return json(res, 200, { ...preview, applied: false, copied: [], skipped: [] });
      }
      const result = importOpenMausBot({ source: dir, target: deps.target, apply: true });
      try { writeFileSync(join(deps.target, LAST_IMPORT), JSON.stringify({ ...result, at: new Date().toISOString() }), { mode: 0o600 }); } catch { /* the import itself already succeeded */ }
      // The running server holds bots in memory; a restart is what makes the merged files the truth. The
      // response must reach the page before the process goes away, so the restart waits a beat.
      if (deps.restart) setTimeout(() => deps.restart?.(), 400);
      return json(res, 200, { ...result, restarting: Boolean(deps.restart) });
    } catch (error) {
      return json(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  };
}