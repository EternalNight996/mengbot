// GitHub is public and versioned, and the Teams site serves the same Markdown playbooks and JSON team files from its
// own files root (the one its "Add to MengBot" buttons point at); the app already reads its catalog from that host.
const ALLOWED_PACKAGE_HOSTS = new Set([
  "github.com",
  "www.github.com",
  "raw.githubusercontent.com",
  // The market site now serves the team library's files root; keep the old
  // Teams host so links copied before the move still install.
  "market.mengbot.com.cn",
  "teams.mengbot.com.cn",
]);

export function packageUrlFromDeepLink(rawValue) {
  let link;
  try {
    link = new URL(String(rawValue));
  } catch {
    return null;
  }
  if (link.protocol !== "mengbot:" || link.hostname !== "install") return null;
  const rawPackage = link.searchParams.get("url");
  if (!rawPackage) return null;
  let packageUrl;
  try {
    packageUrl = new URL(rawPackage);
  } catch {
    return null;
  }
  if (
    packageUrl.protocol !== "https:" ||
    packageUrl.username ||
    packageUrl.password ||
    packageUrl.port ||
    !ALLOWED_PACKAGE_HOSTS.has(packageUrl.hostname) ||
    !packageUrl.pathname.match(/\.(?:md|json)$/)
  ) return null;
  return packageUrl.toString();
}

export function packageUrlFromCommandLine(argv) {
  for (const value of argv) {
    const parsed = packageUrlFromDeepLink(value);
    if (parsed) return parsed;
  }
  return null;
}
