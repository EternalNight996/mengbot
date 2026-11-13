import type { ReadyBot } from "./ready-bots";

type ReadyBotChinese = Pick<ReadyBot, "name" | "title" | "description" | "tryAsking">;

/** Chinese identities for the ready-made roster, shown and created while the app is in Chinese. */
export const READY_BOTS_ZH: Record<string, ReadyBotChinese> = {
  assistant: {
    name: "小助",
    title: "通用助手",
    description: "回答问题、起草文本，处理你交给它的各种任务。",
    tryAsking: ["根据这份待办清单规划我的一周", "用通俗中文解释这条合同条款", "起草一封礼貌拒绝这次会议的回复"],
  },
  inbox: {
    name: "小邮",
    title: "邮件分诊",
    description: "读取收件箱、标记待处理事项，并起草回复供你审批。",
    tryAsking: ["今天收件箱里有哪些需要我处理？", "为最紧急的三封邮件起草回复", "谁的消息我超过一周没回了？"],
  },
  research: {
    name: "小察",
    title: "研究助手",
    description: "检索网络与你的文件，返回带来源的研究简报。",
    tryAsking: ["今年欧盟 AI 规则有哪些变化？请给来源", "比较三款适合小团队的笔记应用", "核查这段话中的说法"],
  },
  coder: {
    name: "小码",
    title: "编程搭档",
    description: "在项目文件夹中工作：阅读、修改、运行测试并解释改动。",
    tryAsking: ["找出测试失败的原因并修复", "解释这个仓库的结构", "为注册表单添加输入校验"],
  },
  community: {
    name: "小哨",
    title: "社区监测",
    description: "按计划监测 Discord、Slack 或论坛，汇报重要动态。",
    tryAsking: ["昨天以来社区在问什么？", "列出本周未解决的 bug 报告", "哪个问题反复出现？"],
  },
  social: {
    name: "小讯",
    title: "社交媒体运营",
    description: "规划帖子并添加到 Postiz 草稿或定时发布，等待你审核。",
    tryAsking: ["规划下周 LinkedIn 和 X 的帖子", "起草三篇发布贴并加入 Postiz", "本周 Postiz 里安排了什么？"],
  },
  ops: {
    name: "小运",
    title: "运营事务",
    description: "推进日程、任务与跟进，在事情延误前提醒你。",
    tryAsking: ["今天有什么安排，哪些已逾期？", "本周找一个小时做深度工作", "哪些跟进我迟了？"],
  },
  writer: {
    name: "小笔",
    title: "写作助手",
    description: "用你的语气起草和编辑帖子、邮件与文档，从草稿到定稿。",
    tryAsking: ["把这些笔记改成一篇 LinkedIn 帖子", "把这封邮件精简到一半", "为这封简报写三个标题"],
  },
  analyst: {
    name: "小析",
    title: "数据分析",
    description: "用可核对的数字、表格和图表回答表格与 CSV 问题。",
    tryAsking: ["这份 CSV 中营收前十的客户是谁？", "展示月度趋势和异常", "找出这份导出中的重复行"],
  },
  "meeting-notes": {
    name: "小记",
    title: "会议纪要",
    description: "把转写和粗略笔记整理成决策、负责人与后续事项。",
    tryAsking: ["把这份转写总结成决策与行动项", "根据笔记起草跟进邮件", "我们还有什么没解决？"],
  },
  travel: {
    name: "小图",
    title: "旅行规划",
    description: "按预算与节奏逐日规划旅行，并把细节集中在一处。",
    tryAsking: ["规划五月里斯本四天轻松行程", "秋天去日本现在该订什么？", "为苏格兰雨季一周列打包清单"],
  },
  study: {
    name: "小智",
    title: "学习搭档",
    description: "逐步讲解主题、测验你，并记录仍需复习的内容。",
    tryAsking: ["像编程新手一样解释递归", "考我法国大革命", "为我的考试制定一周复习计划"],
  },
  humanizer: {
    name: "小回",
    title: "润色助手",
    description: "重写生硬或“AI 味”的草稿，使其读起来像你，并展示每处改动。",
    tryAsking: ["让这封邮件听起来不那么机械", "用我的语气重写这个落地页开头", "这是我写的三篇帖子，学习我的风格"],
  },
  "design-critic": {
    name: "小镜",
    title: "设计评审",
    description: "对截图或页面给出分级评审：层级、字体、颜色、文案与无障碍。",
    tryAsking: ["评审这个落地页截图", "怎样让这个仪表盘更易扫读？", "检查这个移动端页面的无障碍问题"],
  },
  "call-coach": {
    name: "小练",
    title: "销售通话教练",
    description: "根据通话转写为销售通话评分，并给出最有效的三条改进建议。",
    tryAsking: ["给这份需求挖掘通话转写打分", "我如何处理价格异议？", "下次我该换哪些问法？"],
  },
  "plant-care": {
    name: "小竹",
    title: "植物养护记录",
    description: "记录你室内植物的私人日志，在需要浇水或养护时提醒你。",
    tryAsking: ["记录我的龟背竹：客厅、明亮散射光", "今天我给蕨类和绿萝浇水了", "为什么我的虎皮兰叶子发黄？"],
  },
};
