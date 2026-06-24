import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Bot,
  BookOpenCheck,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  Download,
  EyeOff,
  FileDiff,
  FileText,
  Fingerprint,
  Gavel,
  KeyRound,
  LockKeyhole,
  MessageSquareText,
  PlugZap,
  RefreshCw,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react'
import './App.css'

const sampleContract = `房屋租赁合同

出租方（甲方）：恒业房产管理有限公司
承租方（乙方）：张小明

一、房屋基本信息
甲方同意将坐落于阳光花园3栋2单元601室的房屋出租给乙方使用，建筑面积88平方米。房屋内配有床、衣柜、沙发、冰箱、洗衣机、热水器、空调各一台，燃气灶一台。

二、租期与租金
租期为1年，自2026年7月1日至2027年6月30日。月租金为3,800元，押一付三，每季度首月5日前支付。

三、押金
乙方签订本合同时向甲方支付押金3,800元。合同终止且乙方已结清费用、交还钥匙后，甲方在45个工作日内退还押金。退还时甲方可扣除以下费用：房屋维修费、全屋保洁费（不低于400元）、墙面修补粉刷费、家具家电折旧补偿、以及甲方认定的其他合理扣款。

四、续租与涨租
合同到期前30日，如双方均未提出异议，本合同自动续期12个月，续期租金在当期基础上上调8%。

五、维修责任
租赁期内房屋及附属设施出现任何问题的，由乙方自行维修并承担费用。因水管老化、墙体开裂等自然原因造成的损坏，同样由乙方负责。

六、提前解除
乙方提前退租须提前60日书面通知甲方，并支付违约金（相当于2个月租金）。甲方因出售房屋等自身原因需提前解除合同的，提前15日通知乙方即可，双方按实际居住天数结算租金。

七、房屋检查
甲方及中介人员有权在合理时间进入房屋进行检查、维修或带人看房，无需另行征得乙方同意。

八、租期内调价
租赁期间如周边同户型租金均价上涨超过20%，甲方有权要求乙方按上涨比例相应调整租金。乙方如不接受调整，须在15日内搬离，押金不予返还。

九、逾期责任
乙方逾期支付租金，每逾期一日加收月租金5%作为滞纳金。逾期超过7日的，甲方有权换锁收回房屋，已收租金及押金不予退还。

十、退租恢复
退租交房时，乙方须将全屋恢复至出租前的整洁状态，包括全屋墙面重新粉刷（白色乳胶漆）、全部区域深度保洁。如甲方认为恢复不到位，由甲方安排第三方处理，费用按市场价从押金中扣除。

十一、违约责任
乙方拖欠租金超过3天的，甲方有权立即解除合同、收回房屋，押金及剩余租金不予退还，并有权要求乙方另行赔偿相当于6个月租金的违约金。

十二、免责
因政府征收、拆迁、甲方债务纠纷、邻居投诉、物业公司干涉等非甲方主观意愿所能控制的原因，造成合同无法继续履行的，甲方不承担违约责任。

十三、因甲方原因解除
因甲方原因导致乙方无法继续居住的，甲方仅退还剩余租金，不承担搬家费、误工费等其他任何损失。因房屋权属问题导致乙方无法继续居住的，甲方退还剩余租金，双方互不追究。

十四、杂费
甲方每季度抄表后通知乙方缴费，乙方不得要求提供原始缴费凭证。

十五、管辖
双方发生争议协商不成的，应向甲方户籍所在地人民法院起诉。

十六、格式条款
乙方签字即视为已充分阅读并完全同意本合同全部内容，此后不得以"未注意"或"不理解"为由对任何条款提出异议。本合同解释权归甲方。

十七、宠物限制
乙方不得饲养宠物，如有违反甲方有权立即解除合同并没收押金。

十八、转租限制
乙方不得以任何形式转租、转借或与他人合住，否则视为严重违约。

十九、装修限制
乙方不得对房屋进行任何形式的装修改造，包括但不限于墙面打孔、贴墙纸、更换家具位置。

二十、续租通知
乙方如需续租，须在合同到期前60日书面提出申请，逾期视为放弃续租。`

const STORAGE_KEYS = {
  history: 'rental-safe-history',
  historyLegacy: 'contract-guardian-history',
  aiConfig: 'rental-safe-ai-config',
  aiConfigLegacy: 'contract-guardian-ai-config',
  evidencePack: 'rental-safe-evidence-pack',
}

// Legacy service-contract rules are retained only as a fallback when users manually
// switch the contract type away from the rental review workflow.
const riskRules = [
  {
    id: 'payment-delay',
    title: '付款周期过长且免责',
    level: 'high',
    score: 24,
    icon: CircleDollarSign,
    levelText: '高风险',
    keywords: ['90 个工作日', '延期付款', '不承担违约责任', '客户回款'],
    explain: '付款触发条件过晚，且甲方把内部流程、客户回款等原因排除在违约责任之外，乙方现金流风险较高。',
    suggestion: '建议改为阶段付款，并写明逾期付款的违约责任。',
    replaceFrom:
      '乙方完成全部工作并经甲方最终验收后 90 个工作日内，甲方向乙方支付全部费用。甲方如因内部流程、客户回款或预算调整导致延期付款，不承担违约责任。',
    replacement:
      '甲方应按项目阶段支付费用：合同签署后 5 个工作日内支付 40%，乙方提交最终成果并经确认后 10 个工作日内支付剩余 60%。甲方逾期付款的，应按应付款金额每日万分之五承担违约责任。',
  },
  {
    id: 'unilateral-termination',
    title: '单方解除权不对等',
    level: 'high',
    score: 22,
    icon: Gavel,
    levelText: '高风险',
    keywords: ['单方解除合同', '无需承担任何赔偿责任', '不得单方解除'],
    explain: '一方可以无成本解除合同，另一方没有相同权利，容易造成投入无法回收。',
    suggestion: '建议加入对等解除机制和已完成工作结算规则。',
    replaceFrom:
      '甲方可根据自身业务需要单方解除合同，且无需承担任何赔偿责任。乙方不得单方解除合同。',
    replacement:
      '任一方需提前 10 个工作日书面通知对方后方可解除合同。合同解除时，甲方应按照乙方已完成并交付的工作量结算费用；因一方违约导致解除的，违约方应赔偿守约方因此产生的合理损失。',
  },
  {
    id: 'ip-overreach',
    title: '知识产权归属过宽',
    level: 'high',
    score: 18,
    icon: Fingerprint,
    levelText: '高风险',
    keywords: ['全部成果', '草稿', '源文件', '知识产权均归甲方所有', '不得以任何方式展示'],
    explain: '条款覆盖草稿、源文件和创意方案，且限制乙方案例展示，超出常见交付范围。',
    suggestion: '建议限定为已付款且最终确认的交付成果。',
    replaceFrom:
      '乙方在本项目中形成的全部成果、草稿、源文件、创意方案及相关知识产权均归甲方所有。乙方不得以任何方式展示、复用或作为案例公开。',
    replacement:
      '甲方在足额支付对应费用后，取得双方最终确认交付成果的使用权。乙方保留未被采用方案、通用方法、底层工具和既有素材的权利。乙方可在不披露甲方商业秘密的前提下，将项目作为案例展示。',
  },
  {
    id: 'confidentiality-penalty',
    title: '保密违约金明显偏高',
    level: 'medium',
    score: 12,
    icon: LockKeyhole,
    levelText: '中风险',
    keywords: ['永久保密义务', '五倍的违约金', '全部损失'],
    explain: '永久保密和五倍违约金会显著加重乙方责任，且“全部损失”边界不清。',
    suggestion: '建议写清保密范围、期限和责任上限。',
    replaceFrom:
      '乙方对合作过程中获知的全部信息承担永久保密义务。乙方如违反保密义务，应向甲方支付合同金额五倍的违约金，并赔偿甲方全部损失。',
    replacement:
      '乙方仅对甲方明确标识或合理应认定为保密的信息承担保密义务，保密期限为合同终止后 3 年。乙方违反保密义务造成甲方实际损失的，应在合同金额范围内承担赔偿责任。',
  },
  {
    id: 'acceptance-unclear',
    title: '验收标准不明确',
    level: 'medium',
    score: 10,
    icon: ClipboardCheck,
    levelText: '中风险',
    keywords: ['未书面确认前', '视为项目未通过验收', '3 日内完成修改'],
    explain: '验收完全依赖一方书面确认，没有客观标准和默认通过机制，可能导致无限修改。',
    suggestion: '建议写明验收标准、反馈次数和默认通过机制。',
    replaceFrom:
      '乙方应在甲方通知后 3 日内完成修改。甲方未书面确认前，视为项目未通过验收。',
    replacement:
      '甲方应在收到交付成果后 5 个工作日内提出书面验收意见。甲方逾期未反馈的，视为验收通过。每阶段修改以 2 轮为限，超出范围的新增需求由双方另行确认费用和周期。',
  },
  {
    id: 'jurisdiction',
    title: '管辖地点可能不利',
    level: 'low',
    score: 6,
    icon: Scale,
    levelText: '低风险',
    keywords: ['甲方所在地人民法院'],
    explain: '争议解决地点偏向甲方，可能增加另一方维权成本。',
    suggestion: '可协商改为双方都可接受的地点或机构。',
    replaceFrom: '双方发生争议的，应提交甲方所在地人民法院诉讼解决。',
    replacement: '双方发生争议的，应优先友好协商；协商不成的，可提交合同履行地有管辖权的人民法院诉讼解决。',
  },
]

const riskDetails = {
  'payment-delay': {
    dimension: '付款',
    priority: 'P0',
    evidence: '付款周期长达 90 个工作日，且内部流程、客户回款、预算调整均被排除在违约责任之外。',
    legalBasis: '参考《民法典》合同编关于履行期限、违约责任与公平原则的规定。',
    negotiation: '可以先提出阶段付款方案，再让对方选择节点比例，而不是直接争论是否付款。',
  },
  'unilateral-termination': {
    dimension: '解除',
    priority: 'P0',
    evidence: '甲方可单方解除且无需赔偿，乙方没有对等解除权。',
    legalBasis: '参考《民法典》关于合同解除、违约损害赔偿与权利义务对等的基本规则。',
    negotiation: '建议把重点放在“已完成工作应结算”，比单纯要求删除解除权更容易被接受。',
  },
  'ip-overreach': {
    dimension: '知识产权',
    priority: 'P1',
    evidence: '草稿、源文件、创意方案和全部知识产权均归甲方，且限制乙方案例展示。',
    legalBasis: '参考著作权归属、委托创作成果交付范围和商业秘密保护边界。',
    negotiation: '可以区分最终交付成果、未采用方案、通用方法和既有素材，降低对方顾虑。',
  },
  'confidentiality-penalty': {
    dimension: '保密',
    priority: 'P1',
    evidence: '永久保密、五倍违约金和全部损失并列，责任上限不清。',
    legalBasis: '参考违约金调整、实际损失证明和保密义务合理期限的裁判思路。',
    negotiation: '不要否认保密义务，改为要求限定范围、期限和赔偿上限。',
  },
  'acceptance-unclear': {
    dimension: '验收',
    priority: 'P1',
    evidence: '未书面确认前视为项目未通过验收，缺少默认通过和修改轮次限制。',
    legalBasis: '参考合同履行中的验收标准、通知义务和诚实信用原则。',
    negotiation: '建议要求写明反馈窗口和修改轮次，避免项目进入无限返工。',
  },
  jurisdiction: {
    dimension: '管辖',
    priority: 'P2',
    evidence: '争议提交甲方所在地法院，可能增加另一方维权成本。',
    legalBasis: '参考民事诉讼管辖规则和合同履行地约定。',
    negotiation: '可提出合同履行地或双方均可接受的中立地点作为折中方案。',
  },
}

const scoreDimensions = ['租期', '租金', '押金', '解除', '维修', '居住权', '费用', '违约责任', '管辖', '格式条款', '权属']

function buildChatCompletionsUrl(baseUrl) {
  const trimmed = baseUrl.trim().replace(/\/$/, '')
  if (!trimmed) return ''
  if (trimmed.endsWith('/chat/completions')) return trimmed
  return `${trimmed}/chat/completions`
}

function parseAiContent(content) {
  if (!content) return null

  try {
    return JSON.parse(content)
  } catch {
    const jsonBlock = content.match(/\{[\s\S]*\}/)
    if (!jsonBlock) return { summary: content }

    try {
      return JSON.parse(jsonBlock[0])
    } catch {
      return { summary: content }
    }
  }
}

function extractAssistantContent(data) {
  const content = data?.choices?.[0]?.message?.content
  if (Array.isArray(content)) {
    return content.map((item) => item.text || item.content || '').join('')
  }

  return content || data?.output_text || ''
}

