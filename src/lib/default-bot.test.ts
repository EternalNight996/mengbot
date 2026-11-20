import { describe, expect, it } from "vitest";

import { chiefChoices, chiefFor, chiefStepFits, createChiefPatch, hiddenFromSidebar, INTRO_CHIPS, introChips, myDefaultBot, setupSteps, someoneElsesDefaultBot } from "./default-bot";
import { partitionSidebarBots } from "./sidebar-layout";
import type { DefaultBotFields } from "../../shared/default-bot";

const bot = (id: string, fields: DefaultBotFields = {}): DefaultBotFields & { id: string } => ({ id, ...fields });

describe("MengBot in the sidebar", () => {
  it("leaves out a MengBot whose Show switch is off, and on a Team Cloud other people's, but keeps the viewer's own", () => {
    const bots = [
      bot("meng", { defaultBot: {} }),
      bot("ada-meng", { defaultBot: { person: "ada@example.com" } }),
      bot("bea-meng", { defaultBot: { person: "bea@example.com" } }),
      bot("writer"),
    ];
    const shown = (viewerEmail: string | null) => partitionSidebarBots(bots, { viewerEmail }).unsectionedBots.map((entry) => entry.id);
    expect(shown("ada@example.com")).toEqual(["meng", "ada-meng", "writer"]);
    expect(shown(null)).toEqual(["meng", "writer"]);
    bots[0] = bot("meng", { defaultBot: {}, sidebarHidden: true });
    expect(shown(null)).toEqual(["writer"]);
    expect(hiddenFromSidebar(bots[0]!, null)).toBe(true);
    expect(someoneElsesDefaultBot(bots[2]!, "ADA@example.com".toLowerCase())).toBe(true);
  });

  it("finds the viewer's own MengBot: their own on a team, the place's otherwise, none until the viewer is known", () => {
    const team = [bot("ada-meng", { defaultBot: { person: "ada@example.com" } }), bot("writer")];
    expect(myDefaultBot(team, undefined)).toBeUndefined();
    expect(myDefaultBot(team, "ada@example.com")?.id).toBe("ada-meng");
    expect(myDefaultBot(team, "bea@example.com")).toBeUndefined();
    const place = [bot("writer"), bot("meng", { defaultBot: {} })];
    expect(myDefaultBot(place, null)?.id).toBe("meng");
    expect(myDefaultBot(place, "owner@example.com")?.id).toBe("meng");
  });
});

describe("MengBot's identity is its mark, never its name", () => {
  it("keeps finding a renamed MengBot for the Settings switch and the sidebar, and keeps it out of the list while its welcome is open", () => {
    const bots = [bot("writer"), { ...bot("meng", { defaultBot: {} }), name: "Jarvis" }];
    expect(myDefaultBot(bots, null)?.id).toBe("meng");
    expect(partitionSidebarBots(bots, { viewerEmail: null }).unsectionedBots.map((entry) => entry.id)).toEqual(["writer", "meng"]);
    expect(partitionSidebarBots(bots, { viewerEmail: null, welcoming: "meng" }).unsectionedBots.map((entry) => entry.id)).toEqual(["writer"]);
  });
});

