# 安全策略

## 支持的版本

| 版本 | 支持 |
|---|---|
| 1.0.x | 是 |
| 0.1.x | 否 |

## 报告漏洞

请优先使用 GitHub 私密漏洞报告：  
https://github.com/EternalNight996/mengbot/security/advisories/new

或邮件：eternalnightyeah2@yeah.net

请勿在公开 Issue 中贴出可复现的利用细节、密钥或个人数据。

## 范围

本仓库只包含桌面客户端与本地服务。云端 API、市场、管理后台为独立私有服务，不在本仓库范围。

重点欢迎：

- Electron 渲染进程逃逸、IPC 越权；
- 本地 API 的 CSRF/越权/路径穿越；
- 更新包与下载链路完整性；
- 凭据泄漏、日志脱敏绕过；
- 云同步/隧道把未授权数据暴露到网络。

## 已知限制

- Windows/macOS/Linux 安装包当前**未做商业代码签名**，Windows SmartScreen 会显示未知发布者；自动更新校验依赖 HTTPS + latest.yml 的 sha512，尚未做发布者签名校验。
- 产品统计默认偏好开启，但首次启动必须确认，确认前不发送；详见 PRIVACY.md。
- 本地 API 默认只监听 127.0.0.1，桌面模式下 loopback 视为本机所有者；同机恶意进程仍可能调用管理接口（本地威胁模型）。
- 共享服务器/Cloud Home 的 loopback 信任降为 service，但机器人 shell 仍可访问部分服务路由；修复计划是引入 relay token。
- 尚未进行第三方渗透测试或正式安全认证。

## 披露

确认后会在修复版本发布时致谢；默认 90 天披露窗口，主动利用中可缩短。
