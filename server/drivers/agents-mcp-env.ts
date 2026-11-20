import { TOOL_BRIDGE_ENV } from "./agents-bridge.ts";
import { TOOL_LIMIT_ENV } from "../tool-count-limit.ts";

/** The settings the harness gives the agents MCP server, and the only ones a request may carry over HTTP. */
export const AGENTS_MCP_ENV = ["MB_BOT_ID", "MB_THREAD_ID", "MB_TURN_DEPTH", "MB_EXTERNAL_RUNTIME", "MB_CHIEF_OF_STAFF",
  "MB_SKILL_AUTHORING_ENABLED", "MB_MEMORY_ENABLED", "MB_SHARED_COMPUTERS_ENABLED", "MB_CLOUD_HOME", "MB_VOICE_NOTES",
  "MB_X_RESEARCH", "MB_RESEARCH", "MB_ESCALATIONS", "MB_TEAM_PEOPLE", "MB_MENGBOT", "MB_COMPUTER_SELECTION", "MB_ROOM", TOOL_BRIDGE_ENV, TOOL_LIMIT_ENV] as const;
