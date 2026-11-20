// CSV exports from 1Password and Bitwarden, folded into the local vault. Parsing is deliberately
// narrow: only the columns that name a site, a username and a password matter.
import { normalizeLoginHost } from "../shared/logins.ts";

export interface CsvLogin {
  title: string;
  host: string;
  username: string;
  password: string;
  totp?: string;
}

/** A small RFC 4180 reader: quoted fields, escaped quotes and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]!;
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') { field += '"'; i += 1; }
        else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === ",") { row.push(field); field = ""; continue; }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      row.push(field);
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += char;
  }
  row.push(field);
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return rows;
}

function hostFromUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : "https://" + trimmed);
    return normalizeLoginHost(url.hostname);
  } catch {
    return null;
  }
}

/** The rows worth adding: a site we can read, a password, and a username. */
export function parseLoginCsv(text: string): CsvLogin[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0]!.map((cell) => cell.trim().toLowerCase());
  const column = (...names: string[]) => header.findIndex((name) => names.includes(name));
  const titleAt = column("title", "name");
  const urlAt = column("url", "login_uri", "website", "login_url");
  const userAt = column("username", "login_username", "user", "login");
  const passAt = column("password", "login_password");
  const otpAt = column("otpauth", "login_totp", "otp", "one-time password");
  if (urlAt < 0 || passAt < 0) return [];
  const out: CsvLogin[] = [];
  for (const row of rows.slice(1)) {
    const host = hostFromUrl(row[urlAt] ?? "");
    const password = row[passAt] ?? "";
    const username = (userAt >= 0 ? row[userAt] ?? "" : "").trim();
    if (!host || !password || !username) continue;
    out.push({
      title: (titleAt >= 0 ? row[titleAt] ?? "" : "").trim() || host,
      host,
      username,
      password,
      ...(otpAt >= 0 && (row[otpAt] ?? "").trim() ? { totp: (row[otpAt] ?? "").trim() } : {}),
    });
  }
  return out;
}