function normalizeAiFindings(data, sourceText) {
  const risks = Array.isArray(data?.risks) ? data.risks : []

  return risks.slice(0, 16).map((risk, index) => {
    const level = ['high', 'medium', 'low'].includes(risk.level) ? risk.level : 'medium'
    const dimension = risk.dimension || '综合'
    const title = risk.title || `${dimension}风险 ${index + 1}`
    const keywords = Array.isArray(risk.keywords) ? risk.keywords.filter(Boolean) : []
    const hits = keywords.filter((keyword) => sourceText.includes(keyword))
    const evidence = typeof risk.evidence === 'string' ? risk.evidence.trim() : ''
    const replaceFrom = typeof risk.replaceFrom === 'string' ? risk.replaceFrom.trim() : ''
    const verifiedEvidence = evidence && sourceText.includes(evidence)
    const verifiedReplaceFrom = replaceFrom && sourceText.includes(replaceFrom)

    return {
      id: risk.id || `ai-risk-${index + 1}`,
      title,
      level,
      score: Number(risk.score) || (level === 'high' ? 20 : level === 'medium' ? 12 : 6),
      icon: AlertTriangle,
      levelText: risk.levelText || (level === 'high' ? '高风险' : level === 'medium' ? '中风险' : '低风险'),
      keywords,
      hits,
      explain: risk.explain || risk.reason || 'AI 已识别该条款存在潜在风险，建议结合业务背景复核。',
      suggestion: risk.suggestion || '建议补充更明确、对等、可执行的合同表述。',
      replaceFrom: verifiedReplaceFrom ? replaceFrom : verifiedEvidence ? evidence : hits[0] || '',
      replacement: risk.replacement || risk.rewrite || risk.suggestion || '建议由法务结合交易背景补充替代条款。',
      dimension,
      priority: risk.priority || (level === 'high' ? 'P0' : level === 'medium' ? 'P1' : 'P2'),
      evidence: verifiedEvidence ? evidence : verifiedReplaceFrom ? replaceFrom : hits.join('、'),
      legalBasis: risk.legalBasis || '建议结合《民法典》合同编及相关司法裁判规则复核。',
      negotiation: risk.negotiation || '建议先提出可执行替代方案，再与对方协商风险分担。',
    }
  }).filter((risk) => risk.evidence && (risk.hits.length > 0 || sourceText.includes(risk.evidence)))
}

function buildAiQualityReport(data, sourceText, acceptedFindings) {
  const risks = Array.isArray(data?.risks) ? data.risks : []
  const contractType = String(data?.contractType || data?.type || '')
  const verifiedRawCount = risks.filter((risk) => {
    const evidence = typeof risk.evidence === 'string' ? risk.evidence.trim() : ''
    const replaceFrom = typeof risk.replaceFrom === 'string' ? risk.replaceFrom.trim() : ''
    const keywords = Array.isArray(risk.keywords) ? risk.keywords : []

    return (
      (evidence && sourceText.includes(evidence)) ||
      (replaceFrom && sourceText.includes(replaceFrom)) ||
      keywords.some((keyword) => sourceText.includes(keyword))
    )
  }).length
  const rejectedCount = Math.max(0, risks.length - acceptedFindings.length)
  const typeMismatch = /服务|外包|知识产权|项目/.test(contractType) && detectContractType(sourceText) === 'lease'
  const tone = typeMismatch || rejectedCount > 0 ? 'warning' : 'safe'

  return {
    rawCount: risks.length,
    verifiedRawCount,
    acceptedCount: acceptedFindings.length,
    rejectedCount,
    typeMismatch,
    tone,
    contractType,
  }
}

function createAiReviewPrompt(contractText, profile) {
  return `请审查下面这份中文合同。只返回 JSON，不要 Markdown，不要解释 JSON 以外的内容。

${createKnowledgePrompt(profile)}

JSON 格式必须为：
{
  "contractType": "房屋租赁合同",
  "summary": "一句话总结",
  "risks": [
    {
      "id": "risk-1",
      "title": "风险标题",
      "level": "high 或 medium 或 low",
      "levelText": "高风险 或 中风险 或 低风险",
      "dimension": "租期/租金/押金/解除/维修/居住权/违约责任/费用/管辖/格式条款/权属/综合",
      "priority": "P0/P1/P2",
      "score": 20,
      "keywords": ["用于高亮的原文关键词"],
      "explain": "风险解释",
      "suggestion": "修改建议",
      "evidence": "合同中的证据片段",
      "legalBasis": "法律或审查依据",
      "negotiation": "谈判话术",
      "replaceFrom": "可被替换的原文片段",
      "replacement": "建议替代条款"
    }
  ]
}

硬性要求：
1. evidence 必须逐字摘自合同原文，不能概括，不能编造。
2. keywords 必须全部来自合同原文，用于高亮。
3. replaceFrom 如果填写，必须逐字等于合同原文中的一段。
4. 不要输出与合同类型无关的模板风险。

合同正文：
${contractText}`
}

const featureCards = [
  {
    icon: Search,
    title: '押金陷阱识别',
    text: '自动识别押金扣款陷阱、退还周期过长、固定保洁费、折旧补偿等常见扣款套路。',
  },
  {
    icon: MessageSquareText,
    title: '大白话解读',
    text: '把租房合同里的法律话翻译成普通人能听懂的后果，适合毕业生和老人快速判断。',
  },
  {
    icon: Sparkles,
    title: '谈判话术',
    text: '告诉你哪些条款可以谈、怎么谈、底线在哪，租房谈判不再只靠感觉。',
  },
  {
    icon: FileDiff,
    title: '避坑指南',
    text: '每个风险点都有证据片段、替代条款和维权建议，看完知道下一步怎么做。',
  },
]

const modelProviders = [
  'OpenAI-compatible',
  'OpenAI Responses API',
  '通义千问',
  '智谱 GLM',
  'Moonshot',
  '自定义网关',
]

const productBacklog = [
  '支持拍照识别租房合同，手机拍一下就能分析',
  '押金计算器：输入退租情况，AI 估算应退押金',
  '附近租房行情参考价：本小区与周边租金对比',
  '房东信用档案：租客匿名评价与纠纷记录',
  '一键生成保护租客权益的合规模板合同',
  '维权指南和投诉通道：住建、12345、法院入口',
  '涨租预警系统：合同到期前提醒提前沟通',
]

const evidenceGroupMeta = {
  contract: {
    title: '合同文件',
    Icon: FileText,
    items: ['租赁合同原件或电子版', '押金收据或转账记录', '租金支付记录或银行流水'],
  },
  photos: {
    title: '房屋照片',
    Icon: UploadCloud,
    items: ['入住时房屋整体状况照片', '入住时家电家具状况照片', '退租时房屋整体状况照片', '退租时家电家具状况照片'],
  },
  chat: {
    title: '沟通记录',
    Icon: MessageSquareText,
    items: ['与房东或中介的聊天记录截图', '退租通知发送记录', '维修、押金、交接事项沟通记录'],
  },
  expense: {
    title: '费用凭证',
    Icon: CircleDollarSign,
    items: ['水电燃气缴费凭证', '物业费或宽带费缴纳凭证', '维修、保洁或其他费用凭证'],
  },
}

const evidenceActions = [
  { title: '整理合同和押金凭证', desc: '把租赁合同、押金收据、租金支付记录统一保存。' },
  { title: '拍摄退租现状照片', desc: '覆盖客厅、卧室、厨房、卫生间、门锁、墙面和家电家具。' },
  { title: '导出沟通记录', desc: '重点保留退租通知、维修争议、押金扣款和交接时间确认。' },
  { title: '结清并留存费用凭证', desc: '水电燃气、物业、宽带等费用尽量取得账单或转账记录。' },
  { title: '预约现场交接', desc: '提前确认交接时间、在场人员、钥匙门禁卡数量和押金退还方式。' },
  { title: '发送押金退还说明', desc: '用书面方式发送，要求对方明确扣款依据和退还时间。' },
]

const evidenceToolTabs = [
  { value: 'deposit', label: '押金退还' },
  { value: 'repair', label: '维修争议' },
  { value: 'handover', label: '退租交接' },
]

const defaultEvidenceFormData = {
  address: '阳光花园3栋2单元601室',
  deposit: '3800',
  monthlyRent: '3800',
  landlordName: '',
  landlordPhone: '',
  checkinDate: '',
  checkoutDate: '',
  handoverDate: '',
  handoverTime: '',
  repairItem: '',
  repairCost: '',
  notes: '',
}

function createEmptyEvidenceState() {
  return Object.fromEntries(Object.entries(evidenceGroupMeta).map(([group, meta]) => [group, meta.items.map(() => false)]))
}

function createDefaultEvidencePackState() {
  return {
    formData: defaultEvidenceFormData,
    evidence: createEmptyEvidenceState(),
    actions: evidenceActions.map(() => false),
    communicationText: '',
  }
}

function normalizeEvidencePackState(savedState) {
  const defaults = createDefaultEvidencePackState()
  const savedEvidence = savedState?.evidence || {}

  return {
    formData: { ...defaults.formData, ...(savedState?.formData || {}) },
    evidence: Object.fromEntries(
      Object.entries(evidenceGroupMeta).map(([group, meta]) => {
        const savedGroup = Array.isArray(savedEvidence[group]) ? savedEvidence[group] : []
        return [group, meta.items.map((_, index) => Boolean(savedGroup[index]))]
      }),
    ),
    actions: evidenceActions.map((_, index) => Boolean(savedState?.actions?.[index])),
    communicationText: typeof savedState?.communicationText === 'string' ? savedState.communicationText : '',
  }
}

function loadEvidencePackState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.evidencePack)
    return saved ? normalizeEvidencePackState(JSON.parse(saved)) : createDefaultEvidencePackState()
  } catch {
    return createDefaultEvidencePackState()
  }
}

const contractTypeOptions = [
  { value: 'auto', label: '自动识别' },
  { value: 'service', label: '服务 / 外包合同' },
  { value: 'purchase', label: '采购 / 供货合同' },
  { value: 'lease', label: '房屋租赁合同' },
  { value: 'employment', label: '劳动 / 劳务合同' },
  { value: 'cooperation', label: '合作协议' },
]

const partyRoleOptions = [
  { value: 'neutral', label: '中立评估' },
  { value: 'partyA', label: '我方是甲方' },
  { value: 'partyB', label: '我方是租客' },
]

const reviewDepthOptions = [
  { value: 'balanced', label: '标准' },
  { value: 'strict', label: '严格风控' },
  { value: 'business', label: '宽松友好' },
]

const knowledgeBaseItems = [
  {
    title: '民法典租赁规则',
    tag: '租房核心',
    text: '关注租期、维修义务、租赁物使用、解除责任、买卖不破租赁等租房基础规则。',
  },
  {
    title: '商品房屋租赁管理办法',
    tag: '租赁合规',
    text: '关注租赁备案、隔断房限制、群租风险、消防安全、房屋用途和出租合规。',
  },
  {
    title: '租房常见陷阱库',
    tag: '避坑指南',
    text: '识别押金扣款、自动涨租、维修推诿、固定保洁费、家电折旧费、单方解释权。',
  },
  {
    title: '押金纠纷裁判思路',
    tag: '押金守护',
    text: '押金扣除通常要有实际损失、合理必要和凭证支持，正常使用损耗不应随意扣款。',
  },
  {
    title: '租客维权指南',
    tag: '权益保护',
    text: '覆盖换锁收房、单方涨租、无故扣押金、拒绝维修等场景的协商和投诉路径。',
  },
  {
    title: '租房谈判策略',
    tag: '话术技巧',
    text: '提供押金、维修、提前解约、涨租限制、杂费凭证等条款的谈判话术。',
  },
]

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term))
}

function extractEvidenceSnippet(text, keywords) {
  const keyword = keywords.find((term) => text.includes(term))

  if (!keyword) return ''

  const index = text.indexOf(keyword)
  const start = Math.max(0, index - 52)
  const end = Math.min(text.length, index + keyword.length + 96)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < text.length ? '...' : ''

  return `${prefix}${text.slice(start, end).trim()}${suffix}`
}

function cleanContractTextForReview(text) {
  return text.replace(/\n*【[^】]+修改建议】[\s\S]*?(?=\n\n【[^】]+修改建议】|$)/g, '').trim()
}

function detectContractType(text) {
  const leaseSignals = ['房屋租赁合同', '出租方', '承租方', '月租金', '押一付三', '押金', '租期', '水、电、燃气']
  const serviceSignals = ['服务内容', '交付成果', '验收', '知识产权', '源文件', '创意方案', '项目阶段']
  const purchaseSignals = ['采购', '供货', '货物', '收货', '质保', '发票']
  const employmentSignals = ['劳动合同', '用人单位', '劳动者', '试用期', '工资', '社会保险']

  const score = (signals) => signals.filter((signal) => text.includes(signal)).length
  const scores = [
    { value: 'lease', score: score(leaseSignals) },
    { value: 'service', score: score(serviceSignals) },
    { value: 'purchase', score: score(purchaseSignals) },
    { value: 'employment', score: score(employmentSignals) },
  ].sort((a, b) => b.score - a.score)

  return scores[0].score >= 2 ? scores[0].value : 'lease'
}

function resolveReviewProfile(profile, text) {
  const detectedContractType = detectContractType(text)

  return {
    ...profile,
    detectedContractType,
    contractType: profile.contractType === 'auto' ? detectedContractType : profile.contractType,
  }
}

function getContractTypeLabel(value) {
  return contractTypeOptions.find((item) => item.value === value)?.label || value
}

function makeProfessionalFinding({
  id,
  title,
  level = 'medium',
  score = 10,
  dimension = '综合',
  priority = 'P1',
  keywords = [],
  explain,
  suggestion,
  evidence,
  legalBasis,
  negotiation,
  replacement,
  replaceFrom,
}) {
  return {
    id,
    title,
    level,
    score,
    icon: AlertTriangle,
    levelText: level === 'high' ? '高风险' : level === 'medium' ? '中风险' : '低风险',
    keywords,
    hits: keywords,
    matched: true,
    dimension,
    priority,
    explain,
    suggestion,
    replaceFrom: replaceFrom || evidence,
    replacement,
    evidence,
    legalBasis,
    negotiation,
  }
}