describe("what MengBot offers to set up", () => {
  const fresh = { aiReady: false, ownBots: 0, onCloud: false, team: false, remote: false };

  it("in Advanced mode, as on a new install before: an AI, bots, apps, the phone and the Cloud", () => {
    expect(setupSteps(fresh)).toEqual(["ai", "bots", "apps", "phone", "cloud"]);
    expect(setupSteps({ ...fresh, aiReady: true, onCloud: true })).toEqual(["bots", "apps", "phone"]);
    expect(setupSteps({ ...fresh, ownBots: 3 })).toEqual(["ai"]);
    expect(setupSteps({ ...fresh, team: true })).toEqual([]);
  });

  it("in Simple mode, chips for only what its look around found missing, in order: AI, apps, skills, phone, Cloud", () => {
    expect(introChips(fresh)).toEqual(["ai", "apps", "phone", "cloud"]);
    expect(introChips({ ...fresh, aiReady: true, importFound: true })).toEqual(["apps", "import", "phone", "cloud"]);
    expect(introChips({ ...fresh, aiReady: true, appsConnected: true, phonePaired: true })).toEqual(["cloud"]);
    expect(introChips({ ...fresh, aiReady: true, remote: true })).toEqual(["apps", "phone"]);
    expect(introChips({ ...fresh, aiReady: true, onCloud: true, importFound: false })).toEqual(["apps", "phone"]);
    expect(INTRO_CHIPS).toBe(3);
  });

  it("never offers a bot (the sidebar's + adds one), nor nags a person who is set up or a Team Cloud member", () => {
    expect(introChips(fresh)).not.toContain("bots");
    expect(introChips({ ...fresh, aiReady: true, ownBots: 3, importFound: true })).toEqual([]);
    expect(introChips({ ...fresh, ownBots: 3 })).toEqual(["ai"]);
    expect(introChips({ ...fresh, team: true })).toEqual([]);
  });
});

describe("the first run's Chief step", () => {
  const meng = { id: "meng", defaultBot: {}, chiefOfStaff: true };

  it("shows for a MengBot not yet introduced, where it is the Chief or there is none", () => {
    expect(chiefStepFits([meng], meng)).toBe(true);
    expect(chiefStepFits([{ ...meng, chiefOfStaff: false }], { ...meng, chiefOfStaff: false })).toBe(true);
  });

  it("is skipped where another bot is the Chief, once MengBot has met the person, and with no MengBot", () => {
    const other = { ...meng, chiefOfStaff: false };
    expect(chiefStepFits([other, { id: "research", chiefOfStaff: true }], other)).toBe(false);
    expect(chiefStepFits([{ ...meng, welcomed: true }], { ...meng, welcomed: true })).toBe(false);
    expect(chiefStepFits([{ id: "research" }], undefined)).toBe(false);
  });

  it("keeps a Chief in another department out of it", () => {
    const other = { ...meng, chiefOfStaff: false };
    expect(chiefStepFits([other, { id: "sales", chiefOfStaff: true, section: "Sales" }], other)).toBe(true);
  });
});

describe("who becomes the Chief of Staff on the first run", () => {
  type Candidate = { id: string; defaultBot?: { person?: string }; chiefOfStaff?: boolean; section?: string; hidden?: boolean };
  const meng: Candidate = { id: "meng", defaultBot: {}, chiefOfStaff: true };
  const research: Candidate = { id: "research" };

  it("finds the Chief in MengBot's own department, never a department's or a hidden one", () => {
    expect(chiefFor([meng, research], meng)?.id).toBe("meng");
    expect(chiefFor([{ ...meng, chiefOfStaff: false }, { ...research, chiefOfStaff: true }], meng)?.id).toBe("research");
    expect(chiefFor([{ ...meng, chiefOfStaff: false }, { id: "sales", section: "Sales", chiefOfStaff: true }], meng)).toBeUndefined();
    expect(chiefFor([{ ...meng, chiefOfStaff: false }, { id: "old", chiefOfStaff: true, hidden: true }], meng)).toBeUndefined();
  });

  it("offers the person's own bots there to choose from, never MengBot, a hidden bot or someone else's", () => {
    const bots: Candidate[] = [meng, research, { id: "sales", section: "Sales" }, { id: "gone", hidden: true }, { id: "ada-meng", defaultBot: { person: "ada@example.com" } }];
    expect(chiefChoices(bots, meng, null).map((bot) => bot.id)).toEqual(["research"]);
    expect(chiefChoices([meng], meng, null)).toEqual([]);
  });

  it("Create makes MengBot the Chief only where there is none, and never takes the role from a Chief someone has", () => {
    expect(createChiefPatch({ defaultBot: {} }, undefined)).toEqual({ welcomed: true, chiefOfStaff: true });
    expect(createChiefPatch({ defaultBot: {} }, meng)).toEqual({ welcomed: true });
    expect(createChiefPatch({ defaultBot: {}, sidebarHidden: true }, meng), "back in the sidebar").toEqual({ welcomed: true, sidebarHidden: false });
  });
});
