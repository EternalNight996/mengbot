// Mono-lingual letter tiles for the China edition's apps. Drawn here rather than
// fetched: the network round trip to a favicon service is exactly what used to
// leave blank squares, and a third-party logo is not ours to ship.
export interface AppTile {
  character: string;
  background: string;
}

export const APP_TILES: Record<string, AppTile> = {
  feishu: { character: "飞", background: "#3370ff" },
  wecom: { character: "企", background: "#0082ff" },
  dingtalk: { character: "钉", background: "#1e9bff" },
  wechat: { character: "微", background: "#07c160" },
  yuque: { character: "语", background: "#00b96b" },
  "tencent-docs": { character: "腾", background: "#0052d9" },
  kdocs: { character: "金", background: "#2ba471" },
  qqmail: { character: "邮", background: "#12b7f5" },
  "baidu-netdisk": { character: "盘", background: "#2932e1" },
};