function makeLeaseFinding({
  id,
  title,
  level = 'medium',
  score = 10,
  dimension,
  priority = 'P1',
  keywords,
  explain,
  suggestion,
  evidence,
  legalBasis = '参考《民法典》合同编关于租赁合同、格式条款、公平原则、违约责任和合同解除的规则。',
  negotiation,
  replacement,
}) {
  return makeProfessionalFinding({
    id,
    title,
    level,
    score,
    dimension,
    priority,
    keywords,
    explain,
    suggestion,
    evidence,
    legalBasis,
    negotiation,
    replacement,
  })
}

function getLeaseFindings(text) {
  const findings = []
  const add = (finding) => {
    const hits = finding.keywords.filter((keyword) => text.includes(keyword))

    if (!hits.length) return

    const hasExactEvidence = text.includes(finding.evidence)
    findings.push({
      ...finding,
      evidence: hasExactEvidence ? finding.evidence : extractEvidenceSnippet(text, hits),
      hits,
      replaceFrom: hasExactEvidence ? finding.replaceFrom : '',
    })
  }

  add(makeLeaseFinding({
    id: 'lease-auto-renewal-rent-up',
    title: '自动续租并固定涨租',
    level: 'medium',
    score: 10,
    dimension: '租期',
    priority: 'P1',
    keywords: ['自动续期12个月', '上调8%'],
    evidence: '合同到期前30日，如双方均未提出异议，本合同自动续期12个月，续期租金在当期基础上上调8%。',
    explain: '到期沉默即自动续租，且租金自动上调，会让承租人因未及时提出异议而承担新的租期和涨租成本。',
    suggestion: '建议改为到期前双方书面确认续租，租金另行协商，不应默认涨租。',
    negotiation: '可接受优先续租权，但不要接受“沉默续租 + 自动涨价”的组合。',
    replacement: '合同期满后如需续租，双方应在期满前30日另行书面确认续租期限和租金标准；未达成书面一致的，本合同到期终止。',
  }))

  add(makeLeaseFinding({
    id: 'lease-termination-asymmetry',
    title: '提前解除权明显不对等',
    level: 'high',
    score: 16,
    dimension: '解除',
    priority: 'P0',
    keywords: ['提前退租须提前60日', '相当于2个月租金', '提前15日通知乙方即可'],
    evidence: '乙方提前退租须提前60日书面通知甲方，并支付违约金（相当于2个月租金）。甲方因出售房屋等自身原因需提前解除合同的，提前15日通知乙方即可，双方按实际居住天数结算租金。',
    explain: '承租人提前退租成本高，出租人因自身原因解除却几乎无赔偿，权利义务严重失衡。',
    suggestion: '建议设置对等提前通知期限和对等违约金，出租人提前解除也应补偿搬家等合理损失。',
    negotiation: '重点争取“出租人提前解除也支付同等违约金”，这是租赁合同的核心保护。',
    replacement: '任一方因自身原因提前解除合同的，应提前30日书面通知对方，并向对方支付相当于1个月租金的违约金；因甲方提前解除导致乙方搬迁的，甲方还应承担合理搬家费用。',
  }))

  add(makeLeaseFinding({
    id: 'lease-unilateral-rent-adjustment',
    title: '出租方单方调价并没收押金',
    level: 'high',
    score: 18,
    dimension: '租金',
    priority: 'P0',
    keywords: ['上涨超过20%', '相应调整租金', '15日内搬离', '押金不予返还'],
    evidence: '租赁期间如周边同户型租金均价上涨超过20%，甲方有权要求乙方按上涨比例相应调整租金。乙方如不接受调整，须在15日内搬离，押金不予返还。',
    explain: '租期内赋予出租方单方涨租权，且承租人不同意就要搬离并损失押金，风险很高。',
    suggestion: '建议删除租期内单方调价权，租金在固定租期内保持不变。',
    negotiation: '租金是租赁合同核心条款，固定租期内不应由一方单方改变。',
    replacement: '租赁期限内月租金保持不变。合同期满续租时，双方可根据市场情况另行协商租金标准。',
  }))

  add(makeLeaseFinding({
    id: 'lease-daily-late-fee-5-percent',
    title: '日息 5% 滞纳金过高',
    level: 'high',
    score: 18,
    dimension: '违约责任',
    priority: 'P0',
    keywords: ['每逾期一日', '月租金5%', '滞纳金'],
    evidence: '乙方逾期支付租金，每逾期一日加收月租金5%作为滞纳金。',
    explain: '按月租金每日 5% 计算，逾期 20 天就相当于一个月租金，明显偏高。',
    suggestion: '建议改为每日万分之三至万分之五，或设置总额上限。',
    negotiation: '可以承认逾期应承担责任，但要求费用与实际损失相当。',
    replacement: '乙方逾期支付租金的，每逾期一日按逾期金额的万分之五向甲方支付违约金，违约金总额最高不超过当期应付租金的20%。',
  }))

  add(makeLeaseFinding({
    id: 'lease-lockout-forfeiture',
    title: '逾期换锁收房并没收全部款项',
    level: 'high',
    score: 20,
    dimension: '居住权',
    priority: 'P0',
    keywords: ['逾期超过7日', '换锁收回房屋', '已收租金及押金不予退还'],
    evidence: '逾期超过7日的，甲方有权换锁收回房屋，已收租金及押金不予退还。',
    explain: '出租方自行换锁收房容易引发居住权、财物和程序争议，且没收全部款项过重。',
    suggestion: '建议改为书面催告、合理宽限期和依法解除，不应自行换锁。',
    negotiation: '要求保留催告和协商窗口，避免出租人单方强制处置房屋和财物。',
    replacement: '乙方逾期支付租金超过7日的，甲方应先书面催告并给予不少于7日宽限期；宽限期届满仍未支付的，甲方可依法解除合同并按实际损失主张违约责任。',
  }))

  add(makeLeaseFinding({
    id: 'lease-deposit-return-delay',
    title: '押金退还周期过长',
    level: 'medium',
    score: 9,
    dimension: '押金',
    priority: 'P1',
    keywords: ['45个工作日内退还押金'],
    evidence: '合同终止且乙方已结清费用、交还钥匙后，甲方在45个工作日内退还押金。',
    explain: '押金退还周期接近两个月，承租人资金被占用时间过长。',
    suggestion: '建议改为交房验收后 3 至 7 个工作日内退还。',
    negotiation: '押金只用于担保未结清费用和损坏，不应长期占用。',
    replacement: '合同终止并完成交房验收、费用结清后，甲方应在7个工作日内无息退还剩余押金。',
  }))

  add(makeLeaseFinding({
    id: 'lease-arbitrary-deposit-deduction',
    title: '押金扣款项目过宽',
    level: 'high',
    score: 16,
    dimension: '押金',
    priority: 'P0',
    keywords: ['全屋保洁费（不低于400元）', '家具家电折旧补偿', '甲方认定的其他合理扣款'],
    evidence: '退还时甲方可扣除以下费用：房屋及设施维修费、全屋保洁费（不低于400元）、墙面修补粉刷费、家具家电折旧补偿、以及甲方认定的其他合理扣款。',
    explain: '扣款项目包含固定保洁费、折旧补偿和出租方单方认定事项，押金可能被任意扣减。',
    suggestion: '建议扣款限于实际损坏、未结清费用，并要求提供票据或维修凭证。',
    negotiation: '要求“实际发生、合理必要、凭证支持”三项条件同时满足。',
    replacement: '押金仅可用于抵扣乙方未结清费用或因乙方原因造成的实际损坏维修费。甲方扣款应提供照片、维修清单和有效票据，正常使用损耗不得从押金中扣除。',
  }))

  add(makeLeaseFinding({
    id: 'lease-all-maintenance-tenant',
    title: '自然损耗维修全部转嫁承租人',
    level: 'high',
    score: 16,
    dimension: '维修',
    priority: 'P0',
    keywords: ['任何问题的，由乙方自行维修并承担费用', '自然原因造成的损坏，同样由乙方负责'],
    evidence: '租赁期内房屋及附属设施出现任何问题的，由乙方自行维修并承担费用。因水管老化、墙体开裂等自然原因造成的损坏，同样由乙方负责。',
    explain: '水管老化、墙体开裂等非承租人原因造成的问题也由承租人承担，明显加重承租人责任。',
    suggestion: '建议区分人为损坏和自然损耗，房屋主体、老化和设备自然故障由出租人维修。',
    negotiation: '承租人可承担人为损坏，不应承担房屋老化和结构问题。',
    replacement: '因房屋主体结构、管线老化、设备自然损耗或非乙方原因造成的维修费用由甲方承担；因乙方不当使用造成的损坏由乙方承担。',
  }))

  add(makeLeaseFinding({
    id: 'lease-landlord-entry-no-consent',
    title: '出租方可不经同意进入房屋',
    level: 'high',
    score: 18,
    dimension: '居住权',
    priority: 'P0',
    keywords: ['进入房屋进行检查', '带人看房', '无需另行征得乙方同意'],
    evidence: '甲方及中介人员有权在合理时间进入房屋进行检查、维修或带人看房，无需另行征得乙方同意。',
    explain: '租赁期间承租人享有房屋占有和安宁居住利益，出租方未经同意进入房屋风险很高。',
    suggestion: '建议要求提前通知并经承租人确认，紧急维修除外。',
    negotiation: '检查和带看可以配合，但必须提前预约并尊重居住安全和隐私。',
    replacement: '甲方或中介需进入房屋检查、维修或带看时，应至少提前24小时通知乙方并取得乙方同意；紧急抢修等特殊情况除外。',
  }))

  add(makeLeaseFinding({
    id: 'lease-excessive-restoration',
    title: '退租恢复义务过重',
    level: 'medium',
    score: 10,
    dimension: '押金',
    priority: 'P1',
    keywords: ['全屋墙面重新粉刷', '全部区域深度保洁', '费用按市场价从押金中扣除'],
    evidence: '退租交房时，乙方须将全屋恢复至出租前的整洁状态，包括全屋墙面重新粉刷（白色乳胶漆）、全部区域深度保洁。如甲方认为恢复不到位，由甲方安排第三方处理，费用按市场价从押金中扣除。',
    explain: '要求退租必然全屋粉刷和深度保洁，且由出租方单方判断，容易扩大扣押金范围。',
    suggestion: '建议限于非正常使用造成的损坏，正常使用痕迹不应要求全屋翻新。',
    negotiation: '可承诺基本清洁交付，但不接受把正常折旧变成翻新义务。',
    replacement: '乙方退租时应保持房屋基本清洁并返还钥匙。正常使用损耗不构成违约；因乙方原因造成明显损坏的，乙方按实际维修费用承担责任。',
  }))

  add(makeLeaseFinding({
    id: 'lease-utility-no-voucher',
    title: '杂费收费缺少凭证',
    level: 'medium',
    score: 9,
    dimension: '费用',
    priority: 'P1',
    keywords: ['不得要求提供原始缴费凭证'],
    evidence: '甲方每季度抄表后通知乙方缴费，乙方不得要求提供原始缴费凭证。',
    explain: '水电燃气费用由出租方通知但不提供原始凭证，承租人难以核对真实成本。',
    suggestion: '建议要求提供账单、缴费记录或物业/供水供电单位凭证。',
    negotiation: '费用可由承租人承担，但应透明可核验。',
    replacement: '甲方代收水、电、燃气、物业等费用的，应向乙方提供抄表记录、缴费账单或有效凭证，乙方核对无误后支付。',
  }))

  add(makeLeaseFinding({
    id: 'lease-broad-default-six-months',
    title: '违约情形过宽且违约金过高',
    level: 'high',
    score: 18,
    dimension: '违约责任',
    priority: 'P0',
    keywords: ['相当于6个月租金的违约金', '其他甲方认为影响房屋价值的行为'],
    evidence: '乙方有下列情形之一的，甲方有权立即解除合同、收回房屋，押金及剩余租金不予退还，并有权要求乙方另行赔偿相当于6个月租金的违约金： 　　（1）擅自转租或转借的； 　　（2）拖欠租金超过3天的； 　　（3）利用房屋从事违法活动的； 　　（4）擅自饲养宠物的； 　　（5）擅自改动房屋结构的； 　　（6）其他甲方认为影响房屋价值的行为。',
    explain: '违约情形包含出租方主观判断，且同时没收押金、剩余租金并追加 6 个月违约金，责任叠加过重。',
    suggestion: '建议删除主观兜底项，违约金改为与实际损失相当，并设置整改期。',
    negotiation: '可接受严重违约解除，但普通违约应先通知整改。',
    replacement: '乙方严重违约且经甲方书面催告后仍未整改的，甲方可解除合同并要求乙方承担实际损失；违约金最高不超过1个月租金，已收但未发生的租金应据实退还。',
  }))

  add(makeLeaseFinding({
    id: 'lease-landlord-loss-exclusion',
    title: '出租方违约责任被排除',
    level: 'medium',
    score: 12,
    dimension: '违约责任',
    priority: 'P1',
    keywords: ['仅退还剩余租金', '不承担搬家费、误工费等其他任何损失'],
    evidence: '因甲方原因导致乙方无法继续居住的，甲方仅退还剩余租金，不承担搬家费、误工费等其他任何损失。',
    explain: '出租方原因导致无法居住时，只退剩余租金不足以覆盖承租人的搬迁和替代租房损失。',
    suggestion: '建议至少承担合理搬家费、临时住宿差价和同等违约金。',
    negotiation: '这类损失是出租方违约的直接后果，应保留合理赔偿空间。',
    replacement: '因甲方原因导致乙方无法继续居住的，甲方应退还剩余租金和押金，并赔偿乙方因此产生的合理搬家费、临时住宿费及其他直接损失。',
  }))

  add(makeLeaseFinding({
    id: 'lease-overbroad-exemption',
    title: '免责事由过宽',
    level: 'medium',
    score: 12,
    dimension: '解除',
    priority: 'P1',
    keywords: ['甲方债务纠纷', '邻居投诉', '物业公司干涉', '甲方不承担违约责任'],
    evidence: '因政府征收、拆迁、房屋被司法查封、甲方债务纠纷、邻居投诉、物业公司干涉等非甲方主观意愿所能控制的原因，造成合同无法继续履行的，甲方不承担违约责任，仅按乙方实际居住天数结算应退租金。',
    explain: '把甲方债务纠纷、邻居投诉、物业干涉等都列为免责，范围明显过宽。',
    suggestion: '建议只保留法定不可抗力或非双方原因，甲方自身债务和权属问题不应免责。',
    negotiation: '区分不可抗力和出租方自身风险，不能把所有外部争议都转嫁给承租人。',
    replacement: '因不可抗力或依法征收拆迁导致合同无法履行的，双方按实际居住天数结算；因甲方权属、债务、抵押、查封或管理原因导致无法居住的，甲方应承担违约责任。',
  }))

  add(makeLeaseFinding({
    id: 'lease-unfavorable-jurisdiction',
    title: '管辖地点偏向出租方',
    level: 'low',
    score: 7,
    dimension: '管辖',
    priority: 'P2',
    keywords: ['甲方户籍所在地人民法院'],
    evidence: '双方发生争议协商不成的，应向甲方户籍所在地人民法院起诉。',
    explain: '约定到出租方户籍所在地起诉，可能增加承租人维权成本，且不一定与房屋所在地一致。',
    suggestion: '建议改为房屋所在地法院或合同履行地法院。',
    negotiation: '房屋所在地与证据、现场勘验更相关，也更中立。',
    replacement: '双方发生争议协商不成的，应向房屋所在地有管辖权的人民法院提起诉讼。',
  }))

  add(makeLeaseFinding({
    id: 'lease-format-clause-waiver',
    title: '签字即放弃异议且解释权归出租方',
    level: 'medium',
    score: 12,
    dimension: '格式条款',
    priority: 'P1',
    keywords: ['不得以"未注意"或"不理解"', '本合同解释权归甲方'],
    evidence: '本合同自双方签字之日起生效。乙方签字即视为已充分阅读并完全同意本合同全部内容，此后不得以"未注意"或"不理解"为由对任何条款提出异议。\n\n　　本合同解释权归甲方。',
    explain: '该条款试图排除承租人对格式条款的异议，并把解释权单方交给出租方，容易削弱承租人救济。',
    suggestion: '建议删除单方解释权，改为双方协商解释，争议由法院依法判断。',
    negotiation: '合同解释不能由一方最终决定，尤其是格式条款。',
    replacement: '双方确认已阅读并理解本合同内容。对合同条款理解发生争议的，应按照法律规定、合同目的、交易习惯和公平原则解释。',
  }))

  add(makeLeaseFinding({
    id: 'lease-title-defect-no-liability',
    title: '房屋权属问题责任不足',
    level: 'medium',
    score: 9,
    dimension: '权属',
    priority: 'P1',
    keywords: ['房屋权属问题', '双方互不追究'],
    evidence: '如因房屋权属问题导致乙方无法继续居住的，甲方退还剩余租金，双方互不追究。',
    explain: '如果因出租方权属瑕疵导致无法居住，仅退剩余租金不能覆盖承租人搬迁等直接损失。',
    suggestion: '建议要求出租方保证有权出租，并对权属瑕疵承担违约责任。',
    negotiation: '房屋权属是出租方基础义务，不能只退未住期间租金。',
    replacement: '甲方应保证其对房屋享有合法出租权。因权属瑕疵导致乙方无法使用房屋的，甲方应退还剩余租金和押金，并赔偿乙方因此产生的合理直接损失。',
  }))

  return findings
}

