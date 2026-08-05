// 由 scripts/sync-miniapp-review.mjs 从 Web 端自动生成，请勿手工修改。
import { LEGAL_DISCLAIMER } from '../constants/legal.js'
import { contractTypeOptions, partyRoleOptions, reviewDepthOptions } from '../../../src/constants/reviewOptions.js'
import { knowledgeBaseItems } from '../../../src/data/knowledgeBase.js'

const riskRules = [
  {
    id: 'payment-delay',
    title: '付款周期过长且免责',
    level: 'high',
    score: 24,
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
const LEASE_FINDING_GROUPS = [
  { title: '押金与退租扣款', dimensions: ['押金'], ids: ['lease-cleaning-repair-no-voucher', 'lease-arbitrary-deposit-deduction', 'lease-appliance-depreciation-deduction', 'lease-pet-forfeiture-no-cure', 'lease-pet-additional-penalty'] },
  { title: '逾期与强制催收', dimensions: ['违约责任'], ids: ['lease-daily-late-fee-5-percent', 'lease-lockout-forfeiture', 'lease-overdue-termination-forfeiture', 'lease-deposit-forfeiture-on-late-rent', 'lease-self-help-utility-cutoff', 'lease-lien-on-tenant-property'] },
  { title: '维修与自然损耗', dimensions: ['维修'], ids: ['lease-maintenance-burden-of-proof', 'lease-all-maintenance-tenant', 'lease-device-warranty-shift'] },
  { title: '居住权与访客', dimensions: ['居住权'], ids: ['lease-landlord-entry-no-consent', 'lease-sublet-share-overbroad', 'lease-visitor-occupancy-fee', 'lease-sale-terminates-tenancy'] },
  { title: '提前解约与续租', dimensions: ['解除', '租期'], ids: ['lease-termination-asymmetry', 'lease-auto-renewal-rent-up', 'lease-unilateral-rent-adjustment'] },
  { title: '费用与税费', dimensions: ['费用'], ids: ['lease-rental-tax-transfer', 'lease-sublet-extra-fee', 'lease-common-area-fee-transfer'] },
  { title: '合同效力与争议', dimensions: ['格式条款', '管辖', '权属'], ids: ['lease-oral-overrides-written', 'lease-handwritten-overrides-printed', 'lease-unfavorable-jurisdiction'] },
]

export function groupFindingsByTheme(findings) {
  const groups = LEASE_FINDING_GROUPS.map((group) => ({ ...group, items: [] }))
  const other = { title: '其他风险', items: [] }
  findings.forEach((finding, index) => {
    const group = groups.find((item) => item.ids.includes(finding.id) || item.dimensions.includes(finding.dimension))
    const target = group || other
    target.items.push({ finding, index })
  })
  return [...groups, other].filter((group) => group.items.length)
}

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

  if (baseFindings.analysisMeta) merged.analysisMeta = baseFindings.analysisMeta

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
  matchGroups = [],
  matchPredicate,
  excludePredicate,
}) {
  return {
    id,
    title,
    level,
    score,
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
    matchGroups,
    matchPredicate,
    excludePredicate,
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
  matchGroups,
  matchPredicate,
  excludePredicate,
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
    matchGroups,
    matchPredicate,
    excludePredicate,
  })
}

function hasInvertedLeaseDateRange(text) {
  const match = String(text || '').match(/(?:租赁时间|租赁期限|租期)[：:为\s]*?(\d{4})\s*(?:年|[./-])?\s*(\d{1,2})\s*(?:月|[./-])?\s*(\d{1,2})\s*(?:日)?\s*(?:至|到|[-—–])\s*(\d{4})\s*(?:年|[./-])?\s*(\d{1,2})\s*(?:月|[./-])?\s*(\d{1,2})\s*(?:日)?/)
  if (!match) return false
  const start = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const end = Date.UTC(Number(match[4]), Number(match[5]) - 1, Number(match[6]))
  return Number.isFinite(start) && Number.isFinite(end) && end < start
}

function parseLeaseDateRange(text) {
  const match = String(text || '').match(/(?:租赁时间|租赁期限|租期)[：:为\s]*?(\d{4})\s*(?:年|[./-])?\s*(\d{1,2})\s*(?:月|[./-])?\s*(\d{1,2})\s*(?:日)?\s*(?:至|到|[-—–])\s*(\d{4})\s*(?:年|[./-])?\s*(\d{1,2})\s*(?:月|[./-])?\s*(\d{1,2})\s*(?:日)?/)
  if (!match) return null

  const start = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  const end = new Date(Date.UTC(Number(match[4]), Number(match[5]) - 1, Number(match[6])))
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null

  return {
    start,
    end,
    statedMonths: Number((String(text).match(/租期(?:共计|为)?\s*(\d+)个?月/) || [])[1]) || null,
    raw: match[0],
  }
}

function parseLeaseMoneyTerms(text) {
  const source = String(text || '')
  const rentMatch = source.match(/月租金[^\d]{0,12}(\d+(?:\.\d+)?)\s*元/)
  const depositMatch = source.match(/押金[^\d]{0,12}(\d+(?:\.\d+)?)\s*元/)
  const rentValues = [...source.matchAll(/(?:月租金|租金)[^\d]{0,12}(\d+(?:\.\d+)?)\s*元/g)].map((item) => Number(item[1]))
  const depositValues = [...source.matchAll(/押金[^\d]{0,12}(\d+(?:\.\d+)?)\s*元/g)].map((item) => Number(item[1]))
  return {
    rent: rentMatch ? Number(rentMatch[1]) : null,
    deposit: depositMatch ? Number(depositMatch[1]) : null,
    rentValues,
    depositValues,
  }
}

function parseChineseNumber(value) {
  if (/^\d+(?:\.\d+)?$/.test(String(value))) return Number(value)
  const digits = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }
  const text = String(value || '')
  if (text === '十') return 10
  if (text.includes('十')) {
    const [left, right] = text.split('十')
    return (digits[left] || 1) * 10 + (digits[right] || 0)
  }
  return digits[text] || null
}

function parseLateDays(text) {
  const values = [...String(text || '').matchAll(/逾期(?:超过|满)?([一二两三四五六七八九十\d]+)日/g)]
    .map((match) => parseChineseNumber(match[1]))
    .filter(Boolean)
  return values.find((value) => value > 1) || values[0] || null
}

function getLeaseAmountFindings(text, money) {
  const findings = []
  const rent = Number(money.rent)
  const windows = getLeaseMatchWindows(text)

  if (rent > 0) {
    const percentWindows = windows.filter((window) => /(?:每日|每逾期一日|按日)[^。；\n]{0,28}(?:月租金|当月租金|租金)[^。；\n]{0,10}(?:的)?\d+(?:\.\d+)?%/.test(window))
    const percentWindow = percentWindows.find((window) => (parseLateDays(window) || 0) > 1) || percentWindows[0]
    if (percentWindow) {
      const percent = Number((percentWindow.match(/(?:月租金|当月租金|租金)[^。；\n]{0,10}(?:的)?(\d+(?:\.\d+)?)%/) || [])[1])
      const days = parseLateDays(percentWindow) || 3
      const daily = Math.round(rent * percent) / 100
      const total = Math.round(daily * days * 100) / 100
      if (percent >= 1 || (total / rent) >= 0.1) {
        findings.push(makeAuditItem({
          id: 'amount-late-fee-percent',
          title: '逾期违约金按月租比例计算偏高',
          level: 'high',
          explanation: '按月租金 ' + rent + ' 元和每日 ' + percent + '% 计算，每日约 ' + daily + ' 元；逾期 ' + days + ' 日约 ' + total + ' 元，占月租金 ' + (Math.round((total / rent) * 1000) / 10) + '%。',
          suggestion: '将逾期费用改为与实际损失相当的标准，并设置总额上限。',
          evidence: percentWindow,
          dimension: '违约责任',
        }))
      }
    }

    const fixedWindows = windows.filter((window) => /(?:租金逾期|每逾期一日|每日|按日)[^。；\n]{0,24}(?:收取|产生|增收)?\s*\d+(?:\.\d+)?元(?:违约金|滞纳金)/.test(window))
    const fixedWindow = fixedWindows.find((window) => (parseLateDays(window) || 0) > 1) || fixedWindows[0]
    if (fixedWindow) {
      const amount = Number((fixedWindow.match(/(?:收取|产生|增收)?\s*(\d+(?:\.\d+)?)元(?:违约金|滞纳金)/) || [])[1])
      const days = parseLateDays(fixedWindow) || 3
      const total = Math.round(amount * days * 100) / 100
      const dailyPercent = Math.round((amount / rent) * 1000) / 10
      if (dailyPercent >= 2 || (total / rent) >= 0.1) {
        findings.push(makeAuditItem({
          id: 'amount-late-fee-fixed',
          title: '固定逾期违约金需核算比例',
          level: 'medium',
          explanation: '每日 ' + amount + ' 元约占月租金 ' + dailyPercent + '%；逾期 ' + days + ' 日累计 ' + total + ' 元，约占月租金 ' + (Math.round((total / rent) * 1000) / 10) + '%。',
          suggestion: '要求按逾期金额、逾期天数和实际损失计算，避免固定高额扣款。',
          evidence: fixedWindow,
          dimension: '违约责任',
        }))
      }
    }

    if (money.deposit && money.deposit / rent > 2.5) {
      findings.push(makeAuditItem({
        id: 'amount-deposit-months',
        title: '押金折算月数偏高',
        level: 'medium',
        explanation: '押金 ' + money.deposit + ' 元约等于 ' + (Math.round((money.deposit / rent) * 10) / 10) + ' 个月租金。',
        suggestion: '优先协商降至一至两个月租金，并写清退还期限、扣款凭证和适用范围。',
        evidence: '月租金和押金金额同时出现。',
        dimension: '押金',
      }))
    }

    const forfeitsDeposit = /押金[^。；]{0,24}(?:没收|不予退还|不予返还|全额扣除)/.test(text)
    const forfeitsRemainingRent = /剩余租金[^。；]{0,16}(?:没收|不予退还|不予返还)/.test(text)
    const penaltyMonths = [...text.matchAll(/(?:相当于|额外支付|赔偿|支付)[^。；]{0,12}([一二两三四五六七八九十\d]+)个?月租金/g)]
      .map((match) => parseChineseNumber(match[1]))
      .filter(Boolean)
    const penaltyTotal = [...new Set(penaltyMonths)].reduce((total, months) => total + rent * months, 0)
    if (forfeitsDeposit && (forfeitsRemainingRent || penaltyTotal > 0)) {
      const knownTotal = (money.deposit || 0) + penaltyTotal
      findings.push(makeAuditItem({
        id: 'amount-penalty-stacking',
        title: '违约责任可能叠加计算过重',
        level: 'high',
        explanation: '条款同时涉及押金没收' + (forfeitsRemainingRent ? '、剩余租金不退' : '') + (penaltyTotal > 0 ? '和约 ' + penaltyTotal + ' 元的月租金倍数违约金' : '') + '；仅按已知金额计算至少约 ' + knownTotal + ' 元，尚未计入未明确的剩余租金。',
        suggestion: '拆分解除、押金扣款和违约金条件，禁止同一违约事实重复赔偿，并以可证明的实际损失为上限。',
        evidence: '押金、剩余租金和月租金倍数违约责任同时出现。',
        dimension: '违约责任',
      }))
    }
  }

  const feeItems = []
  const feePattern = /(?:清洁费|保洁费|养护折旧费|折旧费|养护费|消杀费|异味清除费|复原费|占用费)[^。；\n]{0,12}\d+(?:\.\d+)?\s*元|\d+(?:\.\d+)?\s*元[^。；\n]{0,12}(?:清洁费|保洁费|养护折旧费|折旧费|养护费|消杀费|异味清除费|复原费|占用费)/g
  for (const match of text.matchAll(feePattern)) {
    const amount = Number((match[0].match(/(\d+(?:\.\d+)?)\s*元/) || [])[1])
    const label = (match[0].match(/清洁费|保洁费|养护折旧费|折旧费|养护费|消杀费|异味清除费|复原费|占用费/) || [])[0]
    const context = extractClauseAroundKeyword(text, [match[0]])
    if (amount > 0 && /统一|固定|一律|额外|直接|扣除|收取|支付/.test(context)) feeItems.push({ amount, label, context })
  }
  const feeTotal = feeItems.reduce((total, item) => total + item.amount, 0)
  if (feeTotal >= 500 || (rent > 0 && feeTotal / rent >= 0.2)) {
    findings.push(makeAuditItem({
      id: 'amount-fixed-deductions-total',
      title: '固定扣费合计需重点核对',
      level: 'medium',
      explanation: '固定或近似固定费用合计约 ' + feeTotal + ' 元' + (rent > 0 ? '，约占月租金 ' + (Math.round((feeTotal / rent) * 1000) / 10) + '%' : '') + '。',
      suggestion: '要求删除无条件固定扣费，改为实际发生、责任明确、凭证支持后扣除。',
      evidence: feeItems[0]?.context || feeItems.map((item) => item.label + item.amount + '元').join('、'),
      dimension: '费用',
    }))
  }

  return findings
}

