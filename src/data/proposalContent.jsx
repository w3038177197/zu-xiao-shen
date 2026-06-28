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

export const proposalNextIdeas = [
  '合同拍照识别：手机拍合同，自动提取条款并进入审查。',
  '城市政策更新：补贴入口和申请条件定期维护，减少过期信息。',
  '押金争议导出：把验房、票据、聊天记录整理成 PDF 或 Word。',
  '租金行情参考：用周边租金帮助用户判断续租涨价是否合理。',
]