function getProfessionalFindings(text, profile) {
  if (!text.trim()) return []
  if (profile.contractType === 'lease') return getLeaseFindings(text)

  const findings = []
  const strictMode = profile.reviewDepth === 'strict'
  const isServiceContract = profile.contractType === 'service'

  if (!includesAny(text, ['责任上限', '赔偿上限', '累计赔偿', '最高赔偿', '不超过合同金额'])) {
    findings.push(
      makeProfessionalFinding({
        id: 'liability-cap-missing',
        title: '缺少责任上限约定',
        level: strictMode ? 'high' : 'medium',
        score: strictMode ? 16 : 11,
        dimension: '违约责任',
        priority: strictMode ? 'P0' : 'P1',
        keywords: ['违约', '赔偿'].filter((keyword) => text.includes(keyword)),
        explain: '合同没有明确累计赔偿责任上限，发生争议时可能导致赔偿边界不可控。',
        suggestion: '建议补充责任上限，并保留故意、重大过失、保密和知识产权侵权等例外。',
        evidence: '未检出“责任上限、赔偿上限、累计赔偿、最高赔偿”等边界表述。',
        legalBasis: '参考民法典合同编关于违约责任、损失赔偿和公平原则的规则。',
        negotiation: '可先提出“以合同金额为上限”的通用方案，再接受对重大过失和保密侵权设置例外。',
        replacement:
          '除因故意、重大过失、侵犯知识产权或违反保密义务造成的损失外，任一方在本合同项下的累计赔偿责任以本合同已支付或应支付金额为上限。',
      }),
    )
  }

  if (
    includesAny(text, ['个人信息', '用户数据', '客户数据', '敏感信息', '数据'])
    && !includesAny(text, ['处理目的', '最小必要', '授权同意', '删除', '脱敏', '安全措施'])
  ) {
    findings.push(
      makeProfessionalFinding({
        id: 'personal-data-boundary',
        title: '数据处理边界不足',
        level: 'high',
        score: 18,
        dimension: '数据合规',
        priority: 'P0',
        keywords: ['个人信息', '用户数据', '客户数据', '数据'].filter((keyword) => text.includes(keyword)),
        explain: '合同涉及数据或个人信息，但缺少处理目的、范围、授权、安全措施和删除机制。',
        suggestion: '建议补充数据处理附件或专门条款，明确最小必要、授权基础、保存期限和删除义务。',
        evidence: '检出数据相关表述，但未检出处理目的、最小必要、授权同意、删除或安全措施。',
        legalBasis: '参考个人信息保护法关于合法、正当、必要、诚信和最小必要处理原则的要求。',
        negotiation: '可要求对方提供数据清单和处理目的，先锁定“能用什么数据、用到什么时候、如何删除”。',
        replacement:
          '双方处理个人信息或客户数据时，应限于履行本合同所必需的目的和最小范围，并采取合理安全措施。未经数据提供方书面同意，任何一方不得超范围使用、披露或转让相关数据；合同终止后应按要求返还、删除或匿名化处理。',
      }),
    )
  }

  if (
    includesAny(text, ['调整服务范围', '新增需求', '变更', '无条件配合'])
    && !includesAny(text, ['变更单', '书面确认', '费用和周期', '另行确认'])
  ) {
    findings.push(
      makeProfessionalFinding({
        id: 'change-control-missing',
        title: '需求变更控制不足',
        level: 'medium',
        score: 12,
        dimension: '履行',
        priority: 'P1',
        keywords: ['调整服务范围', '新增需求', '变更', '无条件配合'].filter((keyword) => text.includes(keyword)),
        explain: '合同允许服务范围或需求变化，但没有约定变更确认、费用调整和交付周期。',
        suggestion: '建议加入变更单机制，任何新增或调整需求都需书面确认费用、周期和交付物。',
        evidence: '检出变更或无条件配合表述，但未检出变更单、书面确认、费用和周期安排。',
        legalBasis: '参考合同履行中诚实信用、协作履行和合同目的解释规则。',
        negotiation: '不要直接拒绝配合，可以改为“可配合，但需确认费用、排期和验收标准”。',
        replacement:
          '任何新增需求、服务范围调整或交付标准变更，均应由双方以书面变更单确认对应费用、交付周期和验收标准；未经确认的变更不视为乙方当然义务。',
      }),
    )
  }

  if (isServiceContract && !includesAny(text, ['交付清单', '交付成果', '源文件范围', '验收标准'])) {
    findings.push(
      makeProfessionalFinding({
        id: 'deliverable-list-missing',
        title: '交付物清单不够明确',
        level: 'medium',
        score: 10,
        dimension: '验收',
        priority: 'P1',
        keywords: ['服务', '交付'].filter((keyword) => text.includes(keyword)),
        explain: '服务类合同如果没有明确交付清单和验收标准，后续容易产生范围争议。',
        suggestion: '建议列明文件格式、数量、版本、源文件范围、验收标准和交付方式。',
        evidence: '服务合同画像下，未检出交付清单、交付成果、源文件范围或验收标准。',
        legalBasis: '参考合同条款解释应结合合同性质、目的、交易习惯和履行行为的规则。',
        negotiation: '可以把交付清单作为附件，避免在正文中反复拉扯范围。',
        replacement:
          '交付成果以附件《交付物清单》为准，清单应明确交付物名称、数量、格式、版本、源文件范围、交付方式和验收标准。清单外新增事项由双方另行书面确认。',
      }),
    )
  }

  if (!includesAny(text, ['通知地址', '电子邮件', '送达', '书面通知', '联系人'])) {
    findings.push(
      makeProfessionalFinding({
        id: 'notice-service-missing',
        title: '通知送达机制缺失',
        level: 'low',
        score: 6,
        dimension: '证据',
        priority: 'P2',
        keywords: [],
        explain: '合同未约定通知方式和送达规则，解除、催告、验收反馈等关键动作可能难以举证。',
        suggestion: '建议写明联系人、邮箱、地址、送达时间和变更通知义务。',
        evidence: '未检出通知地址、电子邮件、送达、书面通知或联系人条款。',
        legalBasis: '参考合同履行和争议解决中的通知、催告与证据留存要求。',
        negotiation: '这是低对抗条款，通常可作为“提高沟通效率”的中性补充提出。',
        replacement:
          '双方确认本合同载明的联系人、电子邮箱和通讯地址为有效通知方式。通知发送至约定邮箱或地址后视为送达；任一方变更联系方式的，应提前书面通知对方。',
      }),
    )
  }

  return findings
}

function createKnowledgePrompt(profile) {
  const contractType = getContractTypeLabel(profile.contractType)
  const partyRole = partyRoleOptions.find((item) => item.value === profile.partyRole)?.label
  const reviewDepth = reviewDepthOptions.find((item) => item.value === profile.reviewDepth)?.label
  const knowledgeLines = knowledgeBaseItems.map((item) => `- ${item.title}（${item.tag}）：${item.text}`).join('\n')
  if (profile.contractType === 'lease') {
    return `审查画像：
- 合同类型：${contractType}
- 我方身份：${partyRole}
- 审查强度：${reviewDepth}

内置知识库：
${knowledgeLines}

房屋租赁合同必须重点检查：自动续租涨租、单方调价、押金扣款和退还周期、维修责任归属、出租人入户权、逾期滞纳金比例、换锁收房条款、提前解除不对等、剩余租金没收、违约金过高、杂费凭证、管辖地偏好、格式条款效力、权属瑕疵责任、退租恢复义务、免责范围过宽。`
  }

  return `审查画像：
- 合同类型：${contractType}
- 我方身份：${partyRole}
- 审查强度：${reviewDepth}

内置知识库：
${knowledgeLines}

请优先检查：付款与验收、解除权对等、违约责任上限、知识产权归属、保密期限与违约金、个人信息/数据处理、管辖与通知送达、需求变更控制、证据留存。`
}

function analyzeContract(text, profile = { contractType: 'lease', partyRole: 'partyB', reviewDepth: 'strict' }) {
  const reviewText = cleanContractTextForReview(text)
  const lowerText = reviewText.toLowerCase()

  const baseFindings =
    profile.contractType === 'service'
      ? riskRules
          .map((rule) => {
            const hits = rule.keywords.filter((keyword) =>
              lowerText.includes(keyword.toLowerCase()),
            )

            return {
              ...rule,
              ...riskDetails[rule.id],
              hits,
              matched: hits.length > 0,
            }
          })
          .filter((rule) => rule.matched)
      : []

  return [...baseFindings, ...getProfessionalFindings(reviewText, profile)]
}

function getRiskSummary(findings) {
  const score = Math.min(100, findings.reduce((total, item) => total + item.score, 0))
  const highCount = findings.filter((item) => item.level === 'high').length
  const mediumCount = findings.filter((item) => item.level === 'medium').length

  if (score >= 70) {
    return { score, label: '高风险', tone: 'danger', advice: '建议先修核心条款，再进入签署。', highCount, mediumCount }
  }

  if (score >= 35) {
    return { score, label: '需重点关注', tone: 'warning', advice: '主要风险可通过补充条款降低。', highCount, mediumCount }
  }

  return { score, label: '低风险', tone: 'safe', advice: '未发现明显高风险，仍建议人工复核。', highCount, mediumCount }
}