function getEvidenceLocation(text, evidence = '') {
  const source = String(text || '')
  const needle = String(evidence || '').trim()
  const index = needle ? source.indexOf(needle) : -1
  const offset = index >= 0 ? index : 0
  const before = source.slice(0, offset)
  const line = before ? before.split(/\r?\n/).length : 1
  const clauseMatches = [...source.matchAll(/第\s*([一二三四五六七八九十百\d]+)\s*条[^\n]*/g)]
    .filter((match) => match.index <= offset)
  const clauseMatch = clauseMatches[clauseMatches.length - 1]
  return {
    line,
    clause: clauseMatch ? `第${clauseMatch[1]}条` : null,
  }
}

function makeAuditItem({ id, title, level = 'medium', explanation, suggestion, evidence, dimension = '完整性' }) {
  return {
    id,
    title,
    kind: id.startsWith('missing-') ? 'missing' : 'consistency',
    level,
    levelText: level === 'high' ? '高风险' : level === 'medium' ? '需核对' : '待补充',
    explanation,
    suggestion,
    evidence,
    dimension,
  }
}

function getLeaseCompletenessFindings(text) {
  const checks = [
    ['missing-lessor-authority', '未看到出租权或产权依据', !includesAny(text, ['合法出租权', '产权材料', '房产证', '授权委托']), '要求出租方提供可核验的出租权依据或授权材料。'],
    ['missing-deposit-return-deadline', '未明确押金退还期限', !(
      /(?:押金|保证金)[^。；\n]{0,50}(?:退还|返还)[^。；\n]{0,30}(?:\d+\s*(?:个)?工作日|\d+\s*日内|当天|当日|验收后|结清后)/.test(text)
      || /(?:\d+\s*(?:个)?工作日|\d+\s*日内|当天|当日)[^。；\n]{0,30}(?:退还|返还)(?:押金|保证金)/.test(text)
    ), '补充退房验收、费用结清后的明确退还期限和扣款清单。'],
    ['missing-handover-list', '未看到房屋及设备交接清单', !includesAny(text, ['交接清单', '物品清单', '验房记录']), '增加交接清单，记录家具家电状态、表数和钥匙数量。'],
    ['missing-utility-basis', '未明确水电等费用的计费依据', !includesAny(text, ['按表', '缴费凭证', '账单', '计费标准', '单价', '起止表数']), '写明起止表数、单价或账单凭证，避免口头加价。'],
    ['missing-notice-channel', '未明确书面通知或送达方式', !includesAny(text, ['书面通知', '电子邮件', '微信', '送达']), '约定联系人、通知渠道和送达时间，保留可核验记录。'],
  ]

  return checks
    .filter(([, , missing]) => missing)
    .map(([id, title, , suggestion]) => makeAuditItem({
      id,
      title,
      explanation: '合同正文未检出这一必要信息，不能据此判断条款安全。',
      suggestion,
      evidence: '未检出明确约定。',
    }))
}

function getLeaseConsistencyFindings(text) {
  const findings = []
  const datePattern = /(?:租赁时间|租赁期限|租期)[：:为\s]*?(\d{4})\s*(?:年|[./-])?\s*(\d{1,2})\s*(?:月|[./-])?\s*(\d{1,2})\s*(?:日)?\s*(?:至|到|[-—–])\s*(\d{4})\s*(?:年|[./-])?\s*(\d{1,2})\s*(?:月|[./-])?\s*(\d{1,2})\s*(?:日)?/g
  const dateRanges = [...String(text || '').matchAll(datePattern)].map((match) => ({
    raw: match[0],
    start: Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
    end: Date.UTC(Number(match[4]), Number(match[5]) - 1, Number(match[6])),
  }))
  const uniqueDateRanges = new Set(dateRanges.map((item) => item.start + ':' + item.end))
  if (uniqueDateRanges.size > 1) {
    findings.push(makeAuditItem({
      id: 'consistency-lease-date-conflict',
      title: '合同不同位置的租赁日期不一致',
      level: 'high',
      explanation: '正文或补充内容出现多个不同的租赁起止日期，无法确定实际租期和租金计算基准。',
      suggestion: '逐处核对正文、附件和手写修改，只保留一组经双方签字确认的起止日期。',
      evidence: dateRanges.map((item) => item.raw).join('；'),
      dimension: '租期',
    }))
  }
  const dates = parseLeaseDateRange(text)
  if (dates && dates.end < dates.start) {
    findings.push(makeAuditItem({
      id: 'consistency-lease-date-order',
      title: '租赁起止日期前后倒置',
      level: 'high',
      explanation: '结束日期早于起始日期，租期长度和履行时间无法按当前文字确定。',
      suggestion: '核对年份、月份和日期，并以双方签字确认的书面日期为准。',
      evidence: dates.raw,
      dimension: '租期',
    }))
  } else if (dates && dates.statedMonths) {
    const months = Math.round((dates.end - dates.start) / (1000 * 60 * 60 * 24 * 30.4375))
    if (months > 0 && Math.abs(months - dates.statedMonths) > 1) {
      findings.push(makeAuditItem({
        id: 'consistency-lease-months',
        title: '起止日期与约定租期不一致',
        level: 'high',
        explanation: `起止日期按日历计算约 ${months} 个月，但正文写成 ${dates.statedMonths} 个月。`,
        suggestion: '在签署前统一起止日期和租期月数，并以书面修订为准。',
        evidence: dates.raw,
        dimension: '租期',
      }))
    }
  }

  const money = parseLeaseMoneyTerms(text)
  if (money.rentValues.length > 1 && new Set(money.rentValues).size > 1) {
    const rentEvidence = [...text.matchAll(/(?:月租金|租金)[^\d]{0,12}\d+(?:\.\d+)?\s*元/g)].map((match) => match[0])
    findings.push(makeAuditItem({
      id: 'consistency-rent-amount',
      title: '合同内月租金金额不一致',
      level: 'high',
      explanation: `正文出现多个月租金金额：${[...new Set(money.rentValues)].join('、')} 元。`,
      suggestion: '核对正文、附件和补充条款，只保留一个经双方签字确认的金额。',
      evidence: [...new Set(rentEvidence)].join('；'),
      dimension: '租金',
    }))
  }
  if (money.depositValues.length > 1 && new Set(money.depositValues).size > 1) {
    const depositEvidence = [...text.matchAll(/押金[^\d]{0,12}\d+(?:\.\d+)?\s*元/g)].map((match) => match[0])
    findings.push(makeAuditItem({
      id: 'consistency-deposit-amount',
      title: '合同内押金金额不一致',
      level: 'high',
      explanation: `正文出现多个押金金额：${[...new Set(money.depositValues)].join('、')} 元。`,
      suggestion: '核对押金金额、支付凭证和附件，明确退还基数。',
      evidence: [...new Set(depositEvidence)].join('；'),
      dimension: '押金',
    }))
  }
  if (money.rent && money.deposit && /押[一二三四五六七八九\d]+付/.test(text)) {
    const ratioText = (text.match(/押([一二三四五六七八九\d]+)付/) || [])[1]
    const ratio = Number(ratioText)
    const ratioMap = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
    const expected = Number.isFinite(ratio) ? ratio : ratioMap[ratioText]
    if (expected && Math.abs(money.deposit - money.rent * expected) > 0.01) {
      findings.push(makeAuditItem({
        id: 'consistency-deposit-ratio',
        title: '押金金额与押付方式不一致',
        level: 'medium',
        explanation: `按月租金和“押${expected}”计算，押金应约为 ${money.rent * expected} 元，正文为 ${money.deposit} 元。`,
        suggestion: '核对押金金额和押付方式，避免退租时产生争议。',
        evidence: extractEvidenceSnippet(text, ['押金', '押一付', '押二付', '押三付']) || '押金金额与押付方式同时出现。',
        dimension: '押金',
      }))
    }
  }
  return [...findings, ...getLeaseAmountFindings(text, money)]
}

