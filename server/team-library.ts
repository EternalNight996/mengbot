import { parseJson, type JsonValue } from "./schema.ts";
import { isBotPackage, parseBotPackage, parsePackageDocument, upgradeV1, type PackageDocument, type ParsedBotPackage } from "./bot-package.ts";
import { PACKAGE_V1_VERSION } from "../shared/package-format.ts";
import { parseTeamManifest, type ParsedTeamManifest } from "./team-manifest.ts";

// The team library now lives on the market site so one cloud host serves both
// the storefront and the two libraries the desktop app loads. The old Teams
// host stays accepted for shareable links so previously copied links keep working.
// OMB_MARKET_BASE points a self-hosted or local mirror at the same layout.
export const TEAM_LIBRARY_REPOSITORY = (process.env.OMB_MARKET_BASE?.trim() || "https://market.mengbot.com.cn").replace(/\/+$/, "");
export const TEAM_LIBRARY_RAW_ROOT = `${TEAM_LIBRARY_REPOSITORY}/files`;
/** The unified API serves the same directory (openmeng.catalog) so the app reads one host; files stay on the market site. */
export const TEAM_LIBRARY_API_BASE = (process.env.OMB_MARKET_API_BASE?.trim() || "https://api.mengbot.com.cn").replace(/\/+$/, "");
export const TEAM_LIBRARY_CATALOG_URL = `${TEAM_LIBRARY_API_BASE}/api/v1/market/teams?format=catalog`;
/** The API's one manifest of where every asset kind lives; the app reads this before the catalog itself. */
export const TEAM_LIBRARY_RESOURCES_URL = `${TEAM_LIBRARY_API_BASE}/api/v1/market/resources`;

const TEAM_LIBRARY_HOSTS = new Set([new URL(TEAM_LIBRARY_REPOSITORY).hostname, "teams.mengbot.com.cn"]);

const MAX_CATALOG_BYTES = 256_000;
const MAX_MANIFEST_BYTES = 1_000_000;
const MAX_RESOURCES_BYTES = 64_000;
/** How long a discovered address is trusted before the API is asked again. */
const RESOURCE_TTL_MS = 5 * 60_000;

export interface TeamLibraryResource {
  /** Where the catalog document is fetched from. */
  catalogUrl: string;
  /** Where the catalog's relative package/manifest paths resolve. */
  filesBase: string;
}

const FALLBACK_RESOURCE: TeamLibraryResource = { catalogUrl: TEAM_LIBRARY_CATALOG_URL, filesBase: TEAM_LIBRARY_RAW_ROOT };

let discovered: { at: number; resource: TeamLibraryResource } | null = null;

/** Tests and a mirror switch call this to forget the last address. */
export function resetTeamLibraryDiscovery(): void {
  discovered = null;
}

/** A manifest address is followed only on the hosts this app already trusts: the storefront and the API. */
function trustedResourceUrl(value: unknown, hosts: Set<string>): string | null {
  if (typeof value !== "string") return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  const loopback = ["127.0.0.1", "localhost"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) || url.username || url.password) return null;
  if (!hosts.has(url.hostname)) return null;
  return url.toString();
}

/** Reads the API's resource manifest and finds the team library's catalog and file root. */
export function teamResourceFromManifest(value: JsonValue): TeamLibraryResource | null {
  if (!isRecord(value) || value.format !== "mengbot.resources" || !Array.isArray(value.resources)) return null;
  const hosts = new Set(TEAM_LIBRARY_HOSTS);
  hosts.add(new URL(TEAM_LIBRARY_API_BASE).hostname);
  const entry = value.resources.find((item) => isRecord(item) && item.kind === "teams");
  if (!isRecord(entry)) return null;
  const catalogUrl = trustedResourceUrl(entry.url, hosts);
  const filesBase = trustedResourceUrl(entry.files, hosts);
  if (!catalogUrl || !filesBase) return null;
  return { catalogUrl, filesBase: filesBase.replace(/\/+$/, "") };
}

