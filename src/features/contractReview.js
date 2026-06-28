import { AlertTriangle, CircleDollarSign, ClipboardCheck, Fingerprint, Gavel, LockKeyhole, Scale } from 'lucide-react'
import { LEGAL_DISCLAIMER } from '../constants/legal.js'
import { contractTypeOptions, partyRoleOptions, reviewDepthOptions } from '../constants/reviewOptions.js'
import { knowledgeBaseItems } from '../data/knowledgeBase.js'

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
const RISK_SCORE_SCALE = 0.62
const RISK_SCORE_DISPLAY_CAP = 88

function softenRiskScore(rawScore, maxScore = RISK_SCORE_DISPLAY_CAP) {
  const numericScore = Number(rawScore)
  if (!Number.isFinite(numericScore) || numericScore <= 0) return 0

  return Math.min(maxScore, Math.round(numericScore * RISK_SCORE_SCALE))
}


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

function extractClauseAroundKeyword(text, keywords) {
  const source = String(text ?? '')
  const matchedKeywords = keywords.filter((term) => source.includes(term))
  const keyword = matchedKeywords[0]

  if (!keyword) return ''

  const indexes = matchedKeywords.map((term) => source.indexOf(term)).filter((index) => index >= 0)
  const index = Math.min(...indexes)
  const lastIndex = Math.max(...matchedKeywords.map((term) => source.indexOf(term) + term.length))
  const boundaryPattern = /[。！？；\n]/g
  let start = 0
  let end = source.length
  let match = boundaryPattern.exec(source)

  while (match && match.index < index) {
    start = match.index + 1
    match = boundaryPattern.exec(source)
  }

  if (match && match.index >= lastIndex) {
    end = match.index + 1
  } else {
    while (match && match.index < lastIndex) {
      match = boundaryPattern.exec(source)
    }
    if (match) {
      end = match.index + 1
    }
  }

  const clause = source.slice(start, end).trim()

  if (!clause) return ''
  if (clause.length <= 500) return clause

  const snippet = extractEvidenceSnippet(source, [keyword]).replace(/^\.\.\./, '').replace(/\.\.\.$/, '').trim()
  return snippet
}

export function cleanContractTextForReview(text) {
  return String(text ?? '')
    .replace(/\n*【[^】]+修改建议】[\s\S]*?(?=\n\n【[^】]+修改建议】|$)/g, '')
    .replace(/\n*【补充修订条款】[\s\S]*$/g, '')
    .replace(/\n*补充修订条款[\s\S]*$/g, '')
    .trim()
}

function normalizeForLooseMatch(value) {
  return String(value ?? '').replace(/\s+/g, '')
}

function findLooseTextRange(text, needle) {
  const source = String(text ?? '')
  const target = normalizeForLooseMatch(needle)
  if (!source || !target) return null

  let normalizedIndex = 0
  const indexMap = []

  for (let index = 0; index < source.length; index += 1) {
    if (/\s/.test(source[index])) continue
    indexMap[normalizedIndex] = index
    normalizedIndex += 1
  }

  const compactSource = normalizeForLooseMatch(source)
  const compactStart = compactSource.indexOf(target)
  if (compactStart < 0) return null

  const start = indexMap[compactStart]
  const end = indexMap[compactStart + target.length - 1] + 1
  return Number.isFinite(start) && Number.isFinite(end) ? { start, end } : null
}

function appendRevisionClause(text, item) {
  const draft = String(text ?? '').trim()
  const title = item.title || '补充修订建议'
  const replacement = item.replacement || item.suggestion || '建议结合合同原文补充更明确、对等、可执行的条款。'
  const hasSection = draft.includes('【补充修订条款】')
  const block = hasSection ? `\n${title}：${replacement}` : `\n\n【补充修订条款】\n${title}：${replacement}`

  if (draft.includes(`${title}：${replacement}`)) return draft
  return `${draft}${block}`
}

