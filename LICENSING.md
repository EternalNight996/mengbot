# 许可说明（Licensing）

本项目 **MengBot** 由 **惠州市梦游科技有限公司** 拥有并维护。仓库内不同部分适用不同许可，逐条如下。

## 1. 主程序（除下方特别说明的部分）

**Apache License 2.0** —— 完整条款见 [LICENSE](LICENSE)。
你可以自由使用、修改、分发（含商用），需保留版权与许可声明。

本项目大部分代码衍生自 OpenMausBot（Apache-2.0），归属划分见第 2 节。

## 2. 上游衍生代码（OpenMausBot）

本仓库**是 OpenMausBot 的衍生作品**：
[github.com/milind-soni/OpenMausBot](https://github.com/milind-soni/OpenMausBot)，
Apache License 2.0，Copyright 2026 Milind Soni and OpenMausBot contributors。

- 上游原始代码，以及基于其翻译、改写、重构产生的衍生部分：**著作权归原作者**，按
  Apache License 2.0 授权。
- 惠州市梦游科技有限公司对**自有新增与修改部分**享有著作权，同样按 Apache License 2.0
  授权。
- 依 Apache-2.0 **§4(d)**，上游 `NOTICE` 中的全部归属声明已**原样保留**在根目录
  [NOTICE](NOTICE) 第四节；以源码或安装包形式分发本项目时，必须一并保留该文件，
  不得删除或替换其中内容。
- 依 Apache-2.0 **§4(b)**，本公司对上游文件的修改记录见
  [MODIFICATIONS.md](MODIFICATIONS.md)；与本仓库跟踪文件同路径继承自上游的清单见
  [UPSTREAM-INHERITED-FILES.txt](UPSTREAM-INHERITED-FILES.txt)，逐文件声明可用
  `scripts/licensing/stamp-derived-headers.mjs` 补齐。

本仓库（公开仓）**不包含**企业版目录 `enterprise/`，因此不涉及该目录的单独许可。

## 3. `third_party/` 与随包分发的第三方组件

保留各自许可与归属声明，见各子目录内的 `LICENSE*`、`THIRD_PARTY_*`、`SBOM.cdx.json`。
构建安装包时这些文件会被复制进 `licenses/` 目录随包分发。

主要第三方组件：

| 组件 | 许可 | 位置 |
|---|---|---|
| Cua Driver | MIT（部分 MPL-2.0） | `third_party/cua-driver/`、`@trycua/cua-driver` |
| agent-browser / Chrome for Testing | MIT / 各自条款 | `third_party/browser/` |
| Playwright 注入脚本 | Apache-2.0 | `third_party/playwright-injected/` |
| models.dev 目录数据 | MIT | `third_party/models-dev/` |
| opencode 目录逻辑 | MIT | `third_party/opencode/` |
| T3 Code（浏览器控制部分改写） | MIT | `third_party/t3-code/` |
| Cache Tax（保活设计） | MIT | `third_party/cache-tax/` |
| Provider 图标（Lobe Icons / Simple Icons） | MIT / CC0 | `third_party/provider-icons/` |
| cloudflared | Apache-2.0 | `third_party/cloudflared/` |
| Puppeteer / hpke-js / 1Password SDK 等 | 见各自 LICENSE | `third_party/*` |

## 4. 商标

"MengBot"、"梦游" 及本项目图标为惠州市梦游科技有限公司的商标/标识。
Apache-2.0 **不授予**商标使用权；分发衍生版本时请更换名称与图标，避免让用户误认官方来源。

## 5. 贡献

- 代码贡献默认按 Apache-2.0 授权（见 [CONTRIBUTING.md](CONTRIBUTING.md)）。
- 提交较大改动前建议签署 [CLA.md](CLA.md)。

## 6. 版权

- 上游衍生部分：Copyright 2026 Milind Soni and OpenMausBot contributors（Apache-2.0）。
- 本项目自有新增与修改部分：Copyright 2026 惠州市梦游科技有限公司（Apache-2.0）。

具体归属划分与上游 NOTICE 全文见 [NOTICE](NOTICE)。
