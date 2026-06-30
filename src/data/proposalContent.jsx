import {
  BadgeCheck,
  CircleDollarSign,
  ClipboardCheck,
  Download,
  FileText,
  Search,
} from 'lucide-react'

export const proposalValueCards = [
  {
    icon: CircleDollarSign,
    title: '补贴匹配',
    label: '01',
    tab: 'subsidy',
    text: '按城市和个人情况筛官方补贴线索，先判断有没有资格。',
  },
  {
    icon: FileText,
    title: '租房审查',
    label: '02',
    tab: 'review',
    text: '标出押金、涨租、维修、违约金等关键风险。',
  },
  {
    icon: BadgeCheck,
    title: '入住验房',
    label: '03',
    tab: 'checkin',
    text: '记录房屋初始状态，避免旧问题变成租客责任。',
  },
  {
    icon: ClipboardCheck,
    title: '退租证据包',
    label: '04',
    tab: 'evidence',
    text: '整理证据包和话术，让押金争议有材料可讲。',
  },
]

export const riskGuideSteps = [
  {
    icon: Search,
    step: '01',
    title: '选择入口',
    text: '从首页先判断问题类型：补贴、合同、交房、退租分别进入对应模块。',
    output: '定位当前要处理的租房风险',
  },
  {
    icon: FileText,
    step: '02',
    title: '填写材料',
    text: '补充城市和个人情况，粘贴合同，记录房屋状态，整理退租费用与证据。',
    output: '形成可计算、可审查的基础材料',
  },
  {
    icon: BadgeCheck,
    step: '03',
    title: '查看结果',
    text: '系统会给出政策线索、风险条款、验房缺口和押金争议提醒。',
    output: '知道哪些内容需要补、改、留证',
  },
  {
    icon: Download,
    step: '04',
    title: '导出沟通',
    text: '把结论、证据清单和沟通话术整理出来，用于签约前确认或退租协商。',
    output: '拿到可以直接使用的行动材料',
  },
]

export const proposalDemoRoute = [
  {
    step: '01',
    title: '查看避坑流程',
    text: '先理解补贴、合同审查、入住验房、退租证据之间的完整关系。',
    action: '打开流程',
    actionType: 'guide',
  },
  {
    step: '02',
    title: '补贴匹配',
    text: '选择城市和个人身份，确认有没有可申请的官方补贴线索。',
    action: '进入补贴',
    actionType: 'module',
    tab: 'subsidy',
  },
  {
    step: '03',
    title: '载入高风险合同',
    text: '进入租房审查，使用演示合同快速触发押金、涨租、维修等风险。',
    action: '进入审查',
    actionType: 'module',
    tab: 'review',
  },
  {
    step: '04',
    title: '查看风险证据',
    text: '逐条查看风险等级、命中原文、风险原因和谈判建议。',
    action: '看审查页',
    actionType: 'module',
    tab: 'review',
  },
  {
    step: '05',
    title: '采纳修改建议',
    text: '把风险建议写入修订草案，展示从识别到可执行修改的闭环。',
    action: '继续审查',
    actionType: 'module',
    tab: 'review',
  },
  {
    step: '06',
    title: '下载 DOCX',
    text: '导出审查报告或修订草案，证明结果不是只停留在页面展示。',
    action: '进入导出',
    actionType: 'module',
    tab: 'review',
  },
  {
    step: '07',
    title: '入住验房',
    text: '记录房屋初始状态，为之后退租押金争议提前留证。',
    action: '进入验房',
    actionType: 'module',
    tab: 'checkin',
  },
  {
    step: '08',
    title: '生成验房报告',
    text: '按房间和检查项生成可发送给房东确认的验房记录。',
    action: '看验房页',
    actionType: 'module',
    tab: 'checkin',
  },
  {
    step: '09',
    title: '退租证据包',
    text: '整理合同、照片、聊天记录和费用凭证，形成押金协商材料。',
    action: '进入证据包',
    actionType: 'module',
    tab: 'evidence',
  },
  {
    step: '10',
    title: '生成沟通话术',
    text: '把证据和费用争议整理成可复制、可导出的沟通文本。',
    action: '看话术',
    actionType: 'module',
    tab: 'evidence',
  },
  {
    step: '11',
    title: 'AI 助手追问',
    text: '追问“押金条款怎么和房东谈”，展示 AI 与本地知识库结合。',
    action: '进入 AI',
    actionType: 'ai',
  },
  {
    step: '12',
    title: '展示兜底能力',
    text: '说明模型不可用时仍会切换本地规则，核心演示不断线。',
    action: '看 AI 状态',
    actionType: 'ai',
  },
]

export const proposalQuickRoute = [
  {
    title: '租房审查',
    text: '一键载入演示合同并进入审查结果。',
    actionType: 'demoReview',
  },
  {
    title: '采纳建议',
    text: '生成修订草案并导出 DOCX。',
    actionType: 'module',
    tab: 'review',
  },
  {
    title: '入住验房',
    text: '生成一份可确认的验房记录。',
    actionType: 'module',
    tab: 'checkin',
  },
  {
    title: '退租证据',
    text: '生成证据包和沟通话术。',
    actionType: 'module',
    tab: 'evidence',
  },
  {
    title: 'AI 追问',
    text: '进入 AI 助手追问条款谈判和押金协商。',
    actionType: 'ai',
  },
]

export const proposalNextIdeas = [
  '合同拍照识别：手机拍合同，自动提取条款并进入审查。',
  '城市政策更新：补贴入口和申请条件定期维护，减少过期信息。',
  '押金争议导出：把验房、票据、聊天记录整理成 PDF 或 Word。',
  '租金行情参考：用周边租金帮助用户判断续租涨价是否合理。',
]