/** The team library's address now: the API's manifest when it answers, the built-in one otherwise. */
export async function discoverTeamLibrary(fetcher: Fetcher = fetch, now = Date.now()): Promise<TeamLibraryResource> {
  if (discovered && now - discovered.at < RESOURCE_TTL_MS) return discovered.resource;
  try {
    const parsed = teamResourceFromManifest(await fetchJson(TEAM_LIBRARY_RESOURCES_URL, MAX_RESOURCES_BYTES, fetcher));
    if (parsed) {
      discovered = { at: now, resource: parsed };
      return parsed;
    }
  } catch {
    // The fixed address below keeps the library working while the API or its manifest is unavailable.
  }
  return FALLBACK_RESOURCE;
}

export interface TeamCatalogEntry {
  slug: string;
  name: string;
  summary: string;
  category: string;
  outcome?: string;
  setupMinutes?: number;
  featured?: boolean;
  package?: string;
  manifest: string;
  readme: string;
  members: number;
  skills: string[];
  requires: { apps: string[] };
}

export interface TeamCatalog {
  format: "openmeng.catalog";
  version: 1;
  repositoryUrl: typeof TEAM_LIBRARY_REPOSITORY;
  teams: TeamCatalogEntry[];
}

type Fetcher = typeof fetch;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  const normalized = value.trim();
  if (normalized.length > max) throw new Error(`${field} is too long`);
  return normalized;
}

function relativeFile(value: unknown, field: string, suffix: string, prefix: string): string {
  const path = text(value, field, 300);
  if (
    path.startsWith("/") ||
    path.includes("\\") ||
    path.split("/").some((part) => !part || part === "." || part === "..") ||
    !path.startsWith(prefix) ||
    !path.endsWith(suffix)
  ) {
    throw new Error(`${field} is not a safe catalog path`);
  }
  return path;
}

function stringList(value: unknown, field: string, maxItems: number): string[] {
  if (!Array.isArray(value) || value.length > maxItems) throw new Error(`${field} is invalid`);
  return value.map((item, index) => text(item, `${field}[${index}]`, 100));
}

/** Validate the remotely maintained index before any of it reaches the renderer. */
export function parseTeamCatalog(value: unknown): TeamCatalog {
  const LEGACY_CATALOG_FORMATS = new Set(["openmeng.catalog", "openmaus.catalog"]);
  if (!isRecord(value) || !LEGACY_CATALOG_FORMATS.has(value.format as string) || value.version !== 1) {
    throw new Error("The team library catalog is not supported");
  }
  if (!Array.isArray(value.teams) || value.teams.length > 100) {
    throw new Error("The team library catalog is invalid");
  }
  const slugs = new Set<string>();
  const teams = value.teams.map((raw, index): TeamCatalogEntry => {
    const field = `teams[${index}]`;
    if (!isRecord(raw)) throw new Error(`${field} is invalid`);
    const slug = text(raw.slug, `${field}.slug`, 80);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug) || slugs.has(slug)) {
      throw new Error(`${field}.slug is invalid`);
    }
    slugs.add(slug);
    const prefix = `teams/${slug}/`;
    const requires = isRecord(raw.requires) ? raw.requires : {};
    return {
      slug,
      name: text(raw.name, `${field}.name`, 100),
      summary: text(raw.summary, `${field}.summary`, 300),
      category: text(raw.category, `${field}.category`, 80),
      ...(typeof raw.outcome === "string" ? { outcome: text(raw.outcome, `${field}.outcome`, 300) } : {}),
      ...(typeof raw.setupMinutes === "number" && Number.isSafeInteger(raw.setupMinutes) && raw.setupMinutes > 0 && raw.setupMinutes <= 240
        ? { setupMinutes: raw.setupMinutes }
        : {}),
      ...(typeof raw.featured === "boolean" ? { featured: raw.featured } : {}),
      ...(raw.package !== undefined
        ? { package: relativeFile(raw.package, `${field}.package`, ".md", "packages/") }
        : {}),
      // Older directories still ship the pre-rename manifest file name.
      manifest: (() => {
        const options = [".mengteam.json", ".mausteam.json"] as const;
        let lastError: unknown;
        for (const suffix of options) {
          try {
            return relativeFile(raw.manifest, `${field}.manifest`, suffix, prefix);
          } catch (error) {
            lastError = error;
          }
        }
        throw lastError;
      })(),
      readme: relativeFile(raw.readme, `${field}.readme`, "README.md", prefix),
      members:
        typeof raw.members === "number" && Number.isSafeInteger(raw.members) && raw.members > 0 && raw.members <= 200
          ? raw.members
          : (() => { throw new Error(`${field}.members is invalid`); })(),
      skills: Array.isArray(raw.skills)
        ? raw.skills.map((skill, skillIndex) =>
            relativeFile(skill, `${field}.skills[${skillIndex}]`, "SKILL.md", `${prefix}skills/`),
          )
        : (() => { throw new Error(`${field}.skills is invalid`); })(),
      requires: { apps: stringList(requires.apps ?? [], `${field}.requires.apps`, 30) },
    };
  });
  return {
    format: "openmeng.catalog",
    version: 1,
    repositoryUrl: TEAM_LIBRARY_REPOSITORY,
    teams,
  };
}

