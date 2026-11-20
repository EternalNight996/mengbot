import { z } from "zod";

import type { WireBot } from "../../shared/wire.ts";
import type { BotRecord, Store } from "../store.ts";
import type { TeamComputers } from "../team-computers.ts";
import { PASS, type RouteHandler } from "./table.ts";

const SECTION_ERRORS: Record<string, string> = {
  "No such department": "部门不存在",
  "Department name must be 1 to 60 characters without control characters": "部门名称需为 1–60 个字符，且不能包含控制字符",
  "A department with that name already exists": "同名部门已存在",
  "Stop this department's active work before renaming it": "请先停止该部门正在运行的任务，再重命名",
  "Stop this department's active work before deleting it": "请先停止该部门正在运行的任务，再删除",
  "Move all bots (including archived bots) and group chats out of this department first": "请先把所有机器人（包括已归档的机器人和群聊）移出该部门",
  "General already has a Chief of Staff. Move or change this department's Chief before deleting it": "总协调已存在，请先移动或更换该部门的总协调，再删除部门",
};

function sectionError(message: string | undefined): string {
  if (!message) return "部门操作失败，请重试";
  return SECTION_ERRORS[message] ?? message;
}

export interface SidebarSectionRouteDeps {
  store: Store;
  teamComputers: TeamComputers;
  maxBots: number;
  assertTeamComputerChangeIdle(before: BotRecord, after: BotRecord): void;
  wireBot(bot: BotRecord): WireBot;
}

export function createSidebarSectionRoutes(deps: SidebarSectionRouteDeps): RouteHandler {
  const { store, teamComputers, assertTeamComputerChangeIdle, wireBot } = deps;
  const MAX_WORKSPACE_BOTS = deps.maxBots;
  const createSidebarSectionSchema = z.object({
    name: z.string(),
    botIds: z.array(z.string().regex(/^[\w-]+$/)).max(MAX_WORKSPACE_BOTS).default([]),
  }).strict();

  return async ({ req, res, url, path, method, json, readBody }) => {
    if (path === "/api/sidebar-sections" && method === "GET") {
      return json(res, 200, { sections: store.sections });
    }
    if (path === "/api/sidebar-sections" && (method === "PATCH" || method === "DELETE")) {
      const section = url.searchParams.get("section")?.trim();
      if (!section) return json(res, 400, { error: "请选择部门" });
      if (method === "DELETE" && teamComputers.forSection(section)) return json(res, 409, { error: "删除部门前请先解绑该部门的电脑" });
      let nextName: string | null = null;
      if (method === "PATCH") {
        const parsed = z.object({ name: z.string().trim().min(1).max(60) }).strict().safeParse(await readBody(req));
        if (!parsed.success) return json(res, 400, { error: "部门名称需为 1–60 个字符" });
        nextName = parsed.data.name;
      }
      const error = nextName === null ? store.deleteSection(section) : store.renameSection(section, nextName, teamComputers);
      if (error) return json(res, error === "No such department" ? 404 : 409, { error: sectionError(error) });
      return json(res, 200, { sections: store.sections });
    }
    if (method === "PUT" && path === "/api/sidebar-sections") {
      const section = url.searchParams.get("section")?.trim();
      if (!section || !store.sections.includes(section)) return json(res, 404, { error: "部门不存在" });
      const ids = z.array(z.string().regex(/^[\w-]+$/)).max(MAX_WORKSPACE_BOTS);
      const parsed = z.object({ addBotIds: ids, removeBotIds: ids }).strict().safeParse(await readBody(req));
      if (!parsed.success) return json(res, 400, { error: "请提供要加入和移除的机器人" });
      for (const [botIds, destination] of [[parsed.data.addBotIds, section], [parsed.data.removeBotIds, undefined]] as const) {
        for (const id of botIds) {
          const bot = store.bot(id);
          if (bot) assertTeamComputerChangeIdle(bot, { ...bot, section: destination });
        }
      }
      const result = store.updateTeamMembers(section, parsed.data.addBotIds, parsed.data.removeBotIds);
      if (!result.ok) return json(res, result.reason === "unavailable" ? 404 : 409, { error:
        result.reason === "chief-conflict" ? "一个部门只能有一个总协调机器人，请先更换总协调再移动该机器人。"
          : result.reason === "membership-changed" ? "部门成员已变化，请关闭弹窗后重试。"
          : "有机器人不可用。" });
      return json(res, 200, { sections: store.sections, bots: result.bots.map(wireBot) });
    }
    if (method === "POST" && path === "/api/sidebar-sections") {
      const parsed = createSidebarSectionSchema.safeParse(await readBody(req));
      if (!parsed.success) {
        return json(res, 400, { error: "请填写部门名称，并最多选择 100 个有效机器人" });
      }
      const name = parsed.data.name.trim();
      if (name.length > 60) {
        return json(res, 400, { error: "部门名称最多 60 个字符" });
      }
      const botIds = [...new Set(parsed.data.botIds)];
      if (!name && !botIds.length) return json(res, 400, { error: "请填写部门名称" });
      for (const botId of botIds) {
        const bot = store.bot(botId);
        if (bot) assertTeamComputerChangeIdle(bot, { ...bot, section: name || undefined });
      }
      const result = store.setBotsSection(botIds, name);
      if (!result.ok) {
        if (result.reason === "chief-conflict") {
          return json(res, 409, {
            error: "一个部门只能有一个总协调机器人，请选择一个总协调，或使用不含总协调的部门。",
          });
        }
        return json(res, 404, { error: "有机器人不可用" });
      }
      return json(res, 200, { section: name, sections: store.sections, bots: result.bots.map(wireBot) });
    }
    return PASS;
  };
}
