export const APP_NAME = "MengBot";
const PLATFORM_NAMES: Record<string, string> = {
  darwin: "macOS",
  win32: "Windows",
  linux: "Linux",
};


export const APP_AUTHOR = "梦游";
export const APP_COMPANY = "惠州市梦游科技有限公司";
export const APP_CONTACT_EMAIL = "eternalnightyeah2@yeah.net";
/** No public repository: support and feedback go to the company mailbox. */
export const SUPPORT_EMAIL_URL = `mailto:${APP_CONTACT_EMAIL}`;
export const APP_REPOSITORY = "";
export const DOCS_URL = "https://docs.mengbot.com.cn";
/** Help opens the docs site; the mailbox remains the fallback when no site is published. */
export const HELP_CENTER_URL = DOCS_URL || SUPPORT_EMAIL_URL;
export const APPROVAL_LEVELS_URL = "";
export const PASSKEY_HELP_URL = "";
/** Feedback opens a mail draft with the build the person is on, so a reply needs no back-and-forth. */
export const FEEDBACK_URL = feedbackDraft();
export const RELEASES_URL = "";
export const PRICING_URL = "";
export const CLOUD_PLAN_URL = "";
/** The Cloud website's account page: signing in is the website's job, so the app hands the browser this address. */
export const CLOUD_ACCOUNT_URL = "https://cloud.mengbot.com.cn/account";
function feedbackDraft(): string {
  const platform = typeof window !== "undefined" ? platformLabel(window.ogb?.platform) : null;
  const body = ["", "", "---", `版本：${appVersion()}`, ...(platform ? [`平台：${platform}`] : [])].join("\n");
  return `mailto:${APP_CONTACT_EMAIL}?subject=${encodeURIComponent("MengBot 反馈")}&body=${encodeURIComponent(body)}`;
}

export function withSource(url: string, source: string): string {
  const target = new URL(url);
  target.searchParams.set("src", source);
  return target.href;
}
export const LICENSE_URL = "";
export const IOS_APP_STORE_URL = "";
export const ANDROID_APK_URL = "";

export function appVersion(): string {
  return typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
}

export function platformLabel(platform?: string): string | null {
  return (platform && PLATFORM_NAMES[platform]) ?? null;
}

export async function openExternalLink(url: string): Promise<void> {
  if (window.ogb?.openExternal) {
    await window.ogb.openExternal(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/** A browser hands a mailto: link to its own mail app; the desktop app's window may not navigate to one, so main opens it. */
export async function openEmailDraft(url: string): Promise<void> {
  if (window.ogb) return openExternalLink(url);
  window.location.href = url;
}