function getDimensionScores(findings) {
  return scoreDimensions.map((dimension) => {
    const score = Math.min(
      100,
      findings
        .filter((finding) => finding.dimension === dimension)
        .reduce((total, finding) => total + finding.score * 3, 0),
    )

    return {
      dimension,
      score,
      tone: score >= 70 ? 'high' : score >= 35 ? 'medium' : 'low',
    }
  })
}

function buildRevisionItems(acceptedIds, rules = riskRules) {
  return rules
    .filter((rule) => acceptedIds.has(rule.id))
    .map((rule) => ({
      ...rule,
      ...riskDetails[rule.id],
    }))
}

function createRevisedContractDraft(contractText, revisionItems) {
  const cleanText = cleanContractTextForReview(contractText)
  let draft = cleanText
  const appendedClauses = []

  revisionItems.forEach((item) => {
    if (item.replaceFrom && draft.includes(item.replaceFrom)) {
      draft = draft.replace(item.replaceFrom, item.replacement)
      return
    }

    if (item.evidence && draft.includes(item.evidence)) {
      draft = draft.replace(item.evidence, item.replacement)
      return
    }

    appendedClauses.push(`【${item.title}】\n${item.replacement}`)
  })

  if (!appendedClauses.length) return draft

  return [
    draft,
    '',
    '补充修订条款',
    ...appendedClauses.map((clause, index) => `${index + 1}. ${clause}`),
  ].join('\n')
}

function parseMoney(value) {
  const amount = Number(String(value).replace(/[^\d.]/g, ''))
  return Number.isFinite(amount) ? amount : 0
}

function formatMoney(value) {
  return `${Math.max(0, Math.round(value)).toLocaleString('zh-CN')} 元`
}

function calculateDepositReturn(inputs) {
  const depositAmount = parseMoney(inputs.depositAmount)
  const unpaidFees = parseMoney(inputs.unpaidFees)
  const repairCost = parseMoney(inputs.repairCost)
  const cleaningCost = parseMoney(inputs.cleaningCost)
  const hasVoucher = inputs.hasVoucher === 'yes'
  const normalWear = inputs.normalWear === 'yes'
  const documentedDamageDeduction = hasVoucher && !normalWear ? repairCost + cleaningCost : 0
  const totalDeduction = Math.min(depositAmount, unpaidFees + documentedDamageDeduction)
  const estimatedReturn = Math.max(0, depositAmount - totalDeduction)
  const warning = !hasVoucher && (repairCost > 0 || cleaningCost > 0)
    ? '房东未提供票据时，维修和保洁扣款建议要求照片、清单和发票。'
    : normalWear
      ? '正常使用损耗通常不应从押金中随意扣除。'
      : '存在非正常损坏且有凭证时，可按实际损失协商扣除。'

  return {
    estimatedReturn,
    totalDeduction,
    warning,
  }
}

function formatEvidenceDate(value) {
  if (!value) return '待确认'
  return value
}

function buildEvidenceCommunication(type, formData) {
  const address = formData.address || 'XX小区XX栋XX室'
  const deposit = formData.deposit || 'XXXX'
  const checkin = formatEvidenceDate(formData.checkinDate)
  const checkout = formatEvidenceDate(formData.checkoutDate)
  const handoverDate = formatEvidenceDate(formData.handoverDate)
  const handoverTime = formData.handoverTime || '待协商'
  const repairItem = formData.repairItem || '房屋维修事项'
  const repairCost = formData.repairCost || '待确认'
  const notes = formData.notes || '房屋已按合同约定完成基础清洁，家电家具按现状交接。'

  if (type === 'repair') {
    return `尊敬的房东/中介：

您好。

关于${address}的${repairItem}，我已整理维修前后照片、沟通记录和费用凭证。当前维修费用为人民币${repairCost}元。

为便于核对，请您确认以下事项：
1. 该维修是否属于自然损耗、房屋老化或非承租人原因造成；
2. 如需从押金中扣除，请提供维修清单、照片、报价或有效票据；
3. 如属于出租方维修义务，请确认费用承担方式和处理时间。

我会配合合理核验，但不接受无凭证、无明细或将正常使用损耗直接从押金中扣除。

谢谢。`
  }

  if (type === 'handover') {
    return `尊敬的房东/中介：

您好。

我是${address}的承租人，计划于${handoverDate} ${handoverTime}办理退租交接。

交接时建议双方共同确认：
1. 房屋整体状况和重点设施状态；
2. 水、电、燃气、物业等费用结清情况；
3. 钥匙、门禁卡、遥控器等物品交还数量；
4. 押金退还金额、扣款依据和退还时间。

备注事项：${notes}

请您确认上述时间是否方便。如需调整，请回复可交接时间。`
  }

  return `尊敬的房东/中介：

您好。

我是${address}的承租人，入住时间为${checkin}，退租时间为${checkout}。根据租赁合同和实际交接情况，现申请退还押金人民币${deposit}元。

我已准备以下材料用于核对：
1. 租赁合同、押金收据或转账记录；
2. 入住和退租时房屋、家具、家电照片；
3. 水电燃气等费用结清凭证；
4. 与退租、维修、押金相关的沟通记录。

如您认为需要扣除押金，请提供明确扣款项目、金额、照片、维修清单和有效票据。正常使用损耗不应作为任意扣款依据。

请您在完成交接核对后确认押金退还安排。谢谢。`
}

function createEvidencePackageText({ formData, evidence, actions, communicationText }) {
  const selectedLines = []
  const missingLines = []

  Object.entries(evidenceGroupMeta).forEach(([group, meta]) => {
    meta.items.forEach((item, index) => {
      const line = `${meta.title}：${item}`
      if (evidence[group][index]) {
        selectedLines.push(line)
      } else {
        missingLines.push(line)
      }
    })
  })

  const actionLines = evidenceActions.map((item, index) => `${actions[index] ? '[已完成]' : '[待完成]'} ${item.title}：${item.desc}`)

  return [
    '租房安心审 退租证据包摘要',
    `生成时间：${new Date().toLocaleString()}`,
    '',
    '一、退租基础信息',
    `房屋地址：${formData.address || '待填写'}`,
    `押金金额：${formData.deposit || '待填写'} 元`,
    `月租金：${formData.monthlyRent || '待填写'} 元`,
    `房东/中介：${formData.landlordName || '待填写'}`,
    `联系电话：${formData.landlordPhone || '待填写'}`,
    `入住日期：${formatEvidenceDate(formData.checkinDate)}`,
    `退租日期：${formatEvidenceDate(formData.checkoutDate)}`,
    `交接时间：${formatEvidenceDate(formData.handoverDate)} ${formData.handoverTime || ''}`.trim(),
    '',
    '二、已收集证据',
    selectedLines.length ? selectedLines.join('\n') : '暂无已勾选证据。',
    '',
    '三、待补齐证据',
    missingLines.length ? missingLines.join('\n') : '证据清单已全部勾选。',
    '',
    '四、下一步行动',
    actionLines.join('\n'),
    '',
    '五、沟通说明',
    communicationText || '尚未生成沟通说明。',
    '',
    '提示：本摘要用于整理材料和沟通留痕，不构成法律意见。',
  ].join('\n')
}

function getEvidenceGapAdvice(evidenceStats, evidence) {
  const missingGroups = Object.entries(evidenceGroupMeta)
    .map(([group, meta]) => {
      const missingItems = meta.items.filter((_, index) => !evidence[group][index])
      return {
        group,
        title: meta.title,
        missingItems,
      }
    })
    .filter((item) => item.missingItems.length > 0)

  const firstMissing = missingGroups[0]?.missingItems[0] || '证据清单已完整'
  const summary = evidenceStats.percent >= 80
    ? '证据包已接近完整，可以进入交接和押金退还沟通。'
    : evidenceStats.percent >= 50
      ? '证据包已有基础材料，建议优先补齐照片和费用凭证。'
      : '证据链还比较薄，建议先补合同、押金凭证和退租照片。'

  return {
    summary,
    firstMissing,
    missingGroups,
  }
}

async function copyTextToClipboard(text) {
  if (!text) return false

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return true
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  const success = document.execCommand('copy')
  document.body.removeChild(textarea)
  return success
}

function createReportText({ summary, findings, revisionItems, contractText, reviewProfile }) {
  const contractType = contractTypeOptions.find((item) => item.value === reviewProfile.contractType)?.label
  const partyRole = partyRoleOptions.find((item) => item.value === reviewProfile.partyRole)?.label
  const reviewDepth = reviewDepthOptions.find((item) => item.value === reviewProfile.reviewDepth)?.label
  const riskLines = findings
    .map((finding, index) => {
      const details = riskDetails[finding.id]
      const priority = finding.priority || details?.priority || 'P2'
      const evidence = finding.evidence || details?.evidence || finding.hits.join('、')
      const negotiation = finding.negotiation || details?.negotiation || '建议结合交易背景与对方协商。'
      return [
        `${index + 1}. ${finding.title}（${finding.levelText}，${priority}）`,
        `风险解释：${finding.explain}`,
        `证据片段：${evidence}`,
        `修改建议：${finding.suggestion}`,
        `谈判话术：${negotiation}`,
      ].join('\n')
    })
    .join('\n\n')

  const revisionLines = revisionItems.length
    ? revisionItems
        .map((item, index) =>
          [
            `${index + 1}. ${item.title}`,
            `原风险：${item.evidence}`,
            `建议替换：${item.replacement}`,
          ].join('\n'),
        )
        .join('\n\n')
    : '暂无已采纳修改。'
  const revisedDraft = revisionItems.length
    ? createRevisedContractDraft(contractText, revisionItems)
    : '暂无修订版合同草案。'

  return [
    '租房安心审 AI 租房合同解读报告',
    `生成时间：${new Date().toLocaleString()}`,
    '',
    `合同类型：${contractType}`,
    `我方身份：${partyRole}`,
    `审查强度：${reviewDepth}`,
    `知识库：民法典租赁规则、商品房屋租赁管理办法、租房常见陷阱库、押金纠纷裁判思路、租客维权指南、租房谈判策略`,
    '',
    `综合评分：${summary.score}/100`,
    `风险结论：${summary.label}`,
    `审查建议：${summary.advice}`,
    '',
    '一、风险清单',
    riskLines || '未发现明显风险。',
    '',
    '二、已采纳修改说明',
    revisionLines,
    '',
    '三、修订版合同草案',
    revisedDraft,
    '',
    '四、当前合同文本',
    contractText || '暂无合同正文。',
  ].join('\n')
}

function HighlightedContract({ text, findings }) {
  const highlighted = useMemo(() => {
    const segments = [{ text, risk: null }]

    findings.forEach((finding) => {
      finding.hits.forEach((hit) => {
        for (let i = 0; i < segments.length; i += 1) {
          const segment = segments[i]
          if (segment.risk || !segment.text.includes(hit)) continue

          const parts = segment.text.split(hit)
          if (parts.length <= 1) continue

          const replacement = []
          parts.forEach((part, index) => {
            if (part) replacement.push({ text: part, risk: null })
            if (index < parts.length - 1) replacement.push({ text: hit, risk: finding.level })
          })

          segments.splice(i, 1, ...replacement)
          i += replacement.length - 1
        }
      })
    })

    return segments
  }, [findings, text])

  return (
    <div className="contract-view" aria-label="合同风险高亮预览">
      {highlighted.map((segment, index) =>
        segment.risk ? (
          <mark className={`risk-mark ${segment.risk}`} key={`${segment.text}-${index}`}>
            {segment.text}
          </mark>
        ) : (
          <span key={`${segment.text}-${index}`}>{segment.text}</span>
        ),
      )}
    </div>
  )
}

