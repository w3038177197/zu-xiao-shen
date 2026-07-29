import { aiReplySections, knowledgeBaseItems } from '../shared/knowledgeBase.js'
import { analyzeContract, cleanContractTextForReview, getRiskSummary } from './contractReview.js'
import { getWorkflowContextLines, loadWorkflowContext } from './workflowContext.js'

function compactText(value, maxLength) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

function pickKnowledge(prompt, limit = 3) {
  const query = String(prompt || '').toLowerCase()
  const rawTokens = query.match(/[一-龥]{2,}|[a-z0-9-]{2,}/gi) || []
  const tokens = rawTokens.flatMap((token) => {
    if (!/^[一-龥]+$/.test(token)) return [token]
    const grams = []
    for (let size = 2; size <= Math.min(4, token.length); size += 1) {
      for (let index = 0; index <= token.length - size; index += 1) grams.push(token.slice(index, index + size))
    }
    return grams
  })
  const scored = knowledgeBaseItems.map((item) => {
    const haystack = `${item.title} ${item.tag} ${item.text}`.toLowerCase()
    const score = tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0)
      + ([item.title, item.tag].some((value) => query.includes(String(value).toLowerCase())) ? 8 : 0)
    return { item, score }
  }).sort((left, right) => right.score - left.score)
  const matches = scored.filter(({ score }) => score > 0).slice(0, limit).map(({ item }) => item)
  return matches.length ? matches : knowledgeBaseItems.slice(0, limit)
}

function actionAdvice(prompt) {
  if (/押金|扣款|保洁|退还/.test(prompt)) return '要求对方提供扣款项目、金额、现场照片、维修或保洁清单及有效票据。正常使用损耗不应直接从押金中扣除。'
  if (/验房|照片|入住/.test(prompt)) return '优先拍摄墙面地面、门窗锁具、水电燃气表读数、卫浴渗漏、厨房设备和家具家电的全景与细节，并在当天发给房东确认。'
  if (/补贴|毕业|社保|人才/.test(prompt)) return '先确认城市、毕业年份和学历，再准备身份证明、学历证明、劳动合同、社保记录、租赁合同和无房证明，并核对官方最新申报窗口。'
  if (/解除|退租|违约|搬走/.test(prompt)) return '先核对解除条款和违约金，保留书面通知，协商押金、剩余租金和费用结算方式，交接当天拍照并确认。'
  if (/合同|条款|签|涨租|维修|入户/.test(prompt)) return '逐条检查押金退还期限、租期内涨租、维修责任、出租方入户、提前解除、违约金、费用凭证和争议管辖。'
  return '先判断问题处于签约、入住、居住中还是退租阶段，再收集合同原文、付款凭证、现场照片和书面沟通记录。'
}

function answerConclusion(prompt) {
  if (/押金|扣款|保洁|退还/.test(prompt)) return '先不要只接受口头扣款结论，应同时核对合同约定、实际损失和有效凭证。'
  if (/验房|照片|入住|瑕疵/.test(prompt)) return '验房的关键不是照片数量，而是让位置、问题、时间和双方确认能够对应起来。'
  if (/补贴|毕业|社保|人才|学历/.test(prompt)) return '本地匹配只能筛选政策线索，最终资格取决于最新官方条件和经办审核。'
  if (/解除|退租|违约|搬走/.test(prompt)) return '先固定通知、交接和费用证据，再协商解除与押金结算，能显著减少后续争议。'
  if (/合同|条款|签|涨租|维修|入户/.test(prompt)) return '应先找到具体条款对应的权利、义务和违约后果，再决定是否签署或要求修改。'
  return '先明确所处租房阶段和争议事实，再用合同、凭证、照片与书面沟通交叉核对。'
}

function buildContextRisk(prompt, context) {
  const { review, checkin, evidence, subsidy } = context
  const topFinding = review?.findings?.[0]
  const contractRisk = review?.summary && topFinding
    ? `当前合同评分 ${review.summary.score}/100（${review.summary.label}），优先处理「${topFinding.title}」。`
    : ''
  if (/验房|照片|入住|瑕疵/.test(prompt)) {
    if (!checkin?.hasData) return '本机还没有验房记录，暂时无法判断房屋现状或照片完整度。'
    const stats = checkin.stats
    const firstDefect = checkin.defects?.[0]
    return `本机验房已完成 ${stats.checked}/${stats.total} 项，记录 ${stats.defects} 处瑕疵、${stats.photos} 张照片。${firstDefect ? `优先核对「${firstDefect.room}-${firstDefect.item}：${firstDefect.defect}」。` : '目前没有已标记的瑕疵。'}`
  }
  if (/押金|扣款|退租|保洁|维修|交接|证据/.test(prompt)) {
    const evidenceRisk = evidence?.hasData
      ? `本机证据包已有 ${evidence.attachmentStats.total} 个附件，清单完成 ${evidence.checklist.checked}/${evidence.checklist.total} 项。${evidence.deposit ? `登记押金为 ${evidence.deposit} 元。` : '押金金额尚未登记。'}`
      : '本机还没有退租证据包，扣款与押金判断缺少合同、照片和费用凭证支撑。'
    return [contractRisk, evidenceRisk].filter(Boolean).join(' ')
  }
  if (/补贴|毕业|社保|人才|学历/.test(prompt)) {
    if (!subsidy?.hasData) return '本机还没有补贴匹配资料，请先填写城市、学历、毕业时间、就业和社保情况。'
    return `已读取 ${subsidy.city || '当前城市'} 的 ${subsidy.total} 条政策线索：满足 ${subsidy.satisfied} 条，待确认 ${subsidy.pending} 条，不满足 ${subsidy.unsatisfied} 条。`
  }
  if (review?.summary && topFinding) {
    return `当前合同评分 ${review.summary.score}/100（${review.summary.label}），共 ${review.findings.length} 个风险点。优先处理「${topFinding.title}」，合同证据为「${compactText(topFinding.evidence || topFinding.explain, 72)}」。`
  }
  return context.contractText
    ? '已关联合同正文，但当前版本还没有可用审查结果，建议先运行本地合同审查。'
    : '本机还没有合同正文，请粘贴具体条款，或先到合同审查页录入合同。'
}