async function fetchJson(url: string, maxBytes: number, fetcher: Fetcher): Promise<JsonValue> {
  const response = await fetcher(url, {
    headers: { accept: "application/json, text/plain;q=0.9" },
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const error = Object.assign(new Error(`GitHub returned HTTP ${response.status}`), { status: response.status });
    throw error;
  }
  const announced = Number(response.headers.get("content-length") ?? 0);
  if (announced > maxBytes) throw new Error("The remote team file is too large");
  const raw = await response.text();
  if (Buffer.byteLength(raw) > maxBytes) throw new Error("The remote team file is too large");
  try {
    return parseJson(raw);
  } catch {
    throw new Error("GitHub did not return valid JSON");
  }
}

async function fetchText(url: string, maxBytes: number, fetcher: Fetcher): Promise<string> {
  const response = await fetcher(url, {
    headers: { accept: "text/markdown, text/plain;q=0.9" },
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw Object.assign(new Error(`GitHub returned HTTP ${response.status}`), { status: response.status });
  const announced = Number(response.headers.get("content-length") ?? 0);
  if (announced > maxBytes) throw new Error("The remote team file is too large");
  const raw = await response.text();
  if (Buffer.byteLength(raw) > maxBytes) throw new Error("The remote team file is too large");
  return raw;
}

export async function fetchTeamCatalog(fetcher: Fetcher = fetch): Promise<TeamCatalog> {
  const resource = await discoverTeamLibrary(fetcher);
  return parseTeamCatalog(await fetchJson(resource.catalogUrl, MAX_CATALOG_BYTES, fetcher));
}

export type ParsedShareableTeam = ParsedTeamManifest | ParsedBotPackage | PackageDocument;

function parseShareable(value: JsonValue | string): ParsedShareableTeam {
  if (typeof value === "string") return parseBotPackage(value);
  if (!isBotPackage(value)) return parseTeamManifest(value);
  // A shared team (v2) is read as a file: it cannot claim a publisher.
  return (value as { version?: unknown }).version === 1 ? parseBotPackage(value) : parsePackageDocument(value, { trust: "file" });
}

async function fetchShareable(url: string, fetcher: Fetcher): Promise<ParsedShareableTeam> {
  return url.endsWith(".md")
    ? parseBotPackage(await fetchText(url, MAX_MANIFEST_BYTES, fetcher))
    : parseShareable(await fetchJson(url, MAX_MANIFEST_BYTES, fetcher));
}

export async function fetchLibraryTeam(slug: string, fetcher: Fetcher = fetch): Promise<ParsedShareableTeam> {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error("That team name is invalid");
  const resource = await discoverTeamLibrary(fetcher);
  const catalog = parseTeamCatalog(await fetchJson(resource.catalogUrl, MAX_CATALOG_BYTES, fetcher));
  const entry = catalog.teams.find((team) => team.slug === slug);
  if (!entry) throw Object.assign(new Error("That library team was not found"), { status: 404 });
  return fetchShareable(`${resource.filesBase}/${entry.package ?? entry.manifest}`, fetcher);
}

const MAX_CHIEF_TEAMS = 30;
const MAX_ROLE_TEXT = 280;

export interface LibraryRole { name: string; title: string; does?: string; lead?: true }
export interface LibraryTeamRoles { name: string; summary: string; roles: LibraryRole[] }

const oneLine = (text: string, max: number): string => {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
};

function libraryRoles(team: ParsedShareableTeam): LibraryRole[] {
  const role = (member: { name: string; title?: string; description?: string }, lead: boolean): LibraryRole => ({
    name: member.name, title: member.title?.trim() || "Specialist",
    ...(member.description?.trim() ? { does: oneLine(member.description, MAX_ROLE_TEXT) } : {}),
    ...(lead ? { lead: true as const } : {}),
  });
  if (!("package" in team)) return team.team.members.map((member) => role(member, false));
  const pkg = team.version === PACKAGE_V1_VERSION ? upgradeV1(team).package : team.package;
  return pkg.agents.map((agent) => role(agent, agent.key === pkg.team?.leader));
}

/** Each ready-made team's name, one line and roles: enough for a Chief to create the team itself, one specialist at a
 * time. A team whose file cannot be read keeps its name and summary with no roles. */
export async function libraryTeamRoles(fetcher: Fetcher = fetch): Promise<LibraryTeamRoles[]> {
  const resource = await discoverTeamLibrary(fetcher);
  const catalog = parseTeamCatalog(await fetchJson(resource.catalogUrl, MAX_CATALOG_BYTES, fetcher));
  return Promise.all(catalog.teams.slice(0, MAX_CHIEF_TEAMS).map(async (entry) => ({
    name: entry.name,
    summary: entry.summary,
    roles: await fetchShareable(`${resource.filesBase}/${entry.package ?? entry.manifest}`, fetcher).then(libraryRoles, () => []),
  })));
}

function safeSegment(value: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(value) && value !== "." && value !== "..";
}

/** Public GitHub and team library Markdown playbooks and legacy JSON team files only; other hosts never reach server
 * fetch. The library is the one non-GitHub host: its own site links straight to the files it serves. */
export function githubManifestUrls(input: string): string[] {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Enter a valid GitHub URL");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error("Only public HTTPS GitHub links are supported");
  }
  const parts = url.pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  if (!parts.every(safeSegment)) throw new Error("That GitHub path is not supported");

  if (TEAM_LIBRARY_HOSTS.has(url.hostname)) {
    if (!url.pathname.match(/\.(?:md|json)$/)) throw new Error("The team library link must point to a Markdown playbook or JSON team file");
    return [url.toString()];
  }

  if (url.hostname === "github.com" || url.hostname === "www.github.com") {
    if (parts.length === 2) {
      const [owner, repo] = parts;
      return [
        `https://raw.githubusercontent.com/${owner}/${repo}/main/botmrr.md`,
        `https://raw.githubusercontent.com/${owner}/${repo}/main/team.md`,
        `https://raw.githubusercontent.com/${owner}/${repo}/main/team.mengteam.json`,
        `https://raw.githubusercontent.com/${owner}/${repo}/master/botmrr.md`,
        `https://raw.githubusercontent.com/${owner}/${repo}/master/team.md`,
        `https://raw.githubusercontent.com/${owner}/${repo}/master/team.mengteam.json`,
      ];
    }
    if (parts.length >= 5 && (parts[2] === "blob" || parts[2] === "raw")) {
      const [owner, repo, , ref, ...file] = parts;
      if (!file.at(-1)?.match(/\.(?:md|json)$/)) throw new Error("The GitHub link must point to a Markdown playbook or JSON team file");
      return [`https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${file.join("/")}`];
    }
  }

  if (url.hostname === "raw.githubusercontent.com" && parts.length >= 4) {
    if (!parts.at(-1)?.match(/\.(?:md|json)$/)) throw new Error("The GitHub link must point to a Markdown playbook or JSON team file");
    return [`https://raw.githubusercontent.com/${parts.join("/")}`];
  }

  throw new Error("Paste a GitHub repository, Markdown playbook, or legacy JSON team link");
}

export async function fetchGithubTeam(input: string, fetcher: Fetcher = fetch): Promise<ParsedShareableTeam> {
  const urls = githubManifestUrls(input);
  let lastError: unknown;
  for (const url of urls) {
    try {
      return await fetchShareable(url, fetcher);
    } catch (error) {
      lastError = error;
      if ((error as { status?: number }).status !== 404) throw error;
    }
  }
  throw lastError ?? new Error("No botmrr.md, team.md, or legacy team file was found in that repository");
}
