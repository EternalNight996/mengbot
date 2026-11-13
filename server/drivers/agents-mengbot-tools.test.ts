import { describe, expect, it } from "vitest";

import { availableTools, catalogProfileFromEnv, fullInputSchema } from "./agents-catalog.ts";
import { MENGBOT_TOOL_DEFINITIONS } from "./agents-mengbot-tools.ts";

const listed = (env: Record<string, string>) => availableTools(catalogProfileFromEnv({ OMB_BOT_ID: "meng", OMB_CHIEF_OF_STAFF: "1", ...env }));

describe("MengBot's two notification tools on the wire", () => {
  const meng = listed({ OMB_MENGBOT: "1" }).slice(-2) as Array<{ name: string; inputSchema: Record<string, any> }>;

  it("are listed last, in this order, only with OMB_MENGBOT", () => {
    expect(meng.map((tool) => tool.name)).toEqual(["list_unread_notifications", "mark_notifications_read"]);
    for (const env of [{}, { OMB_MENGBOT: "0" }, { OMB_MENGBOT: "true" }] as Array<Record<string, string>>) {
      expect(listed(env).map((tool) => tool.name)).not.toEqual(expect.arrayContaining(["mark_notifications_read"]));
    }
  });

  it("keep flat, closed schemas with the required fields", () => {
    expect(meng.map((tool) => [tool.inputSchema.type, tool.inputSchema.additionalProperties, Object.keys(tool.inputSchema.properties), tool.inputSchema.required ?? []])).toEqual([
      ["object", false, [], []],
      ["object", false, ["ids"], ["ids"]],
    ]);
    expect(meng[1]!.inputSchema.properties.ids).toEqual({ type: "array", items: { type: "string" } });
    expect(fullInputSchema("mark_notifications_read")).toMatchObject({ properties: { ids: { type: "array", maxItems: 40 } } });
    expect(JSON.stringify(MENGBOT_TOOL_DEFINITIONS)).not.toMatch(/"(oneOf|anyOf|allOf|const|format)"/);
  });
});
