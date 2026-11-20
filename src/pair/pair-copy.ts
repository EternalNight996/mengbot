import { activeLocale } from "../lib/i18n";
import { productName } from "../lib/brand";

/** Copy for the pairing page. Chinese first (the China edition defaults to zh); English keeps the
 * exact wording the page shipped with, so tests and existing docs still match. */
export interface PairCopy {
  openingCloud: string;
  connectingTo: (label: string) => string;
  title: (mode: "email" | "code", label: string) => string;
  myCloud: string;
  intro: (input: { mode: "email" | "code" | null; sent: boolean; email: string; cloudHome: boolean }) => string;
  versionOn: (version: string, platform: string) => string;
  expiredLink: string;
  alreadyConnected: string;
  openApp: string;
  email: string;
  emailCode: string;
  thisDevice: string;
  pairingCode: string;
  sendCode: string;
  sending: string;
  signIn: string;
  signingIn: string;
  sendNewCode: string;
  haveCode: string;
  signInWithEmail: string;
  connect: string;
  connecting: string;
  switchTo: string;
}

const en: PairCopy = {
  openingCloud: "Opening the Cloud…",
  connectingTo: (label) => `Connecting to ${label}…`,
  title: (mode, label) => `${mode === "email" ? "Sign in to" : "Connect to"} ${label}`,
  myCloud: "My Cloud",
  intro: ({ mode, sent, email, cloudHome }) => {
    if (mode === "email") return sent ? `We emailed an 8-digit code to ${email}. It works once and expires in ten minutes.` : "Enter your email and we will send you a one-time code.";
    if (cloudHome) return `To open the Cloud, choose Open the Cloud in the ${productName()} app on your computer (Settings → Cloud), or Use in your browser on your Plan page. Have a pairing code? Enter it below.`;
    return "Enter the pairing code shown on the server. Codes work once and expire after five minutes.";
  },
  versionOn: (version, platform) => `Version ${version} on ${platform}. `,
  expiredLink: `This link has expired or was already used. In the ${productName()} app on your computer, open Settings → Cloud and choose Open the Cloud.`,
  alreadyConnected: "This browser is already connected.",
  openApp: "Open the app",
  email: "Email",
  emailCode: "Code from the email",
  thisDevice: "This device",
  pairingCode: "Pairing code",
  sendCode: "Send code",
  sending: "Sending…",
  signIn: "Sign in",
  signingIn: "Signing in…",
  sendNewCode: "Send a new code",
  haveCode: "Have a pairing code instead?",
  signInWithEmail: "Sign in with your email instead",
  connect: "Connect",
  connecting: "Connecting…",
  switchTo: "中文",
};

const zh: PairCopy = {
  openingCloud: "正在打开云端…",
  connectingTo: (label) => `正在连接 ${label}…`,
  title: (mode, label) => `${mode === "email" ? "登录" : "连接到"} ${label}`,
  myCloud: "我的云",
  intro: ({ mode, sent, email, cloudHome }) => {
    if (mode === "email") return sent ? `我们已向 ${email} 发送了 8 位验证码。它只能使用一次，十分钟内有效。` : "输入你的邮箱，我们会给你发一个一次性验证码。";
    if (cloudHome) return `要打开云端，请在电脑上的 ${productName()} 应用中选择“打开云端”（设置 → 云端），或在方案页点“在浏览器中使用”。已有配对码？在下面输入。`;
    return "请输入服务器上显示的配对码。配对码只能使用一次，五分钟后失效。";
  },
  versionOn: (version, platform) => `版本 ${version}，运行于 ${platform}。`,
  expiredLink: `此链接已过期或已被使用。请在电脑上的 ${productName()} 应用里打开 设置 → 云端，选择“打开云端”。`,
  alreadyConnected: "此浏览器已经连接过了。",
  openApp: "打开应用",
  email: "邮箱",
  emailCode: "邮件中的验证码",
  thisDevice: "此设备",
  pairingCode: "配对码",
  sendCode: "发送验证码",
  sending: "发送中…",
  signIn: "登录",
  signingIn: "登录中…",
  sendNewCode: "重新发送验证码",
  haveCode: "改用配对码",
  signInWithEmail: "改用邮箱登录",
  connect: "连接",
  connecting: "连接中…",
  switchTo: "English",
};

/** The copy for the language the app is showing right now. */
export function pairCopy(): PairCopy {
  return activeLocale().toLowerCase().startsWith("zh") ? zh : en;
}

export const pairCopyForTests = { en, zh };