function buildNextStep(prompt, context) {
  if (/验房|照片|入住|瑕疵/.test(prompt) && context.checkin?.stats?.checked < context.checkin?.stats?.total) {
    return `继续完成剩余 ${context.checkin.stats.total - context.checkin.stats.checked} 项验房，并给瑕疵同时补全景、近景和带时间的沟通记录。`
  }
  if (/押金|扣款|退租|保洁|维修|交接|证据/.test(prompt) && !context.evidence?.attachmentStats?.total) {
    return '先到证据包添加合同、入住/退租照片、扣款明细和费用票据，再回来核对具体扣款。'
  }
  if (/补贴|毕业|社保|人才|学历/.test(prompt) && context.subsidy?.pending) {
    return `补齐 ${context.subsidy.pending} 条待确认线索所需信息，并打开政策官网核对申报时间与材料。`
  }
  return '把对方的具体要求、合同原文或扣款明细发来，我会继续按现有本机资料拆解。'
}

export function loadAllModuleContext() {
  const context = loadWorkflowContext()
  if (!context.contractText || context.review.isCurrent) return context
  try {
    const findings = analyzeContract(cleanContractTextForReview(context.contractText))
    return {
      ...context,
      review: {
        ...context.review,
        findings,
        summary: getRiskSummary(findings),
      },
    }
  } catch {
    return context
  }
}

export function buildLocalReply({ prompt, context, contractText, findings = [], summary = null }) {
  const knowledge = pickKnowledge(prompt)
  const resolvedContext = context || {
    contractText: contractText || '',
    review: { findings, summary },
    checkin: { hasData: false },
    evidence: { hasData: false },
    subsidy: { hasData: false },
  }
  const contextLines = getWorkflowContextLines(resolvedContext)
  if (/^(?:你好|您好|嗨|哈喽|hi|hello)[!！。,.，?？\s]*$/i.test(String(prompt || '').trim())) {
    return [
      '结论：你好，我可以帮你检查合同、准备验房、整理退租证据和核对租房补贴线索。',
      `本机资料：${contextLines.length ? contextLines.join('；') : '当前还没有已关联的租房资料。'}`,
      '你可以这样问：合同押金条款有什么风险？入住时要拍哪些照片？房东扣保洁费怎么回复？',
      '提醒：页面会优先使用联网 AI；服务不可用或未授权时，会自动使用本地知识库回答。',
    ].join('\n')
  }
  return [
    `结论：${answerConclusion(prompt)}`,
    `重点风险：${buildContextRisk(prompt, resolvedContext)}`,
    `建议动作：${actionAdvice(prompt)}`,
    `依据：${contextLines.length ? `本机资料：${contextLines.join('；')}。` : '本机暂无已关联业务资料。'}内置知识库：${knowledge.map((item) => `${item.title}（${item.source || '租小审内置知识库'}）`).join('；')}`,
    '提醒：当前回答由本地规则与知识库生成，不是联网大模型；政策和法规请以官方最新口径为准。',
    `下一步：${buildNextStep(prompt, resolvedContext)}`,
  ].join('\n')
}

export function formatMessageBlocks(content) {
  const lines = String(content || '').split('\n').map((line) => line.trim()).filter(Boolean)
  if (!lines.length) return [{ title: '', lines: ['暂无内容'] }]
  const sectionPattern = new RegExp(`^(${aiReplySections.join('|')})[：:]?\\s*(.*)$`)
  const blocks = []
  lines.forEach((line) => {
    const match = line.match(sectionPattern)
    if (match) blocks.push({ title: match[1], lines: match[2] ? [match[2]] : [] })
    else if (blocks.length) blocks[blocks.length - 1].lines.push(line)
    else blocks.push({ title: '', lines: [line] })
  })
  return blocks
}
