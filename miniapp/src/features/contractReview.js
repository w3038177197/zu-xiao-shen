// 小程序版本 - 移除 lucide-react 图标引用
// 合同审查核心逻辑

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
    explain: '永久保密和五倍违约金会显著加重乙方责任，且"全部损失"边界不清。',
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
    negotiation: '建议把重点放在"已完成工作应结算"，比单纯要求删除解除权更容易被接受。',
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

// includesAny used for keyword matching
const includesAny = (text, terms) => terms.some((term) => text.includes(term))

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
    negotiation: '可接受优先续租权，但不要接受"沉默续租 + 自动涨价"的组合。',
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
    negotiation: '重点争取"出租人提前解除也支付同等违约金"，这是租赁合同的核心保护。',
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
    negotiation: '要求"实际发生、合理必要、凭证支持"三项条件同时满足。',
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
    id: 'lease-broad-default-six-months',
    title: '违约情形过宽且违约金过高',
    level: 'high',
    score: 18,
    dimension: '违约责任',
    priority: 'P0',
    keywords: ['相当于6个月租金的违约金', '其他甲方认为影响房屋价值的行为'],
    evidence: '乙方有下列情形之一的，甲方有权立即解除合同、收回房屋，押金及剩余租金不予退还，并有权要求乙方另行赔偿相当于6个月租金的违约金：  （1）擅自转租或转借的；  （2）拖欠租金超过3天的；  （3）利用房屋从事违法活动的；  （4）擅自饲养宠物的；  （5）擅自改动房屋结构的；  （6）其他甲方认为影响房屋价值的行为。',
    explain: '违约情形包含出租方主观判断，且同时没收押金、剩余租金并追加 6 个月违约金，责任叠加过重。',
    suggestion: '建议删除主观兜底项，违约金改为与实际损失相当，并设置整改期。',
    negotiation: '可接受严重违约解除，但普通违约应先通知整改。',
    replacement: '乙方严重违约且经甲方书面催告后仍未整改的，甲方可解除合同并要求乙方承担实际损失；违约金最高不超过1个月租金，已收但未发生的租金应据实退还。',
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

  return findings
}

function getProfessionalFindings(text, profile) {
  if (!text.trim()) return []
  if (profile.contractType === 'lease') return getLeaseFindings(text)
  return []
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