export function applyRevisionItem(text, item, options = {}) {
  const draft = String(text ?? '')
  const rawCandidates = [item.replaceFrom, item.evidence].filter(Boolean)
  const meaningfulCandidates = rawCandidates.filter((candidate) => normalizeForLooseMatch(candidate).length >= 12)

  if (item.replacement && draft.includes(item.replacement)) {
    return { text: draft, mode: 'unchanged' }
  }

  for (const candidate of meaningfulCandidates) {
    if (draft.includes(candidate)) {
      return { text: draft.replace(candidate, item.replacement), mode: 'exact' }
    }
  }

  for (const candidate of meaningfulCandidates) {
    const range = findLooseTextRange(draft, candidate)
    if (range) {
      return {
        text: `${draft.slice(0, range.start)}${item.replacement}${draft.slice(range.end)}`,
        mode: 'loose',
      }
    }
  }

  const currentClause = Array.isArray(item.hits) ? extractClauseAroundKeyword(draft, item.hits) : ''
  if (currentClause && !rawCandidates.includes(currentClause)) {
    if (draft.includes(currentClause)) {
      return { text: draft.replace(currentClause, item.replacement), mode: 'clause' }
    }

    const range = findLooseTextRange(draft, currentClause)
    if (range) {
      return {
        text: `${draft.slice(0, range.start)}${item.replacement}${draft.slice(range.end)}`,
        mode: 'clause',
      }
    }
  }

  for (const candidate of rawCandidates) {
    if (draft.includes(candidate)) {
      return { text: draft.replace(candidate, item.replacement), mode: 'exact' }
    }
  }

  if (options.appendIfMissing) {
    const appendedText = appendRevisionClause(draft, item)
    return { text: appendedText, mode: appendedText === draft ? 'unchanged' : 'appended' }
  }

  return { text: draft, mode: 'unchanged' }
}

function applyRevisionItemToText(text, item, options = {}) {
  return applyRevisionItem(text, item, options).text
}

export function mergeRevisionItems(current, items) {
  const next = [...current]
  const knownIds = new Set(next.map((item) => item.id))

  items.forEach((item) => {
    if (!item?.id || knownIds.has(item.id)) return
    next.push(item)
    knownIds.add(item.id)
  })

  return next
}

function normalizeComparableText(value) {
  return cleanContractTextForReview(value)
    .replace(/^\.\.\./, '')
    .replace(/\.\.\.$/, '')
    .replace(/\s+/g, '')
}

function findingsOverlap(first, second) {
  if (!first || !second) return false
  if (first.id && first.id === second.id) return true

  const firstEvidence = normalizeComparableText(first.replaceFrom || first.evidence)
  const secondEvidence = normalizeComparableText(second.replaceFrom || second.evidence)

  if (
    firstEvidence.length >= 16
    && secondEvidence.length >= 16
    && (firstEvidence.includes(secondEvidence) || secondEvidence.includes(firstEvidence))
  ) {
    return true
  }

  const firstHits = new Set(Array.isArray(first.hits) ? first.hits : [])
  const secondHits = Array.isArray(second.hits) ? second.hits : []
  const sharedHits = secondHits.filter((hit) => firstHits.has(hit))

  return sharedHits.length >= 2 && first.dimension === second.dimension
}

export function mergeFindings(baseFindings, extraFindings) {
  const merged = [...baseFindings]

  extraFindings.forEach((finding) => {
    if (!merged.some((existing) => findingsOverlap(existing, finding))) {
      merged.push(finding)
    }
  })

  return merged
}

export function detectContractType(text) {
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

export function resolveReviewProfile(profile, text) {
  const detectedContractType = detectContractType(text)

  return {
    ...profile,
    detectedContractType,
    contractType: profile.contractType === 'auto' ? detectedContractType : profile.contractType,
  }
}

export function getContractTypeLabel(value) {
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
  minHits,
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
    minHits,
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
  replaceFrom,
  minHits,
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
    replaceFrom,
    minHits,
  })
}

