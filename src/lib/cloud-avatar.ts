/** The Cloud account's avatar, drawn locally from the address: the app never asks the person to pick a photo. */
export function cloudAvatarUrl(email: string): string {
  const initial = Array.from(email.trim())[0]?.toUpperCase() ?? "M";
  let hash = 0;
  for (const char of email) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  const hue = hash;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">' +
    '<rect width="128" height="128" rx="64" fill="hsl(' + hue + ' 68% 52%)"/>' +
    '<text x="64" y="64" dy="0.36em" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,Microsoft YaHei,sans-serif" font-size="58" font-weight="700" fill="#ffffff">' + initial + "</text></svg>";
  return "data:image/svg+xml," + encodeURIComponent(svg);
}
