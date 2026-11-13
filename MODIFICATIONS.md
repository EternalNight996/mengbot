# 修改说明（Modifications）

本项目 **MengBot** 由惠州市梦游科技有限公司维护，是 **OpenMausBot**
（<https://github.com/milind-soni/OpenMausBot>，Copyright 2026 Milind Soni and OpenMausBot
contributors，Apache License 2.0）的**衍生作品**。
本文件依 Apache-2.0 §4(b) 记录对外发布版本与上游之间的主要修改，随安装包一起分发
（`licenses/MODIFICATIONS.md`），并与根目录 [NOTICE](NOTICE) 配套阅读 —— 上游 NOTICE
的归属声明全文保留在 `NOTICE` 第四节。

## 品牌与界面

- 产品名、应用标识、安装包名、窗口标题统一为 **MengBot / 小梦**。
- 默认机器人（Chief of Staff）的头像改为「桃子」造型，眼睛为圆眼 + 高光 + 小微笑。
- 15 种语言的界面文案统一为 MengBot 表述；原文中的人名、邮箱等替换为项目团队。

## 功能与配置

- 默认站点与社区入口指向 `mengbot.com.cn` / `teams.mengbot.com.cn`。
- 团队库（社区模板）客户端兼容旧版 `openmaus.*` 目录与清单格式，并归一化为当前格式。
- 左下角推广卡改为项目官网入口（打开官方网站 / 邮件联系）。
- 更新检查指向本项目的发布仓库。

## 移除或停用的部分

- 移除上游的文档站、评测、企业连接器、伙伴 sidecar、部分云 Worker 与部署清单（如不再使用）。
  （其中 `enterprise/` 目录不在本仓库分发，本仓库不含该目录及其许可文件。）
- 数据目录使用 `~/.mengbot`，同时保留对旧版 `~/.openmaus` / `~/.openmausbot` 的读取兼容。

## 保留的上游标识

- `server/openmausbot-*.ts`、`src/components/OpenMausBot*.tsx` 等模块名称保持不变，
  便于与上游对照与合并。
- `OMB_*` 环境变量前缀沿用上游约定，避免破坏既有部署与数据目录识别。
- 上述保留不改变上游代码的著作权归属，归属见 [NOTICE](NOTICE) 第二、四节。

## 许可

- 主程序：Apache License 2.0，见 `LICENSE`。
- 上游归属与第三方归属：见 `NOTICE`（含 OpenMausBot NOTICE 全文）。
- 第三方组件：见 `licenses/`、`third_party/` 与 `LICENSING.md`。
