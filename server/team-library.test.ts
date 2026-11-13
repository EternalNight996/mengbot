import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TEAM_LIBRARY_CATALOG_URL, TEAM_LIBRARY_RAW_ROOT, TEAM_LIBRARY_RESOURCES_URL, discoverTeamLibrary, fetchGithubTeam, fetchLibraryTeam, fetchTeamCatalog, githubManifestUrls, libraryTeamRoles, parseTeamCatalog, resetTeamLibraryDiscovery, teamResourceFromManifest, TEAM_LIBRARY_REPOSITORY } from "./team-library.ts";

const manifest = {
  format: "openmeng.team",
  version: 2,
  team: {
    name: "Engineering",
    members: [
      {
        key: "lead",
        name: "Ada",
        title: "Tech Lead",
        description: "Coordinates the work",
        appearance: { color: "purple" },
      },
    ],
  },
};

const catalog = {
  format: "openmeng.catalog",
  version: 1,
  teams: [
    {
      slug: "engineering",
      name: "Engineering Team",
      summary: "Plan and ship software.",
      category: "Engineering",
      manifest: "teams/engineering/team.mengteam.json",
      readme: "teams/engineering/README.md",
      members: 1,
      skills: ["teams/engineering/skills/release/SKILL.md"],
      requires: { apps: ["GitHub"] },
    },
  ],
};

/** The API's address manifest: one entry per asset kind, the team files staying on the storefront. */
const resources = {
  format: "mengbot.resources",
  version: 1,
  resources: [
    { kind: "teams", url: TEAM_LIBRARY_CATALOG_URL, format: "openmaus.catalog", files: TEAM_LIBRARY_RAW_ROOT },
  ],
};

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("team library", () => {
  beforeEach(() => resetTeamLibraryDiscovery());

  it("validates catalog paths and adds the trusted repository URL", () => {
    const parsed = parseTeamCatalog(catalog);
    expect(parsed.repositoryUrl).toBe(TEAM_LIBRARY_REPOSITORY);
    expect(parsed.teams[0]).toMatchObject({ slug: "engineering", members: 1 });

    const unsafe = structuredClone(catalog);
    unsafe.teams[0]!.manifest = "../private.json";
    expect(() => parseTeamCatalog(unsafe)).toThrow("safe catalog path");
  });

  it("loads only the manifest selected by the trusted catalog", async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target === TEAM_LIBRARY_RESOURCES_URL) return response(resources);
      if (target === TEAM_LIBRARY_CATALOG_URL) return response(catalog);
      if (target === `${TEAM_LIBRARY_RAW_ROOT}/teams/engineering/team.mengteam.json`) return response(manifest);
      return response({}, 404);
    }) as unknown as typeof fetch;

    const loaded = await fetchLibraryTeam("engineering", fetcher);
    if (loaded.format !== "openmeng.team") throw new Error("expected a legacy team");
    expect(loaded.team.name).toBe("Engineering");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("normalizes public GitHub repository, blob, and raw links", () => {
    expect(githubManifestUrls("https://github.com/acme/team")).toEqual([
      "https://raw.githubusercontent.com/acme/team/main/botmrr.md",
      "https://raw.githubusercontent.com/acme/team/main/team.md",
      "https://raw.githubusercontent.com/acme/team/main/team.mengteam.json",
      "https://raw.githubusercontent.com/acme/team/master/botmrr.md",
      "https://raw.githubusercontent.com/acme/team/master/team.md",
      "https://raw.githubusercontent.com/acme/team/master/team.mengteam.json",
    ]);
    expect(githubManifestUrls("https://github.com/acme/team/blob/main/presets/seo.mengteam.json")).toEqual([
      "https://raw.githubusercontent.com/acme/team/main/presets/seo.mengteam.json",
    ]);
    expect(githubManifestUrls("https://raw.githubusercontent.com/acme/team/main/team.mengteam.json")).toEqual([
      "https://raw.githubusercontent.com/acme/team/main/team.mengteam.json",
    ]);
    const marketPackage = `https://${new URL(TEAM_LIBRARY_REPOSITORY).hostname}/files/packages/engineering.md`;
    expect(githubManifestUrls(marketPackage)).toEqual([marketPackage]);
    // Links copied before the library moved to the market host still install.
    expect(githubManifestUrls("https://teams.mengbot.com.cn/files/packages/engineering.md")).toEqual([
      "https://teams.mengbot.com.cn/files/packages/engineering.md",
    ]);
    expect(() => githubManifestUrls("https://teams.mengbot.com.cn/files/packages/engineering.sh")).toThrow("team library link");
    expect(() => githubManifestUrls("http://example.com/team.json")).toThrow("public HTTPS GitHub");
    expect(() => githubManifestUrls("https://github.com/acme/team/blob/main/run.sh")).toThrow("Markdown playbook");
  });

  it("falls back from main to master for a repository link", async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) =>
      String(url).endsWith("team.mengteam.json") && String(url).includes("/master/")
        ? response(manifest)
        : response({}, 404),
    ) as unknown as typeof fetch;

    const loaded = await fetchGithubTeam("https://github.com/acme/team", fetcher);
    if (loaded.format !== "openmeng.team") throw new Error("expected a legacy team");
    expect(loaded.team.members[0]?.name).toBe("Ada");
    expect(fetcher).toHaveBeenCalledTimes(6);
  });

  it("loads a shared team file (package v2) from GitHub as a file, without its claimed publisher", async () => {
    const shared = JSON.parse(readFileSync(join(import.meta.dirname, "..", "shared", "fixtures", "full-team.v2.json"), "utf8"));
    const fetcher = vi.fn(async () => response(shared)) as unknown as typeof fetch;
    const loaded = await fetchGithubTeam("https://github.com/acme/team/blob/main/sales-desk-1.3.0.openmeng.json", fetcher);
    if (loaded.format !== "openmeng.package" || loaded.version !== 2) throw new Error("expected a shared team");
    expect(loaded.package.team?.name).toBe("Sales desk");
    expect(loaded.package.publisher).toBeUndefined();
  });
});

