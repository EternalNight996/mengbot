# 修改说明（Modifications）

本文件记录 **MengBot** 对外发布版本的功能、配置与品牌改动，随安装包一起分发
（`licenses/MODIFICATIONS.md`）。

## 品牌与界面

- 产品名、应用标识、安装包名、窗口标题统一为 **MengBot / 小梦**。
- 默认机器人（Chief of Staff）的头像改为「桃子」造型，眼睛为圆眼 + 高光 + 小微笑。
- 15 种语言的界面文案统一为 MengBot 表述；原文中的人名、邮箱等替换为项目团队。

## 功能与配置

- 默认站点与社区入口指向 `mengbot.com.cn` / `teams.mengbot.com.cn`。
- 团队库（社区模板）使用统一的 `mengbot.*` 目录与清单格式。
- 左下角推广卡改为项目官网入口（打开官方网站 / 邮件联系）。
- 更新检查指向本项目的发布仓库。

## 移除或停用的部分

- 数据目录使用 `~/.mengbot`。
- 不使用企业版目录 `enterprise/`；本仓库不含该目录及其许可文件。

## 许可

- 主程序：Apache License 2.0，见 `LICENSE`。
- 第三方归属：见 `NOTICE`、`licenses/`、`third_party/` 与 `LICENSING.md`。
