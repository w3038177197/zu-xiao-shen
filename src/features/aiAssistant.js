import { AlertTriangle } from 'lucide-react'
import { workflowLabels } from '../constants/appConfig.js'
import { partyRoleOptions, reviewDepthOptions } from '../constants/reviewOptions.js'
import { aiReplySections, aiResponseSkills, knowledgeBaseItems } from '../data/knowledgeBase.js'
import { getCheckinContextSummary, loadCheckinInspectionState } from './checkinInspection.js'
import { getEvidenceContextSummary, loadEvidencePackState } from './evidencePack.js'
import { getSubsidyContextSummary, loadSubsidyMatcherState } from './subsidyMatcher.js'
import { formatMoney } from '../utils/money.js'
import { compactText } from '../utils/text.js'
import { createKnowledgePrompt, detectContractType, getContractTypeLabel } from './contractReview.js'

export function getPlatformApiEndpoint() {
  return '/api/ai/chat'
}

export function parseAiContent(content) {
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

export function extractAssistantContent(data) {
  const message = data?.choices?.[0]?.message
  const content = message?.content
  if (Array.isArray(content)) {
    return content.map((item) => item.text || item.content || '').join('')
  }

  if (content) return content

  const reasoningContent = message?.reasoning_content || ''
  if (/\{[\s\S]*\}/.test(reasoningContent)) return reasoningContent

  return data?.output_text || ''
}

export function extractAssistantChatContent(data) {
  const message = data?.choices?.[0]?.message
  const content = message?.content
  if (Array.isArray(content)) {
    return content.map((item) => item.text || item.content || '').join('')
  }

  return content || data?.output_text || message?.reasoning_content || ''
}

export function createMessageId(prefix = 'msg') {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

export function createAiWelcomeMessage() {
  return {
    id: 'assistant-welcome',
    role: 'assistant',
    content: '我是租小审系统 AI，已经接入合同审查、退租证据包、入住验房和补贴匹配。你可以直接问我当前页面、当前合同或下一步怎么处理。',
  }
}

export function createEmptyAiFeedback() {
  return {
    helpful: 0,
    needsWork: 0,
    byMessage: {},
  }
}

export function normalizeAiFeedback(value) {
  const next = createEmptyAiFeedback()

  if (!value || typeof value !== 'object') return next

  next.byMessage = value.byMessage && typeof value.byMessage === 'object' ? value.byMessage : {}
  next.helpful = Object.values(next.byMessage).filter((rating) => rating === 'helpful').length
  next.needsWork = Object.values(next.byMessage).filter((rating) => rating === 'needsWork').length

  return next
}

export function normalizeAiFindings(data, sourceText) {
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

export function buildAiQualityReport(data, sourceText, acceptedFindings) {
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

export function createAiReviewPrompt(contractText, profile, ragItems = []) {
  const ragContext = Array.isArray(ragItems) && ragItems.length ? `\n${buildRagContextPrompt(ragItems)}\n` : ''

  return `请审查下面这份中文合同。只返回 JSON，不要 Markdown，不要解释 JSON 以外的内容。

${createKnowledgePrompt(profile)}
${ragContext}

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


export function buildAiResponseSkillPrompt() {
  return [
    '【已加载 AI 回复技能】',
    ...aiResponseSkills.map((skill, index) => `${index + 1}. ${skill.title}：${skill.rule}`),
    '【回复样式硬性要求】',
    '1. 必须先给结论，再给风险和行动建议。',
    '2. 必须使用“依据”栏目，列出至少 1 条知识库命中标题或系统内置规则；没有命中时要说明依据不足并建议核实。',
    '3. 优先使用这些栏目：结论、重点风险、建议动作、可发给房东的话、依据。没有必要的栏目不要硬凑。',
    '4. 不要输出 Markdown 装饰符号，包括 **、###、---、代码块、表格和连续项目符号。',
    '5. 每段尽量短，语气专业克制，不使用夸张表达，不编造法律结论。',
    '6. 涉及政策、补贴或法规时，提醒以官方最新页面和经办部门口径为准。',
  ].join('\n')
}

function buildLocalKnowledgeContext() {
  return knowledgeBaseItems
    .map((item, index) => `${index + 1}. ${item.title}（${item.tag}）：${item.text}`)
    .join('\n')
}

function pickLocalKnowledgeForPrompt(prompt, activeTab) {
  const query = `${prompt} ${workflowLabels[activeTab] || activeTab}`
  const normalizedQuery = query.toLowerCase()
  const rawTokens = normalizedQuery.match(/[\u4e00-\u9fa5]{2,}|[a-z0-9-]{2,}/gi) || []
  const gramTokens = rawTokens.flatMap((token) => {
    if (!/^[\u4e00-\u9fa5]+$/.test(token)) return [token]
    const grams = []
    for (let size = 2; size <= Math.min(4, token.length); size += 1) {
      for (let index = 0; index <= token.length - size; index += 1) {
        grams.push(token.slice(index, index + size))
      }
    }
    return grams
  })
  const queryTokens = Array.from(new Set([...rawTokens, ...gramTokens]))

  const matches = knowledgeBaseItems
    .map((item) => {
      const haystack = `${item.title} ${item.tag} ${item.text}`.toLowerCase()
      const directScore = [item.title, item.tag].some((value) => normalizedQuery.includes(String(value).toLowerCase())) ? 8 : 0
      const score = queryTokens.reduce((total, token) => (haystack.includes(token.toLowerCase()) ? total + 1 : total), directScore)
      return { ...item, score }
    })
    .sort((a, b) => b.score - a.score)

  const picked = matches.filter((item) => item.score > 0).slice(0, 3)
  return picked.length ? picked : knowledgeBaseItems.slice(0, 3)
}

export function createLocalAiFallbackReply({ prompt, activeTab, findings, depositResult, ragItems }) {
  const topFinding = findings[0]
  const knowledge = (Array.isArray(ragItems) && ragItems.length ? ragItems : pickLocalKnowledgeForPrompt(prompt, activeTab)).slice(0, 3)

  const riskLine = topFinding
    ? `当前最值得先处理的是“${topFinding.title}”，证据片段是“${compactText(topFinding.evidence, 72)}”。`
    : '当前页面没有明显高风险结论，但仍建议按材料、证据、沟通三个方向核对。'

  const moduleAction = {
    review: '先把合同里押金、维修、涨租、解除、入户和违约金条款逐条过一遍，优先修改会直接影响钱和居住安全的内容。',
    evidence: '先补齐押金付款、费用结清、交接照片、维修票据、聊天记录和钥匙交还记录，再和房东确认扣款明细。',
    checkin: '先拍墙面地板、门窗门锁、家具家电和水电燃气表读数，并把已有瑕疵发给房东或中介确认。',
    subsidy: '先确认城市、学历、社保、无房、劳动合同和申报入口，政策结果以官方最新页面和经办部门口径为准。',
    proposal: '先用首页四个入口演示完整链路：补贴匹配、租房审查、入住验房、退租证据包。',
  }[activeTab] || '先明确当前问题属于补贴、合同、入住验房还是退租押金，再进入对应模块处理。'

  return normalizeAiReplyText([
    '结论：当前模型暂时不可用，我先按本地知识库和当前页面数据给你可执行建议。',
    `重点风险：${riskLine}`,
    `建议动作：${moduleAction}`,
    `押金提醒：当前押金估算预计应退 ${formatMoney(depositResult.estimatedReturn)}。如对方要扣款，要求提供照片、维修清单、票据和扣款依据。`,
    `依据：${knowledge
      .map((item) => {
        const source = item.source || item.sourceName || '租小审内置知识库'
        const scope = item.scope ? `，适用范围：${item.scope}` : ''
        const updatedAt = item.updatedAt ? `，更新：${item.updatedAt}` : ''
        return `${item.title}（${source}${scope}${updatedAt}）：${item.text}`
      })
      .join('；')}`,
    '下一步：把对方要求、合同原文或扣款明细发给系统 AI，我会继续按证据和话术帮你拆解。',
  ].join('\n'))
}

export function normalizeAiReplyText(text) {
  const sectionPattern = aiReplySections.join('|')

  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1（$2）')
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[a-z]*|```/gi, '').trim())
    .replace(/^[ \t]*[-*_\u2014]{3,}[ \t]*$/gm, '')
    .replace(/^[ \t]{0,3}#{1,6}[ \t]*/gm, '')
    .replace(/^[ \t]*>[ \t]?/gm, '')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/~~([^~\n]+)~~/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/^[ \t]*[-*•]\s+/gm, '')
    .replace(new RegExp(`([。；;!?！？])\\s*(${sectionPattern})\\s*[：:]\\s*`, 'g'), '$1\n$2：')
    .replace(new RegExp(`(^|\\n)\\s*(${sectionPattern})\\s*[：:]\\s*`, 'g'), '$1$2：')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function formatAiMessageBlocks(content) {
  const normalized = normalizeAiReplyText(content)
  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (!lines.length) {
    return [{ title: '', lines: [{ marker: '', text: '暂无内容' }] }]
  }

  const blocks = []
  let current = { title: '', lines: [] }
  const sectionPattern = new RegExp(`^(${aiReplySections.join('|')})[：:]?\\s*(.*)$`)

  const flush = () => {
    if (current.title || current.lines.length) {
      blocks.push(current)
    }
  }

  lines.forEach((rawLine) => {
    const sectionMatch = rawLine.match(sectionPattern)
    if (sectionMatch) {
      flush()
      current = { title: sectionMatch[1], lines: [] }
      if (sectionMatch[2]) {
        current.lines.push({ marker: '', text: sectionMatch[2] })
      }
      return
    }

    const orderedMatch = rawLine.match(/^(\d+)[.、)]\s*(.+)$/)
    const cnOrderedMatch = rawLine.match(/^([一二三四五六七八九十]+)[.、)]\s*(.+)$/)
    if (orderedMatch) {
      current.lines.push({ marker: orderedMatch[1], text: orderedMatch[2] })
      return
    }
    if (cnOrderedMatch) {
      current.lines.push({ marker: cnOrderedMatch[1], text: cnOrderedMatch[2] })
      return
    }

    current.lines.push({ marker: '', text: rawLine })
  })

  flush()
  return blocks
}

export function buildRagSearchQuery({ prompt, activeTab, reviewText, findings }) {
  const riskText = findings
    .slice(0, 5)
    .map((finding) => `${finding.title} ${finding.evidence || ''}`)
    .join(' ')

  return compactText(
    [
      prompt,
      `当前模块：${workflowLabels[activeTab] || activeTab}`,
      `合同摘要：${reviewText || ''}`,
      `风险线索：${riskText}`,
    ].join('\n'),
    1400,
  )
}

export function buildRagContextPrompt(items) {
  const rows = Array.isArray(items) ? items : []
  if (!rows.length) {
    return `【知识库检索】未命中专门条目。可使用内置知识库回答：\n${buildLocalKnowledgeContext()}`
  }

  return [
    '【知识库检索命中】',
    ...rows.map((item, index) => {
      const source = item.source || item.sourceName || '租小审内置知识库'
      const url = item.sourceUrl ? `｜链接：${item.sourceUrl}` : ''
      const scope = item.scope ? `｜适用范围：${item.scope}` : ''
      const updatedAt = item.updatedAt ? `｜更新：${item.updatedAt}` : ''
      return `${index + 1}. ${item.title}（${item.tag || '知识'}）｜来源：${source}${scope}${updatedAt}${url}\n要点：${item.text}`
    }),
    '回答时必须在“依据”栏目引用这些命中标题；没有依据的判断要说明需要进一步核实。',
  ].join('\n')
}

export async function searchAiKnowledge(query, limit = 5) {
  try {
    const response = await fetch(`/api/rag/search?q=${encodeURIComponent(query)}&limit=${limit}`)
    const data = await response.json().catch(() => ({}))

    if (!response.ok || !Array.isArray(data.items)) {
      throw new Error(data?.message || '知识库检索失败')
    }

    return data.items
  } catch {
    return knowledgeBaseItems.slice(0, limit).map((item, index) => ({
      ...item,
      id: `local-knowledge-${index + 1}`,
      source: '租小审内置知识库',
      sourceUrl: '',
      score: 0,
    }))
  }
}


export function buildSystemAiContext({
  activeTab,
  reviewText,
  effectiveReviewProfile,
  findings,
  summary,
  acceptedIds,
  revisionItems,
  depositInputs,
  depositResult,
  reviewHistory,
}) {
  const evidenceState = loadEvidencePackState()
  const checkinState = loadCheckinInspectionState()
  const subsidyState = loadSubsidyMatcherState()
  const topFindings = findings.slice(0, 6).map((finding) => `${finding.levelText || finding.level}：${finding.title}｜证据：${compactText(finding.evidence, 90)}`)
  const acceptedCount = acceptedIds.size

  return [
    '【租小审系统上下文】',
    `当前模块：${workflowLabels[activeTab] || activeTab}`,
    `合同审查画像：${getContractTypeLabel(effectiveReviewProfile.contractType)}｜${partyRoleOptions.find((item) => item.value === effectiveReviewProfile.partyRole)?.label || effectiveReviewProfile.partyRole}｜${reviewDepthOptions.find((item) => item.value === effectiveReviewProfile.reviewDepth)?.label || effectiveReviewProfile.reviewDepth}`,
    `合同正文摘要：${compactText(reviewText || '暂无合同正文', 1200)}`,
    `风险概览：${summary.label}，评分 ${summary.score}/100，高风险 ${summary.highCount}，中风险 ${summary.mediumCount}，已采纳 ${acceptedCount}`,
    `主要风险：${topFindings.join('；') || '暂无明显风险'}`,
    `已采纳修改：${revisionItems.map((item) => item.title).join('；') || '暂无'}`,
    `押金估算：押金 ${depositInputs.depositAmount || '0'}，未结费用 ${depositInputs.unpaidFees || '0'}，维修扣款 ${depositInputs.repairCost || '0'}，保洁扣款 ${depositInputs.cleaningCost || '0'}，预计应退 ${formatMoney(depositResult.estimatedReturn)}，提示：${depositResult.warning}`,
    '【退租证据包】',
    getEvidenceContextSummary(evidenceState),
    '【入住验房】',
    getCheckinContextSummary(checkinState),
    '【补贴匹配】',
    getSubsidyContextSummary(subsidyState),
    `【审查历史】最近 ${reviewHistory.length} 条：${reviewHistory.slice(0, 3).map((item) => `${item.title}（${item.score}分，高风险${item.highCount}）`).join('；') || '暂无'}`,
  ].join('\n')
}
