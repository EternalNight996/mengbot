// Localizes hardcoded English strings that components still render directly.
// This is a stopgap: new strings should use t(), and this map shrinks over time.
import en from "@/locales/en.json";
import zh from "@/locales/zh.json";
import { activeLocale } from "@/lib/i18n";

const manual: Record<string, string> = {
  "Move every time it repeats?": "每次重复都要移动吗？",
  "Push to talk": "按住说话",
  "Restore size": "恢复大小",
  "A group member": "群成员",
  "Show diagram source": "显示图表源码",
  "Hide diagram source": "隐藏图表源码",
  "Diagram source copied to clipboard": "图表源码已复制",
  "Copy diagram source to clipboard": "复制图表源码到剪贴板",
  "Cite selected text": "引用选中文本",
  "The app's server refused this.": "应用服务拒绝了该请求。",
  "Bot deleted": "机器人已删除",
  "Team setup applied": "团队设置已应用",
  "Create a bot first — groups are made of bots.": "请先创建机器人：群组由机器人组成。",
  "Profile save failed": "保存资料失败",
  "Choose a valid schedule.": "请选择有效的日程。",
  "Choose a supported call schedule.": "请选择支持的通话日程。",
  "Add call title": "添加通话标题",
  "Choose the lead": "选择负责人",
  "What should the team accomplish?": "团队要完成什么？",
  "Schedule call": "安排通话",
  "Schedule team goal": "安排团队目标",
  "What should the bot do?": "机器人要做什么？",
  "No time limit": "不限时间",
  "Deferred: target busy": "已延后：目标忙碌",
  "Saved securely.": "已安全保存。",
  "Save securely": "安全保存",
  "Choose a PNG, JPEG, GIF, or WebP image": "请选择 PNG、JPEG、GIF 或 WebP 图片",
  "No such draft skill": "草稿技能不存在",
  "The upload was refused.": "上传被拒绝。",
  "Dismissed by user.": "用户已忽略。",
  "The request was aborted.": "请求已中止。",
  "Attached file": "附件",
  "Create the Local VM": "创建本地虚拟机",
  "Accessibility": "无障碍",
  "Show computers": "显示电脑",
  "Copied to clipboard!": "已复制到剪贴板！",
  "Save access": "保存权限",
  "Share selected access": "分享所选权限",
  "Temporary browser": "临时浏览器",
  "Connecting…": "连接中…",
  "Search or enter address": "搜索或输入地址",
  "You have control": "你已获得控制权",
  "Held on another device": "已在其他设备上控制",
  "Message from": "来自",
  "Delegated by": "委派自",
  "Task started": "任务已开始",
  "Who reports to whom": "谁向谁汇报",
  "See who reports to whom": "查看汇报关系",
  "Hide progress messages": "隐藏进度消息",
  "Show progress messages": "显示进度消息",
  "Support / guide": "支持 / 指南",
  "Code / build": "代码 / 构建",
  "Research / strategy": "研究 / 策略",
  "Paused / stopped": "已暂停 / 已停止",
  "Review / audit": "审查 / 审计",
  "Move to Acme": "移动到 Acme",
  "Make … my home": "把…设为我的主页",
  "Ava is ready to be set up ×": "Ava 已准备好配置 ×",
  "Every weekday at 9 AM": "每个工作日 9:00",
  "SMS the team": "给团队发短信",
  "Sales form leads": "销售表单线索",
  "Today 9:02 AM": "今天 9:02",
  "Email triage": "邮件分诊",
  "Study buddy": "学习搭子",
  "Sales call coach": "销售通话教练",
  "Every weekday": "每个工作日",
  "Browser page": "浏览器页面",
  "Diagram source": "图表源码",
  "ListViewItem": "列表项",
  "Garage server": "车库服务器",
  "The request took too long. Check the connection and try again.": "请求超时，请检查网络后重试。",
  "Invalid key": "密钥无效",
  "Too many calls: this key takes 10 a minute": "调用过于频繁：该密钥每分钟限 10 次",
};

const fromLocales: Record<string, string> = {};
for (const [key, value] of Object.entries(en)) {
  const translated = (zh as Record<string, string>)[key];
  // A name that reads the same in both languages ("Cloud", "ChatGPT") is no translation: writing it back unchanged
  // would fire the observer again for the same text, and the page would never stop translating it (see rewrite()).
  if (typeof value === "string" && typeof translated === "string" && value.trim() && !value.includes("{")
    && translated !== value && !(value in manual)) {
    fromLocales[value] = translated;
  }
}

const dictionary: Record<string, string> = { ...fromLocales, ...manual };

const SKIP_TAGS = new Set(["CODE", "PRE", "TEXTAREA", "INPUT", "SCRIPT", "STYLE", "KBD", "SAMP"]);

/** The text with `trimmed` replaced, or null when that changes nothing: an unchanged write still fires the observer,
 * which would translate the same text again and spin forever. */
function rewrite(value: string, trimmed: string, replacement: string): string | null {
  if (replacement === trimmed) return null;
  const next = value.replace(trimmed, replacement);
  return next === value ? null : next;
}

/** The Chinese for an English string this page shows as is, or null when there is nothing to change. */
export function localize(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const direct = dictionary[trimmed];
  if (direct) return rewrite(value, trimmed, direct);
  const worked = trimmed.match(/^Worked for (\d+)s$/);
  if (worked) return rewrite(value, trimmed, "用时 " + worked[1] + " 秒");
  return null;
}

function skipped(el: Element | null): boolean {
  for (let node = el; node; node = node.parentElement) {
    if (SKIP_TAGS.has(node.tagName) || (node instanceof HTMLElement && node.isContentEditable)) return true;
  }
  return false;
}

function translateText(node: Text): void {
  if (skipped(node.parentElement)) return;
  const next = localize(node.nodeValue ?? "");
  if (next !== null) node.nodeValue = next;
}

function translateAttributes(el: Element): void {
  if (skipped(el)) return;
  for (const name of ["placeholder", "title", "aria-label"]) {
    const value = el.getAttribute(name);
    if (!value) continue;
    const next = localize(value);
    if (next !== null) el.setAttribute(name, next);
  }
}

// Re-entrancy guard: our own writes trigger the observer again.
let busy = false;

function translateTree(root: Node): void {
  if (!activeLocale().startsWith("zh")) return;
  if (busy) return;
  busy = true;
  try {
    if (root.nodeType === Node.TEXT_NODE) translateText(root as Text);
    else if (root.nodeType === Node.ELEMENT_NODE) {
      translateAttributes(root as Element);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      let current = walker.nextNode();
      while (current) {
        if (current.nodeType === Node.TEXT_NODE) translateText(current as Text);
        else translateAttributes(current as Element);
        current = walker.nextNode();
      }
    }
  } finally {
    busy = false;
  }
}

export function startHardcodedZh(): void {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
  translateTree(document.body);
  const observer = new MutationObserver((records) => {
    if (busy || !activeLocale().startsWith("zh")) return;
    for (const record of records) {
      if (record.type === "childList") record.addedNodes.forEach((node) => translateTree(node));
      else if (record.type === "characterData" && record.target.nodeType === Node.TEXT_NODE) translateText(record.target as Text);
      else if (record.type === "attributes" && record.target.nodeType === Node.ELEMENT_NODE) translateAttributes(record.target as Element);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "title", "aria-label"] });
}