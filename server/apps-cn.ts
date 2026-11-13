// The China edition's own app catalog. It is filled in locally: no marketplace
// request, no third-party favicon, nothing that needs an overseas connection.
//
// Categories reuse the English names the rest of the catalog uses, so the panel
// localizes them with the copy it already has.

export interface CnAppCard {
  slug: string;
  label: string;
  blurb: string;
  logo: null;
  domain: null;
  categories: string[];
  region: "cn";
}

export const CN_APPS: readonly CnAppCard[] = [
  { slug: "feishu", label: "飞书", blurb: "消息、日历、云文档与审批", logo: null, domain: null, categories: ["communication", "productivity"], region: "cn" },
  { slug: "wecom", label: "企业微信", blurb: "企业通讯录、群消息与客户联系", logo: null, domain: null, categories: ["communication"], region: "cn" },
  { slug: "dingtalk", label: "钉钉", blurb: "消息、日程、审批与考勤", logo: null, domain: null, categories: ["communication", "productivity"], region: "cn" },
  { slug: "wechat", label: "微信", blurb: "公众号与客服消息", logo: null, domain: null, categories: ["communication", "social"], region: "cn" },
  { slug: "yuque", label: "语雀", blurb: "知识库、文档与团队空间", logo: null, domain: null, categories: ["productivity"], region: "cn" },
  { slug: "tencent-docs", label: "腾讯文档", blurb: "在线文档、表格与收集表", logo: null, domain: null, categories: ["productivity", "files"], region: "cn" },
  { slug: "kdocs", label: "金山文档", blurb: "在线文档、表格与协作", logo: null, domain: null, categories: ["productivity", "files"], region: "cn" },
  { slug: "qqmail", label: "QQ 邮箱", blurb: "收发邮件与日程邀请", logo: null, domain: null, categories: ["communication"], region: "cn" },
  { slug: "baidu-netdisk", label: "百度网盘", blurb: "文件浏览、上传与分享", logo: null, domain: null, categories: ["files"], region: "cn" },
];

/** "cn" keeps the desktop catalog local; anything else keeps today's Composio catalog. */
export function appsRegion(environment: NodeJS.ProcessEnv = process.env): "cn" | "global" {
  return environment.OMB_APPS_REGION?.trim().toLowerCase() === "cn" ? "cn" : "global";
}