describe("resource discovery", () => {
  beforeEach(() => resetTeamLibraryDiscovery());

  it("follows the address the API gives, then parses that catalog", async () => {
    const mirror = `${TEAM_LIBRARY_RAW_ROOT}/mirror/catalog.json`;
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target === TEAM_LIBRARY_RESOURCES_URL) {
        return response({ format: "mengbot.resources", version: 1, resources: [
          { kind: "teams", url: mirror, format: "openmaus.catalog", files: TEAM_LIBRARY_RAW_ROOT },
        ] });
      }
      if (target === mirror) return response(catalog);
      return response({}, 404);
    }) as unknown as typeof fetch;

    expect(await discoverTeamLibrary(fetcher)).toEqual({ catalogUrl: mirror, filesBase: TEAM_LIBRARY_RAW_ROOT });
    expect((await fetchTeamCatalog(fetcher)).teams[0]!.slug).toBe("engineering");
    expect(vi.mocked(fetcher).mock.calls.map((call) => String(call[0]))).toEqual([TEAM_LIBRARY_RESOURCES_URL, mirror]);
  });

  it("ignores an address on a host this app does not trust", () => {
    const hostile = {
      format: "mengbot.resources",
      version: 1,
      resources: [{ kind: "teams", url: "https://evil.example/catalog.json", format: "openmaus.catalog", files: "https://evil.example/files" }],
    } as unknown as Parameters<typeof teamResourceFromManifest>[0];
    expect(teamResourceFromManifest(hostile)).toBeNull();
  });

  it("keeps the built-in address while the manifest is unavailable", async () => {
    const fetcher = vi.fn(async () => response({}, 503)) as unknown as typeof fetch;
    expect(await discoverTeamLibrary(fetcher)).toEqual({ catalogUrl: TEAM_LIBRARY_CATALOG_URL, filesBase: TEAM_LIBRARY_RAW_ROOT });
  });
});

describe("the team library as a Chief of Staff reads it", () => {
  const entry = (slug: string, name: string, summary: string, file: { package?: string }) => ({
    ...catalog.teams[0]!, slug, name, summary, ...file,
    manifest: `teams/${slug}/team.mengteam.json`, readme: `teams/${slug}/README.md`, members: 2, skills: [],
  });
  const fixture = (name: string) => readFileSync(join(import.meta.dirname, "..", "shared", "fixtures", name), "utf8");
  const long = { ...manifest, team: { ...manifest.team, members: [{ ...manifest.team.members[0]!, description: `Plans the work.\n\n${"Checks every step. ".repeat(30)}` }] } };
  const library = {
    ...catalog,
    teams: [
      catalog.teams[0]!,
      entry("signal-desk", "Signal Desk", "Find and explain the signal.", { package: "packages/signal-desk.md" }),
      entry("sales-desk", "Sales Desk", "Sell the team plan.", {}),
      entry("gone", "Gone", "Its file is missing.", {}),
      entry("long", "Long", "One very long role.", {}),
    ],
  };
  const fetcher = vi.fn(async (url: string | URL | Request) => {
    if (String(url) === TEAM_LIBRARY_RESOURCES_URL) return response(resources);
    const target = String(url).slice(TEAM_LIBRARY_RAW_ROOT.length + 1);
    if (String(url) === TEAM_LIBRARY_CATALOG_URL) return response(library);
    if (target === "teams/engineering/team.mengteam.json") return response(manifest);
    if (target === "packages/signal-desk.md") return new Response(fixture("legacy-botmrr.v1.md"));
    if (target === "teams/sales-desk/team.mengteam.json") return new Response(fixture("full-team.v2.json"));
    if (target === "teams/long/team.mengteam.json") return response(long);
    return response({}, 404);
  }) as unknown as typeof fetch;

  it("lists every ready-made team with its summary and roles, marks the team's own lead, and keeps a team whose file is missing", async () => {
    const teams = await libraryTeamRoles(fetcher);
    expect(teams.slice(0, 4)).toEqual([
      { name: "Engineering Team", summary: "Plan and ship software.", roles: [{ name: "Ada", title: "Tech Lead", does: "Coordinates the work" }] },
      { name: "Signal Desk", summary: "Find and explain the signal.", roles: [
        { name: "Package Scout", title: "Researcher", does: "Find evidence.", lead: true },
        { name: "Package Editor", title: "Editor", does: "Explain the result." },
      ] },
      { name: "Sales Desk", summary: "Sell the team plan.", roles: [
        { name: "Morgan", title: "Sales lead", does: "Owns the pipeline and the final answer.", lead: true },
        { name: "Scout", title: "Prospect researcher", does: "Finds and qualifies prospects." },
        { name: "Quill", title: "Outreach writer", does: "Drafts outreach for approval." },
      ] },
      { name: "Gone", summary: "Its file is missing.", roles: [] },
    ]);
    const does = teams[4]!.roles[0]!.does!;
    expect(does.startsWith("Plans the work. Checks every step.")).toBe(true);
    expect(does.length).toBe(280);
    expect(does.endsWith("…")).toBe(true);
  });

  it("fails when the catalog itself can't be read", async () => {
    await expect(libraryTeamRoles(vi.fn(async () => response({}, 503)) as unknown as typeof fetch)).rejects.toThrow("HTTP 503");
  });
});