function FindingItem({ finding, accepted, onApply }) {
  const Icon = finding.icon

  return (
    <article className={`finding ${finding.level}`}>
      <div className="finding-heading">
        <span className="finding-icon">
          <Icon size={18} aria-hidden="true" />
        </span>
        <div>
          <div className="finding-title">{finding.title}</div>
          <div className="finding-meta">
            {finding.priority} · {finding.dimension} · 命中 {finding.hits.length} 个关键词
          </div>
        </div>
        <span className={`risk-badge ${finding.level}`}>{finding.levelText}</span>
      </div>
      <p>{finding.explain}</p>
      <div className="finding-evidence">
        <strong>证据片段</strong>
        <span>{finding.evidence}</span>
      </div>
      <div className="finding-law">
        <strong>依据</strong>
        <span>{finding.legalBasis}</span>
      </div>
      <div className="suggestion">
        <span>建议</span>
        {finding.suggestion}
      </div>
      <div className="negotiation-tip">
        <span>谈判话术</span>
        {finding.negotiation}
      </div>
      <button
        className={`apply-button ${accepted ? 'accepted' : ''}`}
        disabled={accepted}
        type="button"
        onClick={() => onApply(finding)}
      >
        {accepted ? <Check size={16} aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
        {accepted ? '已采纳修改' : '采纳并改写合同'}
      </button>
    </article>
  )
}

function EvidencePack({ onStatus }) {
  const [initialState] = useState(() => loadEvidencePackState())
  const [tab, setTab] = useState('info')
  const [toolType, setToolType] = useState('deposit')
  const [formData, setFormData] = useState(initialState.formData)
  const [evidence, setEvidence] = useState(initialState.evidence)
  const [actions, setActions] = useState(initialState.actions)
  const [communicationText, setCommunicationText] = useState(initialState.communicationText)

  const evidenceStats = useMemo(() => {
    const values = Object.values(evidence).flat()
    const checked = values.filter(Boolean).length
    const total = values.length
    return {
      checked,
      total,
      percent: total ? Math.round((checked / total) * 100) : 0,
    }
  }, [evidence])
  const evidenceAdvice = useMemo(() => getEvidenceGapAdvice(evidenceStats, evidence), [evidenceStats, evidence])
  const evidencePackageText = useMemo(
    () => createEvidencePackageText({ formData, evidence, actions, communicationText }),
    [actions, communicationText, evidence, formData],
  )

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.evidencePack, JSON.stringify({ formData, evidence, actions, communicationText }))
  }, [actions, communicationText, evidence, formData])

  const updateField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }))
  }

  const toggleEvidence = (group, index) => {
    setEvidence((current) => ({
      ...current,
      [group]: current[group].map((value, currentIndex) => (currentIndex === index ? !value : value)),
    }))
  }

  const toggleAction = (index) => {
    setActions((current) => current.map((value, currentIndex) => (currentIndex === index ? !value : value)))
  }

  const generateCommunication = () => {
    const nextText = buildEvidenceCommunication(toolType, formData)
    setCommunicationText(nextText)
    onStatus('已生成退租沟通说明')
  }

  const exportEvidencePackage = () => {
    const blob = new Blob([evidencePackageText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `租房安心审-退租证据包-${new Date().toISOString().slice(0, 10)}.txt`
    link.click()
    URL.revokeObjectURL(url)
    onStatus('退租证据包摘要已导出')
  }

  const copyCommunication = async () => {
    if (!communicationText) {
      onStatus('请先生成沟通说明')
      return
    }

    await copyTextToClipboard(communicationText)
    onStatus('沟通说明已复制')
  }

  const copyEvidencePackage = async () => {
    await copyTextToClipboard(evidencePackageText)
    onStatus('退租证据包摘要已复制')
  }

  const resetEvidencePack = () => {
    const nextState = createDefaultEvidencePackState()
    setFormData(nextState.formData)
    setEvidence(nextState.evidence)
    setActions(nextState.actions)
    setCommunicationText(nextState.communicationText)
    onStatus('退租证据包已重置')
  }

  const progressTone = evidenceStats.percent >= 80 ? 'safe' : evidenceStats.percent >= 50 ? 'warning' : 'danger'

  return (
    <div className="evidence-pack">
      <section className="evidence-hero work-panel">
        <div>
          <p className="section-kicker">Move-out Evidence Kit</p>
          <h2>退租证据包助手</h2>
          <p>把退租时最容易遗漏的合同、照片、聊天记录和费用凭证整理成可勾选、可导出的证据包。</p>
          <div className="evidence-hero-note">
            <span>自动保存</span>
            <strong>{evidenceAdvice.summary}</strong>
          </div>
        </div>
        <div className={`evidence-score ${progressTone}`}>
          <strong>{evidenceStats.percent}%</strong>
          <span>证据完整度</span>
          <em>{evidenceStats.checked}/{evidenceStats.total} 项已收集</em>
        </div>
      </section>

      <div className="evidence-tabs" role="tablist" aria-label="退租证据包功能">
        {[
          { key: 'info', label: '退租信息', Icon: ClipboardCheck },
          { key: 'checklist', label: '证据清单', Icon: FileDiff },
          { key: 'tool', label: '沟通生成器', Icon: MessageSquareText },
          { key: 'actions', label: '行动清单', Icon: BadgeCheck },
        ].map((item) => {
          const Icon = item.Icon
          return (
            <button
              className={`evidence-tab ${tab === item.key ? 'active' : ''}`}
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
            >
              <Icon size={16} aria-hidden="true" />
              {item.label}
            </button>
          )
        })}
      </div>

      {tab === 'info' && (
        <section className="work-panel evidence-section">
          <div className="panel-head">
            <div>
              <h2>退租信息录入</h2>
              <p>基础信息会用于生成沟通说明和证据包摘要。</p>
            </div>
            <div className="panel-actions">
              <button className="ghost-button compact-button" type="button" onClick={copyEvidencePackage}>
                <ClipboardCheck size={15} aria-hidden="true" />
                复制摘要
              </button>
              <button className="ghost-button compact-button" type="button" onClick={resetEvidencePack}>
                重置
              </button>
              <button className="primary-button compact-button" type="button" onClick={exportEvidencePackage}>
                <Download size={15} aria-hidden="true" />
                导出证据包
              </button>
            </div>
          </div>
          <div className="evidence-form-grid">
            {[
              { key: 'address', label: '房屋地址', placeholder: '如：阳光花园3栋2单元601室' },
              { key: 'deposit', label: '押金金额', placeholder: '如：3800' },
              { key: 'monthlyRent', label: '月租金', placeholder: '如：3800' },
              { key: 'landlordName', label: '房东/中介名称', placeholder: '如：恒业房产' },
              { key: 'landlordPhone', label: '联系电话', placeholder: '如：138xxxxxxxx' },
              { key: 'repairItem', label: '争议维修事项', placeholder: '如：空调不制冷、墙面扣款' },
              { key: 'repairCost', label: '维修/扣款金额', placeholder: '如：400' },
            ].map((field) => (
              <label className="field" key={field.key}>
                <span>{field.label}</span>
                <input value={formData[field.key]} onChange={(event) => updateField(field.key, event.target.value)} placeholder={field.placeholder} />
              </label>
            ))}
            <label className="field">
              <span>入住日期</span>
              <input type="date" value={formData.checkinDate} onChange={(event) => updateField('checkinDate', event.target.value)} />
            </label>
            <label className="field">
              <span>退租日期</span>
              <input type="date" value={formData.checkoutDate} onChange={(event) => updateField('checkoutDate', event.target.value)} />
            </label>
            <label className="field">
              <span>交接日期</span>
              <input type="date" value={formData.handoverDate} onChange={(event) => updateField('handoverDate', event.target.value)} />
            </label>
            <label className="field">
              <span>交接时间</span>
              <input type="time" value={formData.handoverTime} onChange={(event) => updateField('handoverTime', event.target.value)} />
            </label>
            <label className="field evidence-note-field">
              <span>备注事项</span>
              <textarea value={formData.notes} onChange={(event) => updateField('notes', event.target.value)} placeholder="如：房屋已完成基础清洁，钥匙和门禁卡齐全。" />
            </label>
          </div>
        </section>
      )}

      {tab === 'checklist' && (
        <section className="work-panel evidence-section">
          <div className="panel-head">
            <div>
              <h2>退租证据清单</h2>
              <p>逐项勾选已收集材料，完整度会实时更新。</p>
            </div>
            <span className="knowledge-count">{evidenceStats.checked}/{evidenceStats.total}</span>
          </div>
          <div className="evidence-progress">
            <div>
              <strong>证据完整度</strong>
              <span>{evidenceStats.percent}%</span>
            </div>
            <meter className={progressTone} min="0" max="100" value={evidenceStats.percent}>{evidenceStats.percent}</meter>
          </div>
          <div className="evidence-advice">
            <AlertTriangle size={17} aria-hidden="true" />
            <div>
              <strong>优先补齐：{evidenceAdvice.firstMissing}</strong>
              <p>{evidenceAdvice.summary}</p>
            </div>
          </div>
          <div className="evidence-group-grid">
            {Object.entries(evidenceGroupMeta).map(([group, meta]) => {
              const Icon = meta.Icon
              const checkedCount = evidence[group].filter(Boolean).length
              return (
                <article className="evidence-group-card" key={group}>
                  <div className="evidence-group-head">
                    <span>
                      <Icon size={17} aria-hidden="true" />
                      {meta.title}
                    </span>
                    <em>{checkedCount}/{meta.items.length}</em>
                  </div>
                  <div className="evidence-item-list">
                    {meta.items.map((item, index) => (
                      <label className={evidence[group][index] ? 'checked' : ''} key={item}>
                        <input checked={evidence[group][index]} type="checkbox" onChange={() => toggleEvidence(group, index)} />
                        <span>{item}</span>
                        <strong>{evidence[group][index] ? '已收集' : '待补齐'}</strong>
                      </label>
                    ))}
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {tab === 'tool' && (
        <section className="work-panel evidence-section">
          <div className="panel-head">
            <div>
              <h2>沟通说明生成器</h2>
              <p>生成押金退还、维修争议、退租交接三类可复制文本。</p>
            </div>
            <div className="panel-actions">
              <button className="ghost-button compact-button" type="button" onClick={copyCommunication}>
                <ClipboardCheck size={15} aria-hidden="true" />
                复制文本
              </button>
              <button className="primary-button compact-button" type="button" onClick={generateCommunication}>
                <Sparkles size={16} aria-hidden="true" />
                生成说明
              </button>
            </div>
          </div>
          <div className="evidence-tool-tabs">
            {evidenceToolTabs.map((item) => (
              <button
                className={toolType === item.value ? 'active' : ''}
                key={item.value}
                type="button"
                onClick={() => {
                  setToolType(item.value)
                  setCommunicationText('')
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="communication-preview">
            <pre>{communicationText || '点击“生成说明”后，这里会生成可复制的沟通文本。'}</pre>
          </div>
        </section>
      )}

      {tab === 'actions' && (
        <section className="work-panel evidence-section">
          <div className="panel-head">
            <div>
              <h2>下一步行动清单</h2>
              <p>按顺序完成这些动作，退租交接会更有证据链。</p>
            </div>
            <span className="knowledge-count">{actions.filter(Boolean).length}/{actions.length}</span>
          </div>
          <div className="evidence-action-list">
            {evidenceActions.map((item, index) => (
              <button className={actions[index] ? 'done' : ''} key={item.title} type="button" onClick={() => toggleAction(index)}>
                <span>{actions[index] ? <Check size={15} aria-hidden="true" /> : index + 1}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function App() {
  const [contractText, setContractText] = useState(sampleContract)
  const [activeTab, setActiveTab] = useState('review')
  const [showAiConfig, setShowAiConfig] = useState(false)
  const evidenceRef = useRef(null)
  const [acceptedIds, setAcceptedIds] = useState(() => new Set())
  const [reviewHistory, setReviewHistory] = useState(() => {
    const savedHistory = localStorage.getItem(STORAGE_KEYS.history) || localStorage.getItem(STORAGE_KEYS.historyLegacy)
    if (!savedHistory) return []

    try {
      return JSON.parse(savedHistory)
    } catch {
      return []
    }
  })
  const [statusMessage, setStatusMessage] = useState('')
  const [connectionStatus, setConnectionStatus] = useState('未连接')
  const [aiConfig, setAiConfig] = useState(() => {
    const savedConfig = localStorage.getItem(STORAGE_KEYS.aiConfig) || localStorage.getItem(STORAGE_KEYS.aiConfigLegacy)
    const defaultConfig = {
      provider: 'OpenAI-compatible',
      baseUrl: 'https://api.example.com/v1',
      model: 'gpt-4.1-mini',
      apiKey: '',
    }

    if (!savedConfig) return defaultConfig

    try {
      return { ...defaultConfig, ...JSON.parse(savedConfig) }
    } catch {
      return defaultConfig
    }
  })
  const [aiFindings, setAiFindings] = useState(null)
  const [aiQualityReport, setAiQualityReport] = useState(null)
  const [isReviewing, setIsReviewing] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [lastReviewSource, setLastReviewSource] = useState('local')
  const [reviewProfile, setReviewProfile] = useState({
    contractType: 'lease',
    partyRole: 'partyB',
    reviewDepth: 'strict',
  })
  const [depositInputs, setDepositInputs] = useState({
    depositAmount: '3800',
    unpaidFees: '0',
    repairCost: '0',
    cleaningCost: '400',
    hasVoucher: 'no',
    normalWear: 'yes',
  })
  const reviewText = useMemo(() => cleanContractTextForReview(contractText), [contractText])
  const effectiveReviewProfile = useMemo(
    () => resolveReviewProfile(reviewProfile, reviewText),
    [reviewProfile, reviewText],
  )
  const localFindings = useMemo(() => analyzeContract(reviewText, effectiveReviewProfile), [reviewText, effectiveReviewProfile])
  const findings = aiFindings || localFindings
  const summary = useMemo(() => getRiskSummary(findings), [findings])
  const dimensionScores = useMemo(() => getDimensionScores(findings), [findings])
  const revisionItems = useMemo(() => buildRevisionItems(acceptedIds, findings), [acceptedIds, findings])
  const revisedContractDraft = useMemo(() => createRevisedContractDraft(contractText, revisionItems), [contractText, revisionItems])
  const depositResult = useMemo(() => calculateDepositReturn(depositInputs), [depositInputs])
  const allFindingsAccepted = findings.length > 0 && findings.every((finding) => acceptedIds.has(finding.id))

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(reviewHistory))
  }, [reviewHistory])

  const updateAiConfig = (field, value) => {
    setAiConfig((current) => ({ ...current, [field]: value }))
    setConnectionStatus('待验证')
  }

  const updateReviewProfile = (field, value) => {
    setReviewProfile((current) => ({ ...current, [field]: value }))
    setAiFindings(null)
    setAiQualityReport(null)
    setAcceptedIds(new Set())
    setLastReviewSource('local')
    setReviewError('')
    setStatusMessage('已切换审查知识库，当前结果使用本地规则重新计算')
  }

  const updateDepositInput = (field, value) => {
    setDepositInputs((current) => ({ ...current, [field]: value }))
  }

  const callAiModel = async (messages, options = {}) => {
    const endpoint = buildChatCompletionsUrl(aiConfig.baseUrl)

    if (!endpoint) throw new Error('请先填写 Base URL')
    if (!aiConfig.model.trim()) throw new Error('请先填写模型名称')
    if (!aiConfig.apiKey.trim()) throw new Error('请先填写 API Key')

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${aiConfig.apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: aiConfig.model.trim(),
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 2200,
        messages,
      }),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      const message = data?.error?.message || data?.message || `接口请求失败：HTTP ${response.status}`
      throw new Error(message)
    }

    return data
  }

  const testAiConnection = async () => {
    setConnectionStatus('连接中')
    setReviewError('')

    try {
      await callAiModel(
        [
          { role: 'system', content: '你是接口连通性测试助手。' },
          { role: 'user', content: '请只回复 OK。' },
        ],
        { maxTokens: 8, temperature: 0 },
      )
      setConnectionStatus('连接成功')
      setStatusMessage('AI 接口连接成功')
    } catch (error) {
      setConnectionStatus('连接失败')
      setReviewError(error.message)
      setStatusMessage('AI 接口连接失败，已保留本地规则兜底')
    }
  }

  const saveAiConfig = () => {
    localStorage.setItem(STORAGE_KEYS.aiConfig, JSON.stringify(aiConfig))
    setConnectionStatus(connectionStatus === '连接成功' ? '连接成功' : '接口入口已保存')
    setStatusMessage('AI 接入配置已保存到本地浏览器')
  }

  const startReview = async () => {
    const trimmedText = reviewText.trim()
    setAcceptedIds(new Set())
    setReviewError('')

    if (!trimmedText) {
      setAiFindings(null)
      setAiQualityReport(null)
      setLastReviewSource('local')
      setStatusMessage('请先粘贴合同正文')
      return
    }

    if (!aiConfig.apiKey.trim()) {
      setAiFindings(null)
      setAiQualityReport(null)
      setLastReviewSource('local')
      setStatusMessage('未配置 API Key，已使用本地规则审查')
      return
    }

    setIsReviewing(true)
    setStatusMessage('正在调用 AI 大模型审查合同')

    try {
      const data = await callAiModel([
        {
          role: 'system',
          content:
            '你是严谨的租房合同解读助手，擅长识别押金、涨租、维修、入户、解除、违约金和管辖风险。必须只返回合法 JSON，且证据必须来自原文。',
        },
        { role: 'user', content: createAiReviewPrompt(trimmedText, effectiveReviewProfile) },
      ])
      const parsed = parseAiContent(extractAssistantContent(data))
      const nextFindings = normalizeAiFindings(parsed, trimmedText)
      const qualityReport = buildAiQualityReport(parsed, trimmedText, nextFindings)

      setAiFindings(nextFindings)
      setAiQualityReport(qualityReport)
      setLastReviewSource('ai')
      setConnectionStatus('连接成功')
      setStatusMessage(
        qualityReport.rejectedCount
          ? `AI 审查完成，保留 ${nextFindings.length} 条，过滤 ${qualityReport.rejectedCount} 条无证据风险`
          : nextFindings.length
            ? `AI 审查完成，发现 ${nextFindings.length} 个风险点`
            : 'AI 审查完成，未发现明显风险',
      )
    } catch (error) {
      setAiFindings(null)
      setAiQualityReport(null)
      setLastReviewSource('local')
      setReviewError(error.message)
      setStatusMessage('AI 审查失败，已自动切换为本地规则结果')
    } finally {
      setIsReviewing(false)
    }
  }

  const resetContractText = (nextText) => {
    setContractText(nextText)
    setAcceptedIds(new Set())
    setAiFindings(null)
    setAiQualityReport(null)
    setReviewError('')
    setLastReviewSource('local')
    setStatusMessage('已重置合同版本和采纳状态')
  }

  const saveHistorySnapshot = () => {
    const snapshot = {
      id: Date.now(),
      title: `审查记录 ${new Date().toLocaleTimeString()}`,
      score: summary.score,
      highCount: summary.highCount,
      mediumCount: summary.mediumCount,
      acceptedCount: acceptedIds.size,
      contractText,
    }

    setReviewHistory((current) => [snapshot, ...current].slice(0, 5))
    setStatusMessage('已保存到本地审查历史')
  }

  const restoreHistorySnapshot = (snapshot) => {
    setContractText(snapshot.contractText)
    setAcceptedIds(new Set())
    setAiFindings(null)
    setAiQualityReport(null)
    setReviewError('')
    setLastReviewSource('local')
    setStatusMessage(`已恢复 ${snapshot.title}`)
  }

  const exportReport = () => {
    const report = createReportText({ summary, findings, revisionItems, contractText: reviewText, reviewProfile: effectiveReviewProfile })
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `租房安心审-解读报告-${new Date().toISOString().slice(0, 10)}.txt`
    link.click()
    URL.revokeObjectURL(url)
    saveHistorySnapshot()
    setStatusMessage('租房解读报告已导出')
  }

  const exportRevisedDraft = () => {
    const blob = new Blob([revisedContractDraft], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `租房安心审-修订版合同草案-${new Date().toISOString().slice(0, 10)}.txt`
    link.click()
    URL.revokeObjectURL(url)
    setStatusMessage('修订版合同草案已导出')
  }

  const applySuggestion = (finding) => {
    if (acceptedIds.has(finding.id)) return

    setContractText((currentText) => {
      if (finding.replaceFrom && currentText.includes(finding.replaceFrom)) {
        return currentText.replace(finding.replaceFrom, finding.replacement)
      }

      return `${currentText}\n\n【${finding.title}修改建议】\n${finding.replacement}`
    })
    setAcceptedIds((current) => new Set(current).add(finding.id))
    setStatusMessage(`已采纳：${finding.title}`)
  }

  const applyAllSuggestions = () => {
    if (!findings.length || allFindingsAccepted) return

    findings.forEach((finding) => {
      setContractText((currentText) => {
        if (finding.replaceFrom && currentText.includes(finding.replaceFrom)) {
          return currentText.replace(finding.replaceFrom, finding.replacement)
        }

        if (currentText.includes(`【${finding.title}修改建议】`)) {
          return currentText
        }

        return `${currentText}\n\n【${finding.title}修改建议】\n${finding.replacement}`
      })
    })

    setAcceptedIds(new Set(findings.map((finding) => finding.id)))
    setStatusMessage('已采纳全部风险修改建议')
  }

  const handleSourceAction = () => {
    if (lastReviewSource === 'ai') {
      evidenceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setStatusMessage('已定位到 AI 结果对应的原文证据')
      return
    }

    setShowAiConfig(true)
    setStatusMessage('已打开 AI 接口配置入口')
  }

  const topbarCopy = {
    review: {
      kicker: 'Rental Contract Copilot',
      title: '租房签字前，先让 AI 帮你看一遍',
      subtitle: '聚焦押金、涨租、维修、入户、管辖和违约金，把租房合同里的坑讲成大白话。',
    },
    evidence: {
      kicker: 'Move-out Evidence Kit',
      title: '退租前，把证据包整理好',
      subtitle: '把合同、照片、沟通记录和费用凭证整理成可导出的证据摘要，减少押金争议中的材料遗漏。',
    },
    proposal: {
      kicker: 'Creative Proposal',
      title: '租房安心审参赛提案',
      subtitle: '展示签约前审合同、退租时整理证据、押金计算和 AI 质量自检的租房全周期方案。',
    },
  }[activeTab]

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="租房安心审导航">
        <div className="brand">
          <div className="brand-mark">
            <ShieldCheck size={26} aria-hidden="true" />
          </div>
          <div>
            <strong>租房安心审</strong>
            <span>AI 租房合同解读器</span>
          </div>
        </div>

        <nav className="nav-list">
          <button className={activeTab === 'review' ? 'active' : ''} type="button" onClick={() => setActiveTab('review')}>
            <FileText size={18} aria-hidden="true" />
            租房审查
          </button>
          <button className={activeTab === 'evidence' ? 'active' : ''} type="button" onClick={() => setActiveTab('evidence')}>
            <ClipboardCheck size={18} aria-hidden="true" />
            退租证据包
          </button>
          <button className={activeTab === 'proposal' ? 'active' : ''} type="button" onClick={() => setActiveTab('proposal')}>
            <BookOpenCheck size={18} aria-hidden="true" />
            创意提案
          </button>
        </nav>

        <div className="sidebar-panel">
          <span className="panel-label">定位</span>
          <h2>社会服务赛道</h2>
          <p>帮租客在签字前看懂押金、涨租、维修和违约条款里的坑。</p>
        </div>
      </aside>

      <div className="announcement-strip">
        <span>● 100% 本地演示</span>
        <strong>押金扣款、单方涨租、维修转嫁、换锁收房等风险实时识别</strong>
        <span>查看避坑流程 →</span>
      </div>

      <section className="workspace">
        <header className="topbar">
          <div className="hero-copy">
            <p className="section-kicker">{topbarCopy.kicker}</p>
            <h1>{topbarCopy.title}</h1>
            <p className="hero-subtitle">{topbarCopy.subtitle}</p>
          </div>
          <div className="topbar-actions">
            {activeTab === 'review' ? (
              <>
                <button className="ghost-button" type="button" onClick={() => setShowAiConfig(true)}>
                  <Settings size={17} aria-hidden="true" />
                  AI 接入
                </button>
                <button className="ghost-button" type="button" onClick={() => resetContractText(sampleContract)}>
                  <RefreshCw size={17} aria-hidden="true" />
                  示例租房合同
                </button>
                <button className="primary-button" type="button" onClick={exportReport}>
                  <Download size={17} aria-hidden="true" />
                  导出报告
                </button>
              </>
            ) : (
              <>
                <button className="ghost-button" type="button" onClick={() => setActiveTab('review')}>
                  <FileText size={17} aria-hidden="true" />
                  返回审查
                </button>
                <button className="primary-button" type="button" onClick={() => setActiveTab('evidence')}>
                  <ClipboardCheck size={17} aria-hidden="true" />
                  退租证据包
                </button>
              </>
            )}
          </div>
        </header>

        {statusMessage && <div className="status-toast">{statusMessage}</div>}

        <div className="mobile-read-notice">
          <strong>移动端查看模式</strong>
          <span>租房合同解读属于重阅读场景，建议在电脑端完成修改与导出，手机端更适合查看结论。</span>
        </div>

        {showAiConfig && (
          <section className="ai-config-panel" aria-label="AI 大模型接口配置">
            <div className="ai-config-header">
              <div className="ai-config-title">
                <span className="ai-config-icon">
                  <PlugZap size={20} aria-hidden="true" />
                </span>
                <div>
                  <h2>AI 大模型接口</h2>
                  <p>配置 OpenAI 兼容接口、模型名称和调用入口，后续可接入真实审查服务。</p>
                </div>
              </div>
              <div className="ai-config-status">
                <span className="model-status">
                  <PlugZap size={16} aria-hidden="true" />
                  {connectionStatus}
                </span>
                <button className="ghost-button compact-button" type="button" onClick={() => setShowAiConfig(false)}>
                  关闭
                </button>
              </div>
            </div>
            <div className="config-grid">
              <label className="field">
                <span>服务商</span>
                <select value={aiConfig.provider} onChange={(event) => updateAiConfig('provider', event.target.value)}>
                  {modelProviders.map((provider) => (
                    <option key={provider}>{provider}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Base URL</span>
                <input
                  value={aiConfig.baseUrl}
                  onChange={(event) => updateAiConfig('baseUrl', event.target.value)}
                  placeholder="https://api.example.com/v1"
                />
              </label>
              <label className="field">
                <span>模型</span>
                <input
                  value={aiConfig.model}
                  onChange={(event) => updateAiConfig('model', event.target.value)}
                  placeholder="model-name"
                />
              </label>
              <label className="field">
                <span>API Key</span>
                <input
                  type="password"
                  value={aiConfig.apiKey}
                  onChange={(event) => updateAiConfig('apiKey', event.target.value)}
                  placeholder="仅保存在本地浏览器"
                />
              </label>
            </div>
            <div className="security-callout">
              <EyeOff size={17} aria-hidden="true" />
              <span>演示阶段可从前端直连接口。生产环境应通过后端代理保存密钥，前端只保留连接状态和模型选择。</span>
            </div>
            <div className="config-actions">
              <button className="ghost-button" type="button" onClick={testAiConnection} disabled={connectionStatus === '连接中'}>
                {connectionStatus === '连接中' ? '连接中...' : '测试连接'}
              </button>
              <button className="primary-button" type="button" onClick={saveAiConfig}>
                <KeyRound size={17} aria-hidden="true" />
                保存接入配置
              </button>
            </div>
          </section>
        )}

        {activeTab === 'evidence' ? (
          <EvidencePack onStatus={setStatusMessage} />
        ) : activeTab === 'review' ? (
          <div className="review-layout">
            <section className="work-panel input-panel">
              <div className="panel-head">
                <div>
                  <h2>租房合同输入</h2>
                  <p>粘贴租房合同或载入示例合同，系统会优先按租客视角严格审查。</p>
                </div>
                <span>{contractText.length} 字</span>
              </div>

              <label className="upload-drop">
                <UploadCloud size={24} aria-hidden="true" />
                <strong>拖入 PDF / Word / 图片租房合同</strong>
                <span>当前 Demo 聚焦文本审查，拍照识别和 OCR 已作为后续入口预留</span>
                <input aria-label="上传合同" type="file" />
              </label>

              <div className="review-profile" aria-label="租房合同审查画像">
                <label>
                  <span>合同类型</span>
                  <select value={reviewProfile.contractType} onChange={(event) => updateReviewProfile('contractType', event.target.value)}>
                    {contractTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>我方身份</span>
                  <select value={reviewProfile.partyRole} onChange={(event) => updateReviewProfile('partyRole', event.target.value)}>
                    {partyRoleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>审查强度</span>
                  <select value={reviewProfile.reviewDepth} onChange={(event) => updateReviewProfile('reviewDepth', event.target.value)}>
                    {reviewDepthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="detected-type">
                <span>当前知识库</span>
                <strong>{getContractTypeLabel(effectiveReviewProfile.contractType)}</strong>
                {reviewProfile.contractType === 'auto' && <em>自动识别</em>}
              </div>

              <textarea
                value={contractText}
                onChange={(event) => resetContractText(event.target.value)}
                placeholder="在这里粘贴租房合同正文，系统会自动识别押金、涨租、维修、解除等风险条款..."
              />

              <div className="input-actions">
                <button className="ghost-button" type="button" onClick={() => resetContractText('')}>
                  清空
                </button>
                <button className="primary-button" type="button" onClick={startReview} disabled={isReviewing}>
                  {isReviewing ? <RefreshCw className="spin-icon" size={17} aria-hidden="true" /> : <Bot size={17} aria-hidden="true" />}
                  {isReviewing ? '审查中...' : '开始审查'}
                </button>
              </div>

              <div className="review-scope" aria-label="审查范围">
                <div className="scope-chip">
                  <ClipboardCheck size={17} aria-hidden="true" />
                  <div>
                    <strong>租房条款筛选</strong>
                    <span>押金、涨租、维修</span>
                  </div>
                </div>
                <div className="scope-chip">
                  <Scale size={17} aria-hidden="true" />
                  <div>
                    <strong>风险定级</strong>
                    <span>高、中、低风险</span>
                  </div>
                </div>
                <div className="scope-chip">
                  <FileText size={17} aria-hidden="true" />
                  <div>
                    <strong>谈判输出</strong>
                    <span>替代条款和话术</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="work-panel summary-panel">
              <div className="analysis-float" aria-label="审查进度提示">
                <span className="float-icon">
                  <Bot size={16} aria-hidden="true" />
                </span>
                <div>
                  <strong>{isReviewing ? 'AI 正在解读' : '租房审查管家'}</strong>
                  <p>
                    {isReviewing
                      ? '正在提取押金、涨租、维修和违约责任风险。'
                      : lastReviewSource === 'ai'
                        ? '当前结果来自真实大模型接口。'
                        : '当前结果来自本地规则兜底。'}
                  </p>
                </div>
                <button className="source-action" type="button" onClick={handleSourceAction}>
                  {lastReviewSource === 'ai' ? '查看证据' : '接入 AI'}
                </button>
              </div>

              {reviewError && (
                <div className="review-error" role="status">
                  <AlertTriangle size={16} aria-hidden="true" />
                  <span>{reviewError}</span>
                </div>
              )}

              {aiQualityReport && (
                <div className={`quality-panel ${aiQualityReport.tone}`} role="status">
                  <div>
                    <strong>AI 质量自检</strong>
                    <span>
                      返回 {aiQualityReport.rawCount} 条，证据命中 {aiQualityReport.verifiedRawCount} 条，保留 {aiQualityReport.acceptedCount} 条，过滤 {aiQualityReport.rejectedCount} 条
                    </span>
                  </div>
                  {aiQualityReport.typeMismatch && (
                    <p>模型疑似识别成“{aiQualityReport.contractType}”，已按租房合同证据规则拦截。</p>
                  )}
                </div>
              )}

              <div className={`summary-card ${summary.tone}`}>
                <div>
                  <p className="eyebrow">租房风险评分</p>
                  <div className="score-line">
                    <strong>{summary.score}</strong>
                    <span>/ 100</span>
                  </div>
                  <h2>{summary.label}</h2>
                  <p>{summary.advice}</p>
                </div>
                <div className="score-ring" style={{ '--score': `${summary.score * 3.6}deg` }} aria-label={`风险分 ${summary.score}`}>
                  <ShieldCheck size={34} aria-hidden="true" />
                </div>
              </div>

              <div className="metric-row">
                <div>
                  <strong>{findings.length}</strong>
                      <span>租房坑点</span>
                </div>
                <div>
                  <strong>{summary.highCount}</strong>
                  <span>高风险</span>
                </div>
                <div>
                  <strong>{summary.mediumCount}</strong>
                  <span>中风险</span>
                </div>
                <div>
                  <strong>{acceptedIds.size}</strong>
                  <span>已采纳</span>
                </div>
              </div>

              <div className="dimension-panel" aria-label="分项风险评分">
                {dimensionScores.map((item) => (
                  <div className="dimension-item" key={item.dimension}>
                    <div>
                      <span>{item.dimension}</span>
                      <strong>{item.score}</strong>
                    </div>
                    <meter className={item.tone} min="0" max="100" value={item.score}>
                      {item.score}
                    </meter>
                  </div>
                ))}
              </div>

              <div className="knowledge-panel" aria-label="租房安心知识库">
                <div className="panel-head compact">
                  <div>
                    <h2>租房安心知识库</h2>
                    <p>本地规则与 AI Prompt 会共同引用这些租房审查依据。</p>
                  </div>
                  <span className="knowledge-count">{knowledgeBaseItems.length} 组</span>
                </div>
                <div className="knowledge-grid">
                  {knowledgeBaseItems.map((item) => (
                    <article className="knowledge-item" key={item.title}>
                      <span>{item.tag}</span>
                      <strong>{item.title}</strong>
                      <p>{item.text}</p>
                    </article>
                  ))}
                </div>
              </div>

              <div className="evidence-card" ref={evidenceRef}>
                <div className="panel-head compact">
                  <div>
                    <h2>证据高亮</h2>
                    <p>被标记的文本是风险判断依据。</p>
                  </div>
                </div>
                <HighlightedContract text={contractText || '暂无合同正文'} findings={findings} />
              </div>

              <div className="diff-card">
                <div className="panel-head compact">
                  <div>
                    <h2>修改对比</h2>
                    <p>展示已采纳建议对应的原风险和替换条款。</p>
                  </div>
                  {revisionItems.length > 0 && (
                    <button className="ghost-button compact-button" type="button" onClick={exportRevisedDraft}>
                      导出草案
                    </button>
                  )}
                </div>
                {revisionItems.length ? (
                  <>
                    <div className="diff-list">
                      {revisionItems.map((item) => (
                        <article className="diff-item" key={item.id}>
                          <span>{item.priority}</span>
                          <div>
                            <strong>{item.title}</strong>
                            <p className="diff-before">{item.evidence}</p>
                            <p className="diff-after">{item.replacement}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                    <div className="draft-preview">
                      <div>
                        <strong>修订版合同草案</strong>
                        <span>{revisionItems.length} 项已并入草案</span>
                      </div>
                      <pre>{revisedContractDraft}</pre>
                    </div>
                  </>
                ) : (
                  <p className="empty-note">采纳建议后，这里会显示修改前后的对比。</p>
                )}
              </div>

              <div className="history-card">
                <div className="panel-head compact">
                  <div>
                    <h2>审查历史</h2>
                    <p>本地保留最近 5 次审查，便于回溯和演示。</p>
                  </div>
                  <button className="ghost-button compact-button" type="button" onClick={saveHistorySnapshot}>
                    保存当前
                  </button>
                </div>
                {reviewHistory.length ? (
                  <div className="history-list">
                    {reviewHistory.map((item) => (
                      <button type="button" key={item.id} onClick={() => restoreHistorySnapshot(item)}>
                        <strong>{item.title}</strong>
                        <span>{item.score} 分 · 高风险 {item.highCount} · 已采纳 {item.acceptedCount}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="empty-note">暂无历史记录，导出报告或点击保存当前后会自动出现。</p>
                )}
              </div>
            </section>

            <section className="work-panel findings-panel">
              <div className="panel-head">
                <div>
                  <h2>租房风险解释与话术</h2>
                  <p>每个坑点都附带原文证据、大白话解释、替代条款和谈判话术。</p>
                </div>
                <div className="panel-actions">
                  <button className="apply-all-button" type="button" onClick={applyAllSuggestions} disabled={!findings.length || allFindingsAccepted}>
                    <BadgeCheck size={17} aria-hidden="true" />
                    {allFindingsAccepted ? '已全部采纳' : '全部采纳'}
                  </button>
                </div>
              </div>

              <div className="finding-list">
                {findings.length ? (
                  findings.map((finding) => (
                    <FindingItem
                      accepted={acceptedIds.has(finding.id)}
                      finding={finding}
                      key={finding.id}
                      onApply={applySuggestion}
                    />
                  ))
                ) : (
                  <p className="empty-note empty-findings">暂无风险点。建议仍由人工复核关键金额、期限、解除和争议解决条款。</p>
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="proposal-layout">
            <section className="proposal-card proposal-hero">
              <div>
                <p className="section-kicker">Creative Proposal</p>
                <h2>租房安心审：AI 租房合同解读器</h2>
                <p>
                  面向社会服务赛道，帮助毕业生、老人和普通租客在签字前识别押金、涨租、维修和违约金陷阱。
                </p>
              </div>
              <div className="hero-visual" aria-hidden="true">
                <div className="doc-card">
                  <AlertTriangle size={20} />
                  <span>押金扣款过宽</span>
                </div>
                <div className="doc-card safe">
                  <ShieldCheck size={20} />
                  <span>已生成谈判话术</span>
                </div>
              </div>
            </section>

            <section className="feature-grid">
              {featureCards.map((card) => {
                const Icon = card.icon
                return (
                  <article className="feature-card" key={card.title}>
                    <Icon size={24} aria-hidden="true" />
                    <h3>{card.title}</h3>
                    <p>{card.text}</p>
                  </article>
                )
              })}
            </section>

            <section className="timeline-card">
              <div className="panel-head">
                <div>
                  <h2>技术方案</h2>
                  <p>从租房合同解析到避坑报告生成，优先保证证据真实、解释可懂、建议可谈。</p>
                </div>
              </div>
              <div className="timeline">
                {['上传租房合同', '识别租赁类型', '命中租房坑点', '证据校验', '生成避坑报告'].map((item, index) => (
                  <div className="timeline-step" key={item}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    {item}
                    {index < 4 && <ArrowRight size={15} aria-hidden="true" />}
                  </div>
                ))}
              </div>
            </section>

            <section className="timeline-card">
              <div className="panel-head">
                <div>
                  <h2>继续完善方向</h2>
                  <p>如果要把这个 Demo 推成租房服务产品，优先补这些能力。</p>
                </div>
              </div>
              <div className="deposit-prototype" aria-label="押金计算器">
                <div>
                  <span>押金计算器</span>
                  <strong>预计应退押金：{formatMoney(depositResult.estimatedReturn)}</strong>
                  <p>{depositResult.warning}</p>
                  <em>预计可扣：{formatMoney(depositResult.totalDeduction)}</em>
                </div>
                <div className="deposit-grid">
                  <label>
                    <span>押金金额</span>
                    <input
                      inputMode="decimal"
                      value={depositInputs.depositAmount}
                      onChange={(event) => updateDepositInput('depositAmount', event.target.value)}
                    />
                  </label>
                  <label>
                    <span>未结清费用</span>
                    <input
                      inputMode="decimal"
                      value={depositInputs.unpaidFees}
                      onChange={(event) => updateDepositInput('unpaidFees', event.target.value)}
                    />
                  </label>
                  <label>
                    <span>维修扣款</span>
                    <input
                      inputMode="decimal"
                      value={depositInputs.repairCost}
                      onChange={(event) => updateDepositInput('repairCost', event.target.value)}
                    />
                  </label>
                  <label>
                    <span>保洁扣款</span>
                    <input
                      inputMode="decimal"
                      value={depositInputs.cleaningCost}
                      onChange={(event) => updateDepositInput('cleaningCost', event.target.value)}
                    />
                  </label>
                  <label>
                    <span>是否有票据</span>
                    <select value={depositInputs.hasVoucher} onChange={(event) => updateDepositInput('hasVoucher', event.target.value)}>
                      <option value="no">无票据或清单</option>
                      <option value="yes">有照片、清单和票据</option>
                    </select>
                  </label>
                  <label>
                    <span>是否正常损耗</span>
                    <select value={depositInputs.normalWear} onChange={(event) => updateDepositInput('normalWear', event.target.value)}>
                      <option value="yes">是，仅正常使用损耗</option>
                      <option value="no">否，存在非正常损坏</option>
                    </select>
                  </label>
                </div>
              </div>
              <div className="backlog-list">
                {productBacklog.map((item) => (
                  <div className="backlog-item" key={item}>
                    <Check size={16} aria-hidden="true" />
                    {item}
                  </div>
                ))}
              </div>
              <a className="trae-link-button" href="https://www.trae.cn/community" target="_blank" rel="noreferrer">
                前往 TRAE 社区报名参赛
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </section>
          </div>
        )}
      </section>
    </main>
  )
}

export default App