function getLeaseFindings(text) {
  const findings = []
  const add = (finding) => {
    const hits = finding.keywords.filter((keyword) => text.includes(keyword))
    const minHits = finding.minHits || 1

    if (hits.length < minHits) return

    const hasExactEvidence = text.includes(finding.evidence)
    const fallbackClause = hasExactEvidence ? '' : extractClauseAroundKeyword(text, hits)
    findings.push({
      ...finding,
      evidence: hasExactEvidence ? finding.evidence : fallbackClause || extractEvidenceSnippet(text, hits),
      hits,
      replaceFrom: hasExactEvidence ? finding.replaceFrom : fallbackClause,
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
    minHits: 2,
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
    id: 'lease-cleaning-repair-no-voucher',
    title: '保洁维修扣款缺少凭证边界',
    level: 'medium',
    score: 11,
    dimension: '费用',
    priority: 'P1',
    keywords: ['保洁费', '维修费', '从押金中扣除'],
    minHits: 2,
    evidence: '退还时甲方可扣除以下费用：房屋及设施维修费、全屋保洁费（不低于400元）、墙面修补粉刷费、家具家电折旧补偿、以及甲方认定的其他合理扣款。',
    explain: '保洁、维修、粉刷等费用如果没有照片、清单、票据和责任归属，退租时容易变成固定扣款。',
    suggestion: '建议写明扣款必须基于实际损坏或未结费用，并提供照片、明细和有效票据。',
    negotiation: '可以承担自己造成的损坏，但不接受无明细、无票据或固定金额扣押金。',
    replacement: '甲方主张保洁、维修、粉刷等费用扣款的，应提供交接照片、费用明细、维修或保洁票据，并说明该费用系乙方原因造成且实际发生；无法提供有效凭证的，不得从押金中扣除。',
  }))

  add(makeLeaseFinding({
    id: 'lease-appliance-depreciation-deduction',
    title: '家具家电折旧转嫁给租客',
    level: 'medium',
    score: 10,
    dimension: '押金',
    priority: 'P1',
    keywords: ['家具家电折旧补偿', '押金', '扣除'],
    minHits: 2,
    evidence: '退还时甲方可扣除以下费用：房屋及设施维修费、全屋保洁费（不低于400元）、墙面修补粉刷费、家具家电折旧补偿、以及甲方认定的其他合理扣款。',
    explain: '家具家电正常折旧属于租赁使用中的自然损耗，不应当然由承租人从押金中补偿。',
    suggestion: '建议区分自然折旧和人为损坏，只有承租人原因造成的实际损坏才可扣款。',
    negotiation: '退租时先按入住验房照片和设备清单核对，正常老化不应算承租人责任。',
    replacement: '家具家电因正常使用产生的自然折旧不作为扣款依据；因乙方不当使用造成损坏的，乙方按维修实际支出承担责任，甲方应提供照片、维修清单和票据。',
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
    id: 'lease-pet-forfeiture-no-cure',
    title: '宠物违约直接没收押金',
    level: 'medium',
    score: 11,
    dimension: '违约责任',
    priority: 'P1',
    keywords: ['不得饲养宠物', '立即解除合同', '没收押金'],
    minHits: 2,
    evidence: '乙方不得饲养宠物，如有违反甲方有权立即解除合同并没收押金。',
    explain: '宠物限制可以约定，但直接解除并没收全部押金缺少整改期和实际损失边界，责任偏重。',
    suggestion: '建议改为事先书面同意机制，违规时先通知整改，押金只赔偿实际损坏。',
    negotiation: '如果确实不养宠物，也建议保留“实际损失 + 整改期”表述，避免轻微争议被无限放大。',
    replacement: '未经甲方书面同意，乙方不得饲养宠物。乙方违反约定的，甲方应先书面通知整改；如造成房屋或设施实际损坏，乙方按有效凭证承担修复费用。',
  }))

  add(makeLeaseFinding({
    id: 'lease-sublet-share-overbroad',
    title: '转租合住限制过宽',
    level: 'medium',
    score: 10,
    dimension: '居住权',
    priority: 'P1',
    keywords: ['不得以任何形式转租', '与他人合住', '视为严重违约'],
    minHits: 2,
    evidence: '乙方不得以任何形式转租、转借或与他人合住，否则视为严重违约。',
    explain: '禁止转租有合理性，但把临时同住、家庭成员居住等都直接列为严重违约，边界过宽。',
    suggestion: '建议区分转租、转借、长期新增居住人和短期访客，并允许经书面同意调整居住人。',
    negotiation: '可承诺不擅自转租牟利，但应保留家庭成员、短期访客和经同意合住的空间。',
    replacement: '未经甲方书面同意，乙方不得将房屋转租、转借或用于经营性合租。乙方新增长期共同居住人的，应提前告知甲方并经书面确认；正常亲友短期探访不视为转租或严重违约。',
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
    id: 'lease-decoration-use-overrestriction',
    title: '装修改造限制过细',
    level: 'low',
    score: 7,
    dimension: '居住权',
    priority: 'P2',
    keywords: ['不得对房屋进行任何形式的装修改造', '墙面打孔', '更换家具位置'],
    minHits: 2,
    evidence: '乙方不得对房屋进行任何形式的装修改造，包括但不限于墙面打孔、贴墙纸、更换家具位置。',
    explain: '禁止破坏结构合理，但把移动家具、轻微安装也全部禁止，可能影响正常居住使用。',
    suggestion: '建议把限制范围收窄到结构改造、破坏性装修和不可恢复行为。',
    negotiation: '可承诺退租恢复原状，但希望保留合理布置家具和非破坏性使用空间。',
    replacement: '未经甲方书面同意，乙方不得进行改变房屋结构、损坏墙体或影响安全的装修改造。乙方可在不损坏房屋和设施的前提下合理摆放家具；退租时按交接清单返还。',
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
    evidence: '乙方签字即视为已充分阅读并完全同意本合同全部内容，此后不得以"未注意"或"不理解"为由对任何条款提出异议。本合同解释权归甲方。',
    replaceFrom: '乙方签字即视为已充分阅读并完全同意本合同全部内容，此后不得以"未注意"或"不理解"为由对任何条款提出异议。本合同解释权归甲方。',
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

export function createKnowledgePrompt(profile) {
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

房屋租赁合同必须重点检查：自动续租涨租、单方调价、押金扣款和退还周期、保洁维修扣款凭证、家具家电自然折旧、维修责任归属、出租人入户权、宠物违约责任、转租合住边界、装修恢复义务、逾期滞纳金比例、换锁收房条款、提前解除不对等、剩余租金没收、违约金过高、杂费凭证、管辖地偏好、格式条款效力、权属瑕疵责任、退租恢复义务、免责范围过宽。`
  }

  return `审查画像：
- 合同类型：${contractType}
- 我方身份：${partyRole}
- 审查强度：${reviewDepth}

内置知识库：
${knowledgeLines}

请优先检查：付款与验收、解除权对等、违约责任上限、知识产权归属、保密期限与违约金、个人信息/数据处理、管辖与通知送达、需求变更控制、证据留存。`
}

export function analyzeContract(text, profile = { contractType: 'lease', partyRole: 'partyB', reviewDepth: 'strict' }) {
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

export function getRiskSummary(findings) {
  const rawScore = findings.reduce((total, item) => total + item.score, 0)
  const score = softenRiskScore(rawScore)
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

export function getDimensionScores(findings) {
  return scoreDimensions.map((dimension) => {
    const rawScore = findings
      .filter((finding) => finding.dimension === dimension)
      .reduce((total, finding) => total + finding.score * 3, 0)
    const score = softenRiskScore(rawScore)

    return {
      dimension,
      score,
      tone: score >= 70 ? 'high' : score >= 35 ? 'medium' : 'low',
    }
  })
}

export function createRevisedContractDraft(contractText, revisionItems) {
  const cleanText = cleanContractTextForReview(contractText)
  return revisionItems.reduce((draft, item) => applyRevisionItemToText(draft, item, { appendIfMissing: true }), cleanText).trim()
}


export function createReportText({ summary, findings, revisionItems, contractText, reviewProfile }) {
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
    '租小审 AI 租房合同解读报告',
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
    '',
    LEGAL_DISCLAIMER,
  ].join('\n')
}