function getReviewCoverage(text, riskFindings, missingFindings, consistencyFindings) {
  const dimensions = ['租期', '租金', '押金', '维修', '费用', '解约', '责任', '交接', '通知']
  const allFindings = [...riskFindings, ...missingFindings, ...consistencyFindings]
  const checked = dimensions.filter((dimension) => allFindings.some((item) => item.dimension === dimension) || includesAny(text, [dimension]))
  return {
    checked: checked.length,
    total: dimensions.length,
    percent: Math.round((checked.length / dimensions.length) * 100),
    label: `${checked.length}/${dimensions.length} 个核心维度已核对`,
  }
}

function getLeaseMatchWindows(text) {
  const source = String(text || '')
  const parts = source
    .split(/(?:\r?\n)+|(?<=[。；！？!?])/u)
    .map((part) => part.trim())
    .filter(Boolean)
  const windows = [...parts]
  for (let index = 0; index < parts.length - 1; index += 1) {
    const combined = `${parts[index]}${parts[index + 1]}`
    if (combined.length <= 360) windows.push(combined)
  }
  return windows.length ? windows : [source]
}

function getLeaseFindings(text) {
  const findings = []
  const matchWindows = getLeaseMatchWindows(text)
  const add = (finding) => {
    if (typeof finding.excludePredicate === 'function' && finding.excludePredicate(text)) return
    const minHits = finding.minHits || 1
    const match = matchWindows
      .map((window) => {
        const keywordHits = finding.keywords.filter((keyword) => window.includes(keyword))
        const groupedHits = finding.matchGroups
          .map((group) => group.find((keyword) => window.includes(keyword)))
          .filter(Boolean)
        const matchedByGroups = finding.matchGroups.length > 0 && groupedHits.length === finding.matchGroups.length
        const matchedByPredicate = typeof finding.matchPredicate === 'function' && finding.matchPredicate(window)
        return { window, keywordHits, groupedHits, matchedByGroups, matchedByPredicate }
      })
      .find(({ keywordHits, matchedByGroups, matchedByPredicate }) => keywordHits.length >= minHits || matchedByGroups || matchedByPredicate)

    if (!match) return

    const { window, keywordHits, groupedHits, matchedByGroups, matchedByPredicate } = match
    const hits = [...new Set([...keywordHits, ...groupedHits])]
    const hasExactEvidence = text.includes(finding.evidence)
    const matchedRange = findLooseTextRange(text, window)
    const matchedSource = matchedRange ? text.slice(matchedRange.start, matchedRange.end) : text
    const fallbackClause = hasExactEvidence ? '' : extractClauseAroundKeyword(matchedSource, hits)
    const resolvedEvidence = hasExactEvidence ? finding.evidence : fallbackClause || (matchedByPredicate ? matchedSource : '') || extractEvidenceSnippet(text, hits)
    findings.push({
      ...finding,
      evidence: resolvedEvidence,
      hits,
      replaceFrom: hasExactEvidence ? finding.replaceFrom : fallbackClause,
      confidence: matchedByPredicate ? 0.98 : matchedByGroups ? 0.9 : Math.min(0.96, 0.65 + hits.length * 0.08),
      evidenceLocation: getEvidenceLocation(text, resolvedEvidence || hits[0]),
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
    matchGroups: [
      ['自动续期', '自动续租', '自动顺延', '顺延一年', '延长十二个月'],
      ['上调', '上浮', '涨租', '提高租金', '月租提高', '租金提高', '月租上调'],
    ],
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
    matchGroups: [
      ['乙方提前退租', '承租人提前退租', '租客提前解约', '禁止任何形式退租', '绝对禁止退租', '任何理由提前退租', '任何情况不得提前解除', '不得提前解除租赁合同', '提前搬走视为根本违约'],
      ['两个月租金', '2个月租金', '双倍月租金', '提前六十日', '提前90日', '剩余租金全部没收', '押金全部没收', '根本违约', '剩余租金不予退还'],
      ['甲方可提前解除', '出租人可提前收回', '提前七日通知', '提前15日通知', '提前10日通知', '提前3天通知', '随时无理由解约', '无需补偿', '无需承担任何违约金', '单方面解除合同', '卖房需求', '房屋出售', '房屋自用', '收回房屋'],
    ],
    evidence: '乙方提前退租须提前60日书面通知甲方，并支付违约金（相当于2个月租金）。甲方因出售房屋等自身原因需提前解除合同的，提前15日通知乙方即可，双方按实际居住天数结算租金。',
    explain: '承租人提前退租成本高，出租人因自身原因解除却几乎无赔偿，权利义务严重失衡。',
    suggestion: '建议设置对等提前通知期限和对等违约金，出租人提前解除也应补偿搬家等合理损失。',
    negotiation: '重点争取“出租人提前解除也支付同等违约金”，这是租赁合同的核心保护。',
    replacement: '任一方因自身原因提前解除合同的，应提前30日书面通知对方，并向对方支付相当于1个月租金的违约金；因甲方提前解除导致乙方搬迁的，甲方还应承担合理搬家费用。',
  }))

  add(makeLeaseFinding({
    id: 'lease-early-exit-stacked-penalty',
    title: '提前退租同时没收多项款项并追加违约金',
    level: 'high',
    score: 18,
    dimension: '解除',
    priority: 'P0',
    keywords: ['全部租金、押金不予退还', '额外向甲方支付1个月房租'],
    minHits: 99,
    matchGroups: [
      ['不得以任何理由提前退租', '不得提前退租', '禁止提前退租', '中途退房', '提前退租'],
      ['全部租金、押金不予退还', '租金押金概不退还', '剩余租金、押金全部没收', '押金及剩余租金全部不退', '已付租金和押金不退'],
      ['额外支付1个月房租', '额外向甲方支付1个月房租', '另付一个月租金', '另行支付一个月房租', '额外支付2个月房租', '额外支付两个月房租'],
    ],
    matchPredicate: (text) => /(?:提前退租|中途退租|提前搬离)/.test(text)
      && /押金[^。；\n]{0,20}(?:不退|不予返还|没收)/.test(text)
      && /剩余(?:房租|租金)[^。；\n]{0,16}(?:不退|不予返还|没收)/.test(text)
      && /(?:额外|另行)[^。；\n]{0,12}\d+(?:\.\d+)?个?月(?:房租|租金)(?:作为)?违约金?/.test(text),
    evidence: '乙方不得以任何理由提前退租；中途退房时已支付全部租金、押金不予退还，并额外支付1个月房租作为违约金。',
    explain: '提前退租同时不退已付租金、没收押金并追加违约金，责任发生叠加，可能明显超过出租方实际损失。',
    suggestion: '分别约定未发生租金的结算、押金返还和合理违约金；违约责任应与可证明的实际损失相当。',
    negotiation: '可接受合理提前通知和违约金，但不接受未发生租金、押金和额外违约金同时全部丧失。',
    replacement: '乙方因自身原因提前退租的，应提前30日书面通知甲方，并承担双方约定且与实际损失相当的违约责任；未实际发生的租金和扣除合理费用后的押金应据实返还。',
  }))

  add(makeLeaseFinding({
    id: 'lease-annual-rent-prepayment',
    title: '一次性预付全年租金资金风险较高',
    level: 'medium',
    score: 10,
    dimension: '租金',
    priority: 'P1',
    keywords: ['一次性付清全年房租', '不接受月付、季付'],
    minHits: 99,
    matchGroups: [
      ['一次性付清全年房租', '一次性支付全年租金', '全年租金一次付清', '一次性交清一年租金'],
      ['不接受月付', '不接受季付', '不得分期', '不接受分期'],
    ],
    evidence: '乙方须一次性付清全年房租，不接受月付、季付等分期支付方式。',
    explain: '年付并非当然无效，但会显著增加承租人的预付资金和出租方履约风险，发生提前解除或房屋权属争议时追款成本更高。',
    suggestion: '优先协商月付或季付；如确需年付，应核验出租权、收款账户，并写明提前解除后的未发生租金退还规则。',
    negotiation: '先提出押一付三；若只能年付，要求同步降低押金并补充未发生租金的明确退款期限。',
    replacement: '租金按季度支付，每期开始前支付当期租金。合同提前解除的，双方按实际居住天数据实结算，甲方应在结算完成后7个工作日内退还未发生租金。',
  }))

  add(makeLeaseFinding({
    id: 'lease-unilateral-rent-adjustment',
    title: '出租方单方调价并没收押金',
    level: 'high',
    score: 18,
    dimension: '租金',
    priority: 'P0',
    minHits: 99,
    keywords: ['上涨超过20%', '相应调整租金', '15日内搬离', '押金不予返还'],
    matchGroups: [
      ['市场行情', '市场情况', '周边租金', '周边房租', '周边房价', '周边房价行情', '房价行情', '经营需要', '平台调价'],
      ['调整租金', '提高租金', '上浮租金', '变更租金', '上调房租', '上调', '涨价'],
      ['不接受', '不同意', '乙方不同意', '租客拒绝', '拒绝即解约', '拒绝调整', '拒绝涨价', '不补缴', '拒不补缴', '未补缴'],
    ],
    evidence: '租赁期间如周边同户型租金均价上涨超过20%，甲方有权要求乙方按上涨比例相应调整租金。乙方如不接受调整，须在15日内搬离，押金不予返还。',
    explain: '租期内赋予出租方单方涨租权，且承租人不同意就要搬离并损失押金，风险很高。',
    suggestion: '建议删除租期内单方调价权，租金在固定租期内保持不变。',
    negotiation: '租金是租赁合同核心条款，固定租期内不应由一方单方改变。',
    replacement: '租赁期限内月租金保持不变。合同期满续租时，双方可根据市场情况另行协商租金标准。',
  }))

  add(makeLeaseFinding({
    id: 'lease-daily-late-fee-5-percent',
    title: '逾期违约金标准可能过高',
    level: 'high',
    score: 18,
    dimension: '违约责任',
    priority: 'P0',
    keywords: ['每逾期一日', '月租金5%', '滞纳金', '每日', '违约金'],
    minHits: 99,
    matchGroups: [
      ['每逾期一日', '按日', '每日'],
      ['租金1%', '租金2%', '租金3%', '租金5%', '百分之一', '百分之二', '百分之三', '百分之五'],
    ],
    matchPredicate: (text) => {
      const percent = Number((text.match(/(?:每日|每逾期一日|按日)[^。；\n]{0,28}(\d+(?:\.\d+)?)%[^。；\n]{0,12}(?:违约金|滞纳金)/) || [])[1])
      return percent >= 1 || /(?:每日|每逾期一日)[^。；\n]{0,24}\d+(?:\.\d+)?元(?:违约金|滞纳金)/.test(text)
    },
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
    matchGroups: [
      ['拖欠租金', '逾期交租', '租金逾期', '欠租', '逾期当日', '逾期1天'],
      ['换锁', '更换门锁', '开锁收房', '强制开锁', '停水停电', '强制收房', '强行收房', '自行收回房屋', '合同直接终止', '合同终止', '租赁合同终止'],
    ],
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
    matchGroups: [
      ['押金', '保证金'],
      ['30日内', '30个工作日', '45日内', '45个工作日', '60日内', '两个月内', '三个月内'],
      ['退还', '返还'],
    ],
    matchPredicate: (text) => {
      const days = Number((text.match(/(?:押金[^。；\n]{0,40}(\d+)个?工作日|(\d+)个?工作日[^。；\n]{0,24}押金)/) || []).slice(1).find(Boolean))
      return days >= 30 && /(?:退还|返还|审核|扣押|暂扣)/.test(text)
    },
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
    matchGroups: [
      ['押金', '保证金'],
      ['甲方酌情扣除', '酌情退还', '出租人认定', '甲方核定', '赔付金额由甲方核定', '无需提供票据', '固定保洁费', '折旧费', '统一扣除', '固定扣除', '清洁费', '管理费'],
    ],
    matchPredicate: (text) => /(?:正常居住痕迹|正常使用痕迹|轻微发黄|日常划痕|正常磨损)/.test(text)
      && /(?:赔付|维修|扣款)[^。；\n]{0,24}(?:房东|甲方)[^。；\n]{0,12}(?:单方制定|核定|认定)/.test(text),
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
    matchGroups: [
      ['保洁费', '清洁费', '维修费', '粉刷费'],
      ['无需提供票据', '不提供发票', '不必出示凭证', '从押金扣除', '保证金中抵扣'],
    ],
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
    minHits: 99,
    matchGroups: [
      ['家具折旧', '家电折旧', '设备折旧', '家电老化', '老化损耗', '正常磨损', '自然磨损', '轻微发黄', '折旧费'],
      ['押金', '保证金', '承租人承担', '乙方承担', '人为损坏', '全额赔付'],
    ],
    evidence: '退还时甲方可扣除以下费用：房屋及设施维修费、全屋保洁费（不低于400元）、墙面修补粉刷费、家具家电折旧补偿、以及甲方认定的其他合理扣款。',
    explain: '家具家电正常折旧属于租赁使用中的自然损耗，不应当然由承租人从押金中补偿。',
    suggestion: '建议区分自然折旧和人为损坏，只有承租人原因造成的实际损坏才可扣款。',
    negotiation: '退租时先按入住验房照片和设备清单核对，正常老化不应算承租人责任。',
    replacement: '家具家电因正常使用产生的自然折旧不作为扣款依据；因乙方不当使用造成损坏的，乙方按维修实际支出承担责任，甲方应提供照片、维修清单和票据。',
  }))

  add(makeLeaseFinding({
    id: 'lease-maintenance-burden-of-proof',
    title: '维修责任举证责任倒置',
    level: 'medium',
    score: 12,
    dimension: '维修',
    priority: 'P1',
    keywords: ['举证责任归于乙方', '乙方必须举证', '无法证明属于自然老化'],
    matchGroups: [
      ['举证责任归于乙方', '乙方必须举证', '无法证明属于自然老化', '证明属于自然老化'],
      ['维修费全部由乙方', '维修费用由乙方承担', '全部维修费用', '维修费用全部由乙方'],
    ],
    evidence: '房屋设施出现故障时，乙方需证明属于自然老化；无法证明的，全部维修费用由乙方承担。',
    explain: '把自然老化是否成立的举证责任全部压给承租人，会让正常维修责任被一概转移。',
    suggestion: '应按故障原因分配责任，由主张扣款的一方提供故障原因、维修明细和凭证。',
    negotiation: '保留乙方不当使用造成损坏的责任，但不要接受“无法证明就全部由乙方承担”。',
    replacement: '房屋或设施故障应结合使用年限、交接记录和维修凭证判断原因；自然老化及非乙方原因由甲方负责，乙方不当使用造成的实际损坏由乙方承担。',
  }))

  add(makeLeaseFinding({
    id: 'lease-all-maintenance-tenant',
    title: '自然损耗维修全部转嫁承租人',
    level: 'high',
    score: 16,
    dimension: '维修',
    priority: 'P0',
    keywords: ['任何问题的，由乙方自行维修并承担费用', '自然原因造成的损坏，同样由乙方负责'],
    matchGroups: [
      ['不论原因', '无论何种原因', '一律', '一切故障', '所有故障', '包括自然老化', '水管老化', '管道老化', '电路老化', '线路故障', '墙体开裂', '墙体漏水', '水管爆裂', '家电故障损耗'],
      ['乙方维修', '乙方负责维修', '承租人负责维修', '租客承担维修', '由乙方承担', '维修费用均由乙方', '全部由乙方承担', '均由乙方维保'],
    ],
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
    matchGroups: [
      ['进入房屋', '进入租赁房屋', '入室检查', '开门检查', '开门进入房屋', '上门检修', '上门看房', '带看房源'],
      ['无需通知', '无需提前告知', '无需征得', '不必征得', '随时进入', '自行进入'],
    ],
    evidence: '甲方及中介人员有权在合理时间进入房屋进行检查、维修或带人看房，无需另行征得乙方同意。',
    explain: '租赁期间承租人享有房屋占有和安宁居住利益，出租方未经同意进入房屋风险很高。',
    suggestion: '建议要求提前通知并经承租人确认，紧急维修除外。',
    negotiation: '检查和带看可以配合，但必须提前预约并尊重居住安全和隐私。',
    replacement: '甲方或中介需进入房屋检查、维修或带看时，应至少提前24小时通知乙方并取得乙方同意；紧急抢修等特殊情况除外。',
  }))

  add(makeLeaseFinding({
    id: 'lease-landlord-reserved-space',
    title: '出租方保留承租区域使用权',
    level: 'high',
    score: 15,
    dimension: '居住权',
    priority: 'P0',
    keywords: ['阳台、飘窗使用权归房东', '房东可随时取用'],
    minHits: 99,
    matchGroups: [
      ['阳台', '飘窗', '储物间', '套内空间'],
      ['使用权归房东', '使用权归甲方', '租客不得存放', '乙方不得存放'],
      ['房东可随时取用', '甲方可随时取用', '房东可随时进入', '甲方可随时进入'],
    ],
    evidence: '阳台、飘窗使用权归房东，租客不得存放私人物品，房东可随时取用。',
    explain: '已经随房屋一并交付的套内空间却由出租方保留日常使用和进入权，会削弱承租人的占有使用及居住安宁。',
    suggestion: '在平面图或交接清单中明确承租范围；不出租的封闭区域应在签约前排除，出租范围内由承租人正常使用。',
    negotiation: '要求明确哪些区域计入租赁标的，房东不得对已交付区域保留随时取用或进入权。',
    replacement: '房屋及随附阳台、飘窗等套内空间在租赁期内交由乙方合理使用；甲方需进入或取用物品的，应事先说明并取得乙方同意，紧急情形除外。',
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
    matchGroups: [
      ['宠物', '猫狗'],
      ['押金不退', '押金全额没收', '押金全部没收', '保证金不予返还', '没收保证金', '立即终止合同', '立刻解除租赁', '解除租赁'],
    ],
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
    matchGroups: [
      ['合住', '共同居住', '亲友留宿', '朋友留宿', '邀请朋友留宿', '留宿外人', '留宿访客', '访客留宿', '增加居住人', '连续超过12小时', '单次不能超过20小时'],
      ['一律禁止', '不得', '严重违约', '立即解除', '罚款', '占用费', '违规一次', '扣除押金'],
    ],
    evidence: '乙方不得以任何形式转租、转借或与他人合住，否则视为严重违约。',
    explain: '禁止转租有合理性，但把临时同住、家庭成员居住等都直接列为严重违约，边界过宽。',
    suggestion: '建议区分转租、转借、长期新增居住人和短期访客，并允许经书面同意调整居住人。',
    negotiation: '可承诺不擅自转租牟利，但应保留家庭成员、短期访客和经同意合住的空间。',
    replacement: '未经甲方书面同意，乙方不得将房屋转租、转借或用于经营性合租。乙方新增长期共同居住人的，应提前告知甲方并经书面确认；正常亲友短期探访不视为转租或严重违约。',
    excludePredicate: (source) => source.includes('正常亲友短期探访不视为转租或严重违约'),
  }))

  add(makeLeaseFinding({
    id: 'lease-excessive-restoration',
    title: '退租恢复义务过重',
    level: 'medium',
    score: 10,
    dimension: '押金',
    priority: 'P1',
    keywords: ['全屋墙面重新粉刷', '全部区域深度保洁', '费用按市场价从押金中扣除'],
    matchGroups: [
      ['退租', '交还房屋', '搬离'],
      ['全屋粉刷', '重新刷墙', '重新粉刷', '专业保洁', '深度清洁', '深度保洁'],
    ],
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
    id: 'lease-normal-use-fixed-penalty',
    title: '正常居住使用被限制并设置固定扣款',
    level: 'medium',
    score: 9,
    dimension: '居住权',
    priority: 'P1',
    keywords: ['晾晒衣物', '挂钩贴纸', '扣除押金200元'],
    minHits: 99,
    matchGroups: [
      ['晾晒衣物', '粘贴挂钩', '挂钩贴纸', '贴贴纸', '留宿', '饲养宠物', '噪音投诉', '被投诉噪音', '夜间扰民'],
      ['扣除押金', '从押金扣除', '每次扣除押金', '单次扣押金', '每次罚款', '每次扣款'],
    ],
    evidence: '禁止乙方晾晒衣物、在墙面粘贴挂钩贴纸，违者每次扣除押金200元。',
    explain: '可以限制造成实际损坏的使用行为，但将一般居住行为一概禁止并设置固定扣款，未区分是否损坏及实际损失。',
    suggestion: '只限制破坏结构或留下明显损坏的行为；发生损坏时按照片、维修清单和实际费用处理。',
    negotiation: '可承诺不破坏墙体并在退租时恢复，但不接受没有实际损失仍固定扣押金。',
    replacement: '乙方应合理使用房屋，不得实施破坏结构或造成明显损坏的行为；因乙方原因产生实际损坏的，按有效维修凭证承担费用，正常居住使用不作固定扣款。',
  }))

  add(makeLeaseFinding({
    id: 'lease-utility-no-voucher',
    title: '杂费收费缺少凭证',
    level: 'medium',
    score: 9,
    dimension: '费用',
    priority: 'P1',
    keywords: ['不得要求提供原始缴费凭证'],
    matchGroups: [
      ['水电费', '水电燃气费', '能源费', '杂费'],
      ['不得查账', '无需提供票据', '不提供账单', '内部标准收取', '不得提出异议'],
    ],
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
    matchGroups: [
      ['任一违约', '任何违约', '其他违约行为', '甲方认为违约'],
      ['押金不退', '没收押金', '保证金不予返还'],
      ['三个月租金', '3个月租金', '六个月租金', '6个月租金'],
    ],
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
    minHits: 99,
    matchGroups: [
      ['甲方出售', '甲方卖房', '房东卖房', '出售房屋', '抵押房屋', '收回房屋', '要求租客搬走', '要求乙方搬离', '无故单方解约'],
      ['无需支付违约金', '不承担违约金', '无需赔偿', '无需补偿', '不承担赔偿'],
    ],
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
    matchGroups: [
      ['抵押', '债务纠纷', '司法查封', '邻居投诉', '邻里噪音', '物业干涉', '物业纠纷', '墙体漏水', '管道老化', '房屋固有问题'],
      ['甲方免责', '不承担责任', '无需承担责任', '不构成违约', '不构成甲方违约', '不得要求减租', '不得以此要求减租', '互不追责'],
    ],
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
    keywords: ['甲方户籍所在地人民法院', '甲方户籍所在地法院', '房东户籍地法院'],
    matchGroups: [
      ['甲方住所地', '甲方所在地', '出租方所在地', '甲方注册地', '出租人户籍地', '甲方户籍地', '甲方户籍所在地', '房东户籍地'],
      ['人民法院', '法院起诉', '提起诉讼', '仲裁委员会'],
    ],
    evidence: '双方发生争议协商不成的，应向甲方户籍所在地人民法院起诉。',
    explain: '约定到出租方户籍所在地起诉，可能增加承租人维权成本，且不一定与房屋所在地一致。',
    suggestion: '建议改为房屋所在地法院或合同履行地法院。',
    negotiation: '房屋所在地与证据、现场勘验更相关，也更中立。',
    replacement: '双方发生争议协商不成的，应向房屋所在地有管辖权的人民法院提起诉讼。',
  }))

  add(makeLeaseFinding({
    id: 'lease-format-clause-waiver',
    title: '单方解释权及放弃异议条款',
    level: 'medium',
    score: 12,
    dimension: '格式条款',
    priority: 'P1',
    keywords: ['不得以"未注意"或"不理解"', '本合同解释权归甲方', '解释权归甲方'],
    matchGroups: [
      ['最终解释权', '所有解释权', '解释权归甲方', '不得提出异议', '放弃抗辩', '不得以未阅读'],
    ],
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
    matchGroups: [
      ['权属瑕疵', '无权出租', '抵押查封', '产权争议'],
      ['仅退剩余租金', '只退未住租金', '不承担赔偿', '互不追究'],
    ],
    evidence: '如因房屋权属问题导致乙方无法继续居住的，甲方退还剩余租金，双方互不追究。',
    explain: '如果因出租方权属瑕疵导致无法居住，仅退剩余租金不能覆盖承租人搬迁等直接损失。',
    suggestion: '建议要求出租方保证有权出租，并对权属瑕疵承担违约责任。',
    negotiation: '房屋权属是出租方基础义务，不能只退未住期间租金。',
    replacement: '甲方应保证其对房屋享有合法出租权。因权属瑕疵导致乙方无法使用房屋的，甲方应退还剩余租金和押金，并赔偿乙方因此产生的合理直接损失。',
  }))

  add(makeLeaseFinding({
    id: 'lease-sale-terminates-tenancy',
    title: '出售房屋即要求承租人搬离',
    level: 'high',
    score: 16,
    dimension: '居住权',
    priority: 'P0',
    keywords: ['出售房屋时本合同自动终止', '乙方应无条件搬离'],
    matchGroups: [
      ['出售房屋', '出售、抵押房屋', '出售或抵押房屋', '房屋出售', '房东卖房', '卖房', '抵押房屋', '产权转让', '转卖房屋'],
      ['合同自动终止', '租约立即终止', '乙方无条件搬离', '承租人限期腾退', '通知乙方限期搬离', '要求租客搬离', '7日内搬离', '限期搬离'],
    ],
    evidence: '甲方出售房屋时本合同自动终止，乙方应无条件搬离。',
    explain: '租赁期间房屋所有权发生变动，通常不当然使原租赁合同终止。该条款会削弱承租人的租期稳定性。',
    suggestion: '建议删除“出售即解约”，明确产权变更不影响原合同继续履行。',
    legalBasis: '参考《民法典》第七百二十五条关于租赁物所有权变动不影响租赁合同效力的规则。',
    negotiation: '可以配合合理带看，但不能把房屋出售直接变成无补偿退租。',
    replacement: '租赁期间房屋所有权发生变动的，不影响本合同效力。甲方应确保受让人继续履行本合同，并妥善完成押金和租金结算交接。',
  }))

  add(makeLeaseFinding({
    id: 'lease-abandoned-property-disposal',
    title: '出租方可自行处置承租人物品',
    level: 'high',
    score: 17,
    dimension: '居住权',
    priority: 'P0',
    keywords: ['甲方有权自行清理乙方遗留物品', '无需承担赔偿责任'],
    matchGroups: [
      ['遗留物品', '屋内财物', '个人物品', '私人物品', '承租人物品'],
      ['自行处置', '直接丢弃', '视为放弃', '视为遗弃', '遗弃物品', '清理丢弃', '清理变卖'],
    ],
    evidence: '乙方逾期搬离的，甲方有权自行清理乙方遗留物品，无需承担赔偿责任。',
    explain: '出租方自行丢弃或变卖承租人财物，容易造成财产权和证据争议。',
    suggestion: '建议改为书面通知、清点封存和合理保管，不能直接视为放弃。',
    negotiation: '退租可约定搬离期限，但遗留物品应先清点、通知和保管。',
    replacement: '乙方遗留物品的，甲方应制作清单并书面通知乙方在合理期限内领取；逾期未领取的，甲方可依法处理，合理保管费用由责任方承担。',
  }))

  add(makeLeaseFinding({
    id: 'lease-excessive-holdover-rent',
    title: '逾期搬离按多倍租金计费',
    level: 'medium',
    score: 10,
    dimension: '违约责任',
    priority: 'P1',
    keywords: ['逾期搬离', '三倍房租'],
    minHits: 99,
    matchGroups: [
      ['逾期搬离', '逾期腾退', '未按期搬离', '逾期收取', '滞留'],
      ['双倍占用费', '2倍占用费', '双倍房租', '2倍房租', '双倍租金', '2倍租金', '三倍房租', '3倍房租', '三倍租金', '3倍租金'],
    ],
    evidence: '乙方逾期搬离的，按三倍房租收取占用费用。',
    explain: '逾期占用可以承担合理费用，但直接按三倍租金计算且没有总额边界，可能明显超过实际损失。',
    suggestion: '按实际占用天数、原日租金和可证明损失结算，并设置合理上限。',
    negotiation: '可以接受逾期占用费，但不接受没有损失依据的三倍计费。',
    replacement: '乙方逾期返还房屋的，应按实际占用天数支付占用费；造成其他实际损失的，凭有效证据另行承担，累计责任应保持合理。',
  }))

  add(makeLeaseFinding({
    id: 'lease-deposit-indefinite-hold',
    title: '押金争议期间可无限期暂扣',
    level: 'medium',
    score: 10,
    dimension: '押金',
    priority: 'P1',
    keywords: ['争议期间暂扣押金', '存在分歧可暂扣押金'],
    minHits: 99,
    matchGroups: [
      ['押金', '保证金'],
      ['存在分歧', '发生争议', '争议期间', '核查期间'],
      ['暂扣', '继续扣押', '暂不退还', '不计利息'],
    ],
    evidence: '押金存在分歧时，甲方可以暂扣且未约定处理期限。',
    explain: '争议期间暂扣押金却没有金额范围、处理期限和无争议部分先行返还规则，可能造成长期占用。',
    suggestion: '只暂留与争议金额相当的部分，并明确处理期限；无争议部分应先行返还。',
    negotiation: '要求写明暂留金额、证据和最迟处理日期，不能因小额争议扣住全部押金。',
    replacement: '押金结算发生争议的，甲方仅可暂留与争议金额相当的部分，并应在15日内提供扣款依据；无争议部分应按约定期限先行返还。',
  }))

  add(makeLeaseFinding({
    id: 'lease-rent-loan-forced',
    title: '签约即被绑定租金分期或贷款',
    level: 'high',
    score: 18,
    dimension: '租金',
    priority: 'P0',
    keywords: ['视为同意办理租金分期贷款', '指定金融机构'],
    matchGroups: [
      ['租金贷', '租金贷款', '租金分期', '金融机构办理分期'],
      ['视为同意', '必须办理', '自动开通', '授权甲方代办'],
    ],
    evidence: '乙方签署本合同即视为同意由甲方通过指定金融机构办理租金分期贷款。',
    explain: '将租赁合同与贷款或分期自动绑定，可能让承租人在不充分知情时承担额外债务和征信风险。',
    suggestion: '租金支付与金融产品应分开选择，任何贷款必须单独、明确、自愿授权。',
    negotiation: '要求提供普通月付或季付方式，不接受把金融分期作为签约前提。',
    replacement: '乙方可自主选择约定的租金支付周期。任何贷款、分期或金融服务均须由乙方另行书面确认，甲方不得将其作为签订或履行租赁合同的前提。',
  }))

  add(makeLeaseFinding({
    id: 'lease-excessive-deposit',
    title: '押金金额明显偏高',
    level: 'medium',
    score: 11,
    dimension: '押金',
    priority: 'P1',
    keywords: ['押金为三个月租金', '收取四个月租金作为保证金'],
    matchGroups: [
      ['押金', '租赁保证金'],
      ['三个月租金', '3个月租金', '四个月租金', '4个月租金', '三倍月租金'],
    ],
    evidence: '乙方应支付相当于三个月租金的押金。',
    explain: '较高押金会显著增加承租人的资金占用和退租争议风险。',
    suggestion: '建议协商降低至一个月租金，并明确退还时间、扣款范围和凭证要求。',
    negotiation: '如对方坚持较高押金，至少要求专款性质、扣款凭证和明确退还期限。',
    replacement: '乙方支付相当于一个月租金的押金。合同终止并完成交接、费用结清后，甲方应在7个工作日内退还剩余押金。',
  }))

  add(makeLeaseFinding({
    id: 'lease-unsafe-housing-waiver',
    title: '房屋安全或健康风险全部转嫁承租人',
    level: 'high',
    score: 18,
    dimension: '居住权',
    priority: 'P0',
    keywords: ['甲醛、消防及隔断问题均由乙方自行承担', '甲方概不负责'],
    matchGroups: [
      ['甲醛', '消防隐患', '违法隔断', '房屋安全问题', '空气质量'],
      ['乙方自行承担', '甲方概不负责', '出租方免责', '不得据此退租'],
    ],
    evidence: '乙方确认已知悉房屋现状，甲醛、消防及隔断问题均由乙方自行承担，甲方概不负责。',
    explain: '出租人不能用格式条款把适租、安全和健康风险全部转嫁给承租人。',
    suggestion: '建议要求出租方保证房屋具备基本居住和安全条件，并保留整改、解除及索赔权。',
    negotiation: '房屋现状确认不等于承租人放弃对隐蔽安全问题的权利。',
    replacement: '甲方应保证房屋符合基本居住、安全和消防要求。因交付前已存在且非乙方造成的安全或健康问题，甲方应及时整改；影响正常居住的，乙方有权依法解除合同并要求退还相关款项。',
  }))

  add(makeLeaseFinding({
    id: 'lease-agency-fee-nonrefundable',
    title: '未成交也不退中介服务费',
    level: 'medium',
    score: 10,
    dimension: '费用',
    priority: 'P1',
    keywords: ['中介服务费一经支付概不退还', '无论租赁合同是否最终签订'],
    matchGroups: [
      ['中介费', '居间服务费', '信息服务费', '经纪服务费'],
      ['概不退还', '一律不退', '未签约也不退', '未签约时也不退还', '未成交不退'],
    ],
    evidence: '中介服务费一经支付概不退还，无论租赁合同是否最终签订。',
    explain: '把服务费设置为未签约、未成交也绝对不退，可能与实际完成的服务不相称。',
    suggestion: '建议按服务阶段和实际完成情况约定收费及退费规则。',
    negotiation: '先要求列清服务项目、收费节点和未成交时的退费比例。',
    replacement: '经纪服务费应与实际完成的服务相对应。因非乙方原因未能签订租赁合同的，未实际发生部分的服务费应予退还；具体项目和金额以收费清单为准。',
  }))

  add(makeLeaseFinding({
    id: 'lease-date-range-invalid',
    title: '租赁起止日期前后倒置',
    level: 'high',
    score: 18,
    dimension: '租期',
    priority: 'P0',
    keywords: ['租赁时间', '租赁期限'],
    minHits: 99,
    matchPredicate: hasInvertedLeaseDateRange,
    evidence: '租赁期限的起始日期晚于终止日期，合同期限无法按当前文字确定。',
    explain: '起止日期倒置会导致租期长度、租金支付和交房义务都无法确定，不能仅按合同写的“共计12个月”推定有效。',
    suggestion: '签署前核对年份、月份和日期，并在正文中明确可计算的起止日。',
    legalBasis: '参考合同条款应当明确、可履行以及租赁期限和履行期间确定的基本规则。',
    negotiation: '这属于必须先改正的基础信息错误，不要只在手写处补数字。',
    replacement: '租赁期限自2026年2月1日起至2027年1月31日止，共12个月；双方应以修正后的书面日期为准。',
  }))

  add(makeLeaseFinding({
    id: 'lease-deposit-forfeiture-on-late-rent',
    title: '逾期一天即没收全部押金',
    level: 'high',
    score: 20,
    dimension: '押金',
    priority: 'P0',
    keywords: ['逾期1天扣除全部押金', '逾期当日直接停水停电'],
    matchGroups: [
      ['逾期1天', '逾期当日', '逾期即'],
      ['扣除全部押金', '押金全额没收', '押金全部没收', '押金不予返还'],
    ],
    evidence: '租金逾期一天即扣除全部押金，处罚与一次短期迟延不相称。',
    explain: '把短期迟延直接等同于没收全部押金，且可能与其他违约责任叠加，明显扩大承租人责任。',
    suggestion: '改为书面催告、合理宽限期和与实际损失相称的违约责任，押金不能自动全部没收。',
    negotiation: '可以接受逾期费用，但要求按逾期金额和实际损失计算，并设置上限。',
    replacement: '乙方逾期支付租金的，甲方应先书面催告并给予合理宽限期；逾期违约金按逾期金额计算并设置上限，不得直接没收全部押金。',
  }))

  add(makeLeaseFinding({
    id: 'lease-deposit-forfeiture-on-no-notice',
    title: '未提前通知续租即没收押金',
    level: 'high',
    score: 16,
    dimension: '押金',
    priority: 'P0',
    keywords: ['未提前通知视为违约，押金全额没收'],
    matchGroups: [
      ['未提前通知', '未书面告知', '未在期限内通知', '不续租'],
      ['押金全额没收', '没收押金', '押金不予返还'],
    ],
    evidence: '乙方到期不续租未提前通知的，直接视为违约并全额没收押金。',
    explain: '通知义务可以约定，但不能把一般通知迟延直接转化为押金全部丧失，尤其应区分实际损失。',
    suggestion: '将通知义务与合理的实际损失责任分开，明确押金仍应在结清费用和交接后返还。',
    negotiation: '可接受提前通知安排，但不要接受无损失证明的押金没收。',
    replacement: '乙方拟期满不续租的，应尽量提前30日书面通知甲方；未及时通知造成实际损失的，按可证明的合理损失承担责任，押金不得当然全部没收。',
  }))

  add(makeLeaseFinding({
    id: 'lease-overdue-termination-forfeiture',
    title: '逾期三日即解除合同并没收押金',
    level: 'high',
    score: 18,
    dimension: '押金',
    priority: 'P0',
    keywords: ['逾期超过3日', '逾期超过三日', '逾期满4日'],
    matchGroups: [
      ['逾期超过3日', '逾期超过三日', '逾期三日', '逾期3日', '逾期满4日'],
      ['直接解除合同', '解除合同', '终止合同', '合同终止', '租赁合同终止', '直接收房'],
      ['押金全部没收', '押金全额没收', '没收押金', '押金不予返还', '全部费用没收', '全部款项没收'],
    ],
    evidence: '租金逾期超过三日即解除合同并没收全部押金，未区分催告、实际损失和补救期限。',
    explain: '短期逾期同时触发解除和押金全部没收，责任可能明显超过实际损失，也没有给承租人补救机会。',
    suggestion: '补充书面催告和合理宽限期；解除与押金扣款应分别判断，扣款以可证明的实际损失为限。',
    negotiation: '可以约定逾期责任，但要求先催告、给补救期限，并把押金扣款和解除条件分开。',
    replacement: '乙方逾期支付租金的，甲方应先书面催告并给予合理补救期限；逾期仍未支付且达到约定解除条件的，方可依法解除合同，押金仅用于抵扣可证明的实际损失。',
  }))

  add(makeLeaseFinding({
    id: 'lease-safety-liability-waiver',
    title: '人身和财产安全责任被全部转嫁',
    level: 'high',
    score: 20,
    dimension: '居住权',
    priority: 'P0',
    keywords: ['所有安全事故、财产损失、人身损害全部由乙方负责'],
    matchGroups: [
      ['盗窃', '火灾', '漏水', '摔伤', '触电', '高空坠物', '人身损害'],
      ['全权负责', '全部由乙方', '甲方不承担任何', '不承担连带责任'],
    ],
    evidence: '盗窃、火灾、漏水、摔伤、触电等所有安全事故和损失均由乙方全权负责，甲方不承担责任。',
    explain: '不能用一概免责条款排除出租方对房屋安全、设施维护和自身过错应承担的责任。',
    suggestion: '按事故原因划分责任，保留出租方对房屋结构、设施维护和自身过错的责任。',
    negotiation: '承租人可以承担自身故意或不当使用造成的损失，但不应替出租方承接全部安全风险。',
    replacement: '双方按照事故原因承担责任。因甲方未尽房屋和设施维护义务或甲方过错造成损失的，由甲方依法承担；因乙方故意或不当使用造成的损失由乙方承担。',
  }))

  add(makeLeaseFinding({
    id: 'lease-common-area-fee-transfer',
    title: '公共维修和管理费用一概转嫁',
    level: 'medium',
    score: 12,
    dimension: '费用',
    priority: 'P1',
    keywords: ['公摊能耗费、楼道维修费、小区管理费全部由乙方承担'],
    matchGroups: [
      ['公摊', '楼道维修', '小区管理', '公共区域维修'],
      ['全部由乙方', '均由乙方', '承租人承担全部', '一概由乙方承担', '全部由租客', '均由租客', '租客承担全部'],
    ],
    evidence: '公摊能耗费、楼道维修费和小区管理费全部由乙方承担，未区分使用性费用与房屋或公共设施维修责任。',
    explain: '公共设施维修、房屋管理和使用性费用性质不同，不能不加区分地全部转给承租人。',
    suggestion: '列明费用项目、计费标准和凭证，区分日常使用费用与房屋及公共设施维修费用。',
    negotiation: '可以承担约定的实际使用费，但要求物业账单和公共维修责任边界清楚。',
    replacement: '乙方承担其实际使用产生且有账单依据的水、电、燃气等费用；房屋主体、公共设施和楼道维修费用由责任方依法承担，物业管理费按双方明确约定执行。',
  }))

  add(makeLeaseFinding({
    id: 'lease-device-warranty-shift',
    title: '设备仅短期保修后全部转嫁',
    level: 'high',
    score: 16,
    dimension: '维修',
    priority: 'P0',
    keywords: ['仅保修1个月', '一个月后所有损坏、故障、老化问题一律乙方自费'],
    matchGroups: [
      ['保修1个月', '保修一个月', '仅保修30日', '过保修期'],
      ['家具', '家电', '厨卫设施', '设备'],
      ['一律乙方自费', '全部由乙方更换', '承租人自行购买更换'],
    ],
    evidence: '家具、家电和厨卫设施仅保修一个月，之后所有损坏、故障和老化均由乙方自费维修更换。',
    explain: '短期保修不能当然排除出租方对设备自然老化、质量问题和非承租人原因故障的维修责任。',
    suggestion: '区分自然故障、正常老化和承租人不当使用，按原因分配维修或更换责任。',
    negotiation: '可以承担自己造成的损坏，但要保留设备自然故障和正常老化的维修边界。',
    replacement: '家具家电因正常使用、自然老化或非乙方原因发生故障的，由甲方负责维修或更换；因乙方不当使用造成的损坏由乙方承担实际维修费用。',
  }))

  add(makeLeaseFinding({
    id: 'lease-oral-overrides-written',
    title: '口头约定被置于书面合同之上',
    level: 'medium',
    score: 10,
    dimension: '格式条款',
    priority: 'P1',
    keywords: ['口头约定效力高于书面合同'],
    matchGroups: [
      ['口头约定', '口头承诺', '双方口头说法', '口头说明', '口头安排', '口头通知', '口头告知'],
      ['高于书面', '优先于书面合同', '效力高于书面', '以口头为准', '口头约定为准', '口头说明为准', '口头安排执行', '按照甲方口头安排执行', '以甲方口头说明为准', '口头通知', '口头告知', '具有约束力', '对乙方有效'],
    ],
    evidence: '本合同未尽事宜以双方口头约定为准，且口头约定效力高于书面合同。',
    explain: '把难以证明的口头内容概括性置于书面合同之上，会削弱条款确定性并放大举证争议。',
    suggestion: '重要补充约定应通过书面补充协议、签字确认或可留存的明确聊天记录形成证据。',
    negotiation: '不是禁止沟通，而是把租金、押金、维修和解约等关键事项落到书面。',
    replacement: '对租金、押金、租期、维修、解约和交接等重要事项的补充约定，应以双方签署的书面补充协议或可核验的书面确认记录为准。',
  }))

  add(makeLeaseFinding({
    id: 'lease-handwritten-overrides-printed',
    title: '手写修改与打印文本的效力边界不清',
    level: 'medium',
    score: 10,
    dimension: '格式条款',
    priority: 'P1',
    keywords: ['手写修改内容', '手写修改', '打印文字'],
    matchGroups: [
      ['手写修改内容', '手写修改', '手写条款'],
      ['效力高于打印文字', '高于打印', '优先于打印文字', '以手写为准'],
    ],
    evidence: '合同约定手写修改内容效力高于打印文字，但未说明修改位置、双方确认和冲突处理方式。',
    explain: '手写内容可能改变租金、期限或责任，但如果没有双方签字、日期和明确的替换范围，容易产生版本和真伪争议。',
    suggestion: '对每处手写修改标注双方签字、日期和修改前后内容；与打印条款冲突时使用书面补充协议确认。',
    negotiation: '可以保留手写修改，但要让双方在每一处修改旁签字并写明日期。',
    replacement: '任何手写修改均应由甲乙双方在修改处签字并注明日期；涉及租金、押金、租期、维修或解约的，应另行签署书面补充协议。',
  }))

  add(makeLeaseFinding({
    id: 'lease-rental-tax-transfer',
    title: '租赁税费和开票费用全部转嫁承租人',
    level: 'medium',
    score: 12,
    dimension: '费用',
    priority: 'P1',
    keywords: ['税费', '开票费用', '开票费'],
    minHits: 99,
    matchGroups: [
      ['房屋租赁产生的税费', '租赁税费', '税费', '开票费用', '开票费'],
      ['全部由乙方承担', '由乙方承担', '乙方承担全部', '承租方承担', '由乙方负担'],
    ],
    evidence: '房屋租赁产生的全部税费、开票费用均由乙方承担。',
    explain: '把出租方应依法承担或依法申报的税费、开票成本概括转给承租人，容易造成实际租金和责任边界不透明。',
    suggestion: '区分租金、实际使用费和依法应由各方承担的税费；如需代办开票，应写明项目、金额和凭证。',
    negotiation: '可以核对实际税费，但不要接受“全部税费、开票费用一概由乙方承担”的笼统表述。',
    replacement: '双方依法各自承担应由其承担的税费；因一方申请发票产生的额外合理费用，应事先书面确认项目、金额和有效凭证。',
  }))

  add(makeLeaseFinding({
    id: 'lease-sublet-extra-fee',
    title: '转租需支付额外手续费',
    level: 'medium',
    score: 10,
    dimension: '费用',
    priority: 'P1',
    keywords: ['转租手续费', '转租服务费', '转租费', '手续费', '服务费'],
    minHits: 99,
    matchGroups: [],
    matchPredicate: (text) => /(?:转租|分租|转借)[^。；\n]{0,50}(?:手续费|服务费)/.test(text)
      && !/(?:不另收|不收取|不得收取|无需支付)[^。；\n]{0,12}(?:手续费|服务费|费用)/.test(text),
    evidence: '确需转租的，必须经甲方书面同意，且乙方需向甲方支付月租金30%的转租手续费。',
    explain: '出租人可以要求事先同意转租，但按月租金比例另收手续费缺少实际服务和损失依据，容易形成额外收费。',
    suggestion: '将转租审批与合理实际成本分开，禁止按租金比例收取没有依据的固定费用。',
    negotiation: '可以接受书面审批，但要求删除按月租金比例收取的转租手续费。',
    replacement: '乙方转租应事先取得甲方书面同意；甲方不得仅因审批同意收取与实际成本无关的转租手续费。',
  }))

  add(makeLeaseFinding({
    id: 'lease-visitor-occupancy-fee',
    title: '限制访客留宿并收取占用费',
    level: 'medium',
    score: 10,
    dimension: '居住权',
    priority: 'P1',
    keywords: ['留宿外来人员', '访客留宿', '房屋占用费', '占用费'],
    minHits: 99,
    matchGroups: [],
    matchPredicate: (text) => /(?:留宿|访客|外来人员)[^。；\n]{0,80}(?:占用费|按日|按每日|收费)/.test(text)
      && !/(?:不收取|不得收取|无需支付)[^。；\n]{0,12}(?:占用费|费用)/.test(text),
    evidence: '乙方留宿外来人员单次不得超过3天，超过需经甲方书面同意，违者按每日80元标准支付房屋占用费。',
    explain: '正常访客和家庭居住应与转租、经营性合住区分，按留宿天数收取占用费会把居住行为变成额外收费。',
    suggestion: '区分短期访客、长期共同居住人和转租，不以访客留宿直接收取占用费或罚款。',
    negotiation: '可以约定不得擅自转租，但应保留正常亲友探访，不接受按天收取占用费。',
    replacement: '正常亲友短期探访不视为转租或违约；长期新增共同居住人或经营性合住的，应提前告知并经双方书面确认，不另收无依据的占用费。',
  }))

  add(makeLeaseFinding({
    id: 'lease-pet-additional-penalty',
    title: '宠物违约额外收取固定清除费',
    level: 'medium',
    score: 10,
    dimension: '违约责任',
    priority: 'P1',
    keywords: ['异味清除费', '宠物清洁费', '额外支付', '额外收取'],
    minHits: 99,
    matchGroups: [
      ['宠物', '饲养猫狗', '饲养任何宠物'],
      ['异味清除费', '清除费', '额外支付', '额外收取', '固定费用'],
    ],
    evidence: '禁止饲养任何宠物，违约除没收押金外，乙方还需额外支付2000元异味清除费。',
    explain: '除实际损坏外固定收取异味清除费，未说明实际发生、责任因果和费用凭证，可能与押金或其他违约责任重复。',
    suggestion: '如确有异味或损坏，应以实际发生的清洁维修费用和有效凭证为限，并保留整改机会。',
    negotiation: '可以承诺不造成异味和损坏，但要求删除固定2000元费用，改为实际损失凭证结算。',
    replacement: '如因乙方饲养宠物造成实际异味、污染或设施损坏，乙方仅按实际发生的清洁、维修费用并凭有效票据承担责任；不得预先收取固定清除费。',
  }))

  add(makeLeaseFinding({
    id: 'lease-self-help-utility-cutoff',
    title: '欠费后以停水停电或限制入户催缴',
    level: 'high',
    score: 18,
    dimension: '居住权',
    priority: 'P0',
    keywords: ['停水停电', '断水断电', '限制入户', '限制乙方入户', '限制承租人入户'],
    minHits: 99,
    matchGroups: [],
    matchPredicate: (text) => /(?:欠缴|欠付|拖欠|欠费|逾期缴费)[^。；\n]{0,80}(?:停水停电|断水断电|限制(?:乙方|承租人)?入户|限制使用)/.test(text)
      && !/(?:不得|禁止|无权)[^。；\n]{0,12}(?:停水停电|断水断电|限制入户)/.test(text),
    evidence: '乙方欠缴任何费用超过3日的，甲方有权采取停水停电、限制入户等措施催缴。',
    explain: '欠费争议应通过通知、结算和依法主张解决，出租方不能以停水停电或限制入户代替正常催收和解除程序。',
    suggestion: '改为书面通知、提供账单、合理宽限期和依法追偿，不得停水停电或限制承租人正常进出。',
    negotiation: '可以接受逾期费用和书面催告，但不能接受影响基本居住和进出权的自力救济。',
    replacement: '乙方逾期支付经核对的费用，甲方应先书面催告并给予合理期限；逾期仍未支付的，双方依法处理，不得停水停电、限制入户或妨碍正常居住。',
  }))

  add(makeLeaseFinding({
    id: 'lease-lien-on-tenant-property',
    title: '以所谓留置权处置承租人物品',
    level: 'high',
    score: 18,
    dimension: '违约责任',
    priority: 'P0',
    keywords: ['留置权', '行使留置', '留置'],
    minHits: 99,
    matchGroups: [],
    matchPredicate: (text) => /(?:留置权|行使留置|留置)[^。；\n]{0,60}(?:处置房屋内|处置乙方物品|变卖|物品抵扣|折价抵扣|抵扣欠款)/.test(text)
      && !/(?:不得|禁止|无权|未经法定程序不得)[^。；\n]{0,20}(?:留置|变卖|折价抵扣|处置)/.test(text),
    evidence: '逾期支付租金超过3日，甲方有权行使留置权，处置房屋内乙方的物品抵扣欠款。',
    explain: '出租方不能仅凭合同文字就当然取得处置承租人物品的权利，擅自搬走、变卖或抵扣可能侵害财产权并引发更大争议。',
    suggestion: '删除自行留置和处置物品的表述，改为清单、通知、保管期限及依法追偿。',
    negotiation: '欠费可以依法追偿，但要求保留物品清单和领取期限，不接受自行处置个人物品。',
    replacement: '承租人遗留物品的，甲方应制作清单并书面通知领取，在合理期限内妥善保管；逾期仍未领取的，按法律规定处理，不得直接以“留置权”自行变卖或抵扣。',
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

function getRoleTip(finding, profile) {
  if (profile.contractType !== 'lease') return ''
  if (profile.partyRole === 'partyA') return '甲方视角：保留管理、扣款或解除权时，要落到书面通知、合理期限、票据凭证和实际损失；绝对没收、随意入户、自行处置这类写法反而容易无效。'
  if (profile.partyRole === 'partyB') return '租客视角：优先要求删除或收窄该条，写清房东通知义务、举证责任、票据凭证、维修边界和押金退还期限。'
  if (profile.partyRole === 'neutral') return '中立视角：同时看条款能否执行、双方权责是否对等、证据和通知链条是否完整。'
  return ''
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

  const allFindings = [...baseFindings, ...getProfessionalFindings(reviewText, profile)].map((finding) => ({
    ...finding,
    roleTip: getRoleTip(finding, profile),
    confidence: finding.confidence ?? Math.min(0.96, 0.65 + (finding.hits?.length || 0) * 0.08),
    evidenceLocation: finding.evidenceLocation || getEvidenceLocation(reviewText, finding.evidence || finding.hits?.[0]),
  }))
  const includeFinding = (finding) => profile.reviewDepth === 'strict'
    || (profile.reviewDepth === 'business' ? finding.level === 'high' : finding.level !== 'low')
  const findings = allFindings.filter(includeFinding)
  if (profile.contractType === 'lease') {
    const missingFindings = getLeaseCompletenessFindings(reviewText).filter(includeFinding)
    const consistencyFindings = getLeaseConsistencyFindings(reviewText).filter(includeFinding)
    findings.analysisMeta = {
      missingFindings,
      consistencyFindings,
      coverage: getReviewCoverage(reviewText, findings, missingFindings, consistencyFindings),
    }
  }
  return findings
}

export function getRiskSummary(findings) {
  const rawScore = findings.reduce((total, item) => total + item.score, 0)
  const score = Math.max(softenRiskScore(rawScore), findings.some((item) => item.level === 'high') ? 35 : 0)
  const highCount = findings.filter((item) => item.level === 'high').length
  const mediumCount = findings.filter((item) => item.level === 'medium').length
  const audit = findings.analysisMeta || {}
  const missingFindings = audit.missingFindings || []
  const consistencyFindings = audit.consistencyFindings || []
  const coverage = audit.coverage || null
  const base = { highCount, mediumCount, missingFindings, consistencyFindings, missingCount: missingFindings.length, consistencyCount: consistencyFindings.length, auditCount: missingFindings.length + consistencyFindings.length, coverage }

  if (score >= 70 || highCount >= 1) {
    return { score, label: '高风险', tone: 'danger', advice: '建议先修核心条款，再进入签署。', ...base }
  }

  if (score >= 35) {
    return { score, label: '需重点关注', tone: 'warning', advice: '主要风险可通过补充条款降低。', ...base }
  }

  return { score, label: '低风险', tone: 'safe', advice: missingFindings.length ? '未发现明显高风险，但仍有信息缺失需要补齐。' : '未发现明显高风险，仍建议人工复核。', ...base }
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
  const riskLines = groupFindingsByTheme(findings)
    .map((group) => [
      `【${group.title}】`,
      ...group.items.map(({ finding, index }) => {
        const details = riskDetails[finding.id]
        const priority = finding.priority || details?.priority || 'P2'
        const evidence = finding.evidence || details?.evidence || finding.hits.join('、')
        const negotiation = finding.negotiation || details?.negotiation || '建议结合交易背景与对方协商。'
        const roleTip = finding.roleTip || ''
        return [
          `${index + 1}. ${finding.title}（${finding.levelText}，${priority}）`,
          `发现来源：${finding.source === 'ai' ? 'AI 全文复核补充' : '本地规则'}`,
          `风险解释：${finding.explain}`,
          `证据片段：${evidence}`,
          `修改建议：${finding.suggestion}`,
          ...(roleTip ? [`我方关注点：${roleTip}`] : []),
          `谈判话术：${negotiation}`,
        ].join('\n')
      }),
    ].join('\n'))
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
    `条款维度完整度：${summary.coverage?.label || '未生成'}`,
    `待补齐信息：${summary.missingCount || 0} 项；内部矛盾：${summary.consistencyCount || 0} 项`,
    '',
    '一、风险清单',
    riskLines || '未发现明显风险。',
    '',
    '二、待补齐与待核对',
    [...(summary.missingFindings || []), ...(summary.consistencyFindings || [])]
      .map((item, index) => `${index + 1}. ${item.title}：${item.explanation} 建议：${item.suggestion}`)
      .join('\n') || '暂无结构性缺失或内部矛盾提示。',
    '',
    '三、已采纳修改说明',
    revisionLines,
    '',
    '四、修订版合同草案',
    revisedDraft,
    '',
    '五、当前合同文本',
    contractText || '暂无合同正文。',
    '',
    LEGAL_DISCLAIMER,
  ].join('\n')
}
