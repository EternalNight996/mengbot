# MengBot 隐私说明

更新日期：2026-11-10。适用范围：MengBot 桌面客户端 1.x。

## 本地数据

- 配置、机器人、会话、附件、日志默认存放在本机数据目录。
- 敏感文件按 0600、目录按 0700 创建（POSIX）。
- API Key 存在本地配置中，不上传；卸载/删除数据目录即可清除。

## 匿名产品统计（自建 Umami）

首次启动会询问是否允许匿名统计，**默认偏好为开启，但未确认前不发送任何事件**。

- 服务：境内自建 Umami（analytics.mengbot.com.cn），数据在自己的 PostgreSQL。
- 首次启动：必须选择“允许匿名统计”后才开始发送；选择“暂不启用”或关闭开关后不发送。
- 事件：app_opened、app_first_open、app_active，以及功能计数事件（如创建机器人、连接器结果）。
- 属性只允许计数、布尔值和固定枚举；URL、referrer、路径、查询参数、会话内容在发送前被删除。
- 服务端不主动记录 IP；可在设置 → 隐私/分析（Analytics）随时关闭。
- 关闭方式：设置 → 隐私/分析（Analytics）关闭开关。

## 原始 IP

为排查滥用、故障和异常流量，自建统计服务会在 **session_ip** 表保存：

- 来源 IP、session/visit id、事件名、hostname、时间；
- 仅用于安全审计和问题排查，不用于广告画像；
- 仅超级管理员/运维可查；
- 保留 180 天，到期自动删除；
- 数据库只在内网，不对公网开放。

## 市场计数

打开模板页或导入模板时，客户端会向 api.mengbot.com.cn 发送一条计数事件：

- 内容：资源类型、资源 id、动作（view/like/install）、客户端版本、随机本机 actor。
- actor 是本地随机值，不与邮箱、账号、设备号关联。
- 不发送会话内容、文件、API Key。
- 服务端会看到请求 IP。可在防火墙/代理中阻断 api.mengbot.com.cn 的 /api/v1/market/events。

## 云端账号与订阅

使用云端登录/订阅时：

- 发送邮箱、设备名（默认取操作系统主机名）、平台、客户端版本；
- 支付由支付服务商处理，客户端不保存卡号；
- 订阅权益由云端 API 返回，客户端仅缓存 entitlement。

## 云文件同步

仅在用户主动共享文件夹后同步；默认排除 .ssh、.aws、.gnupg、.kube、.docker、.config、.local、.npm、Library、AppData、.mengbot、.claude、.codex、.gemini、.grok 等目录。

“我的云 / 输出”默认开启：Cloud 机器人产出的文件会下载到本机 Documents/MengBot；可在设置中关闭。

## 问题报告（@devs）

只有用户主动发送时才提交，包含用户填写的描述、机器人摘要、版本、平台、诊断信息、可选联系邮箱；发送前会对密钥、Cookie、Authorization、URL 参数做脱敏。不会上传完整会话或文件。

## 不做什么

- 不出售个人数据；
- 不做广告画像；
- 不读取未共享的本地文件夹；
- 不在用户关闭统计后继续加载统计 SDK。

## 联系

隐私问题：GitHub Issues（https://github.com/EternalNight996/mengbot/issues）或 eternalnightyeah2@yeah.net。
