import { aiReplySections } from '../shared/knowledgeBase.js'
import { analyzeContract, cleanContractTextForReview, getRiskSummary } from './contractReview.js'
import { getWorkflowContextLines, loadWorkflowContext } from './workflowContext.js'

function compactText(value, maxLength) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

function cleanAiDisplayLine(line) {
  return String(line || '')
    .replace(/\*\*/g, '')
    .replace(/[*#`_]/g, '')
    .replace(/^\s*[-*•]\s+/, '')
    .replace(/^\s*\d+[.)、]\s+/, '')
    .trim()
}

function isLandlordPrompt(prompt) {
  return /我是房东|作为房东|房东视角|房东怎么|房东收租|房东催告|房东验房|房东扣款|房东解约|房东合规/.test(prompt)
}

function actionAdvice(prompt) {
  if (isLandlordPrompt(prompt)) {
    if (/催告|逾期|解约/.test(prompt)) return '先书面催告给合理期限，再依法解除并留送达证明。'
    if (/扣款|扣押金/.test(prompt)) return '扣款需有项目、损失和票据，正常损耗不扣，建议当面核对。'
    if (/验房/.test(prompt)) return '与租客共同验房，记录表底和瑕疵，双方签字确认。'
    return '按合同收租开票据，代收需授权，水电费不得加价。'
  }
  if (/押金|扣款|保洁|退还/.test(prompt)) return '要求房东列明扣款项目、金额和票据；正常损耗不应扣。'
  if (/验房|照片|入住/.test(prompt)) return '拍全景、瑕疵近景和水电表读数，当天发给房东确认。'
  if (/补贴|毕业|社保|人才/.test(prompt)) return '先确认城市、学历、就业和社保，再按官网清单准备。'
  if (/解除|退租|违约|搬走/.test(prompt)) return '核对解约和违约金条款，书面通知，确认押金和交接。'
  if (/合同|条款|签|涨租|维修|入户/.test(prompt)) return '优先核对押金、涨租、维修、解约和费用凭证条款。'
  return '先确认租房阶段，再准备合同、付款凭证和沟通记录。'
}

function answerConclusion(prompt) {
  if (isLandlordPrompt(prompt)) {
    if (/催告|逾期|解约/.test(prompt)) return '房东合规路径：先催告、再解除，严禁换锁断水断电。'
    if (/扣款|扣押金/.test(prompt)) return '房东扣款须有证据链，正常损耗不得扣，无凭证不得扣。'
    if (/验房/.test(prompt)) return '房东验房核心是共同确认、签字留证，避免事后争议。'
    return '房东收租应按合同留痕开票，不得加价或巧立名目。'
  }
  if (/押金|扣款|保洁|退还/.test(prompt)) return '先别接受口头扣款，应同时核对合同、实际损失和凭证。'
  if (/验房|照片|入住|瑕疵/.test(prompt)) return '验房关键是让位置、问题、时间和双方确认对得上。'
  if (/补贴|毕业|社保|人才|学历/.test(prompt)) return '本地匹配只是初筛，最终以官方最新条件和审核为准。'
  if (/解除|退租|违约|搬走/.test(prompt)) return '先固定通知、交接和费用证据，再协商解除和押金结算。'
  if (/合同|条款|签|涨租|维修|入户/.test(prompt)) return '先找到具体条款对应的权利义务和违约后果，再决定。'
  return '先明确租房阶段和争议事实，再用合同和凭证交叉核对。'
}

function buildContextRisk(prompt, context) {
  const { review, checkin, evidence, subsidy } = context
  const topFinding = review?.findings?.[0]
  const contractRisk = review?.summary && topFinding
    ? `当前合同评分 ${review.summary.score}/100（${review.summary.label}），优先处理「${topFinding.title}」。`
    : ''
  if (isLandlordPrompt(prompt)) {
    if (/验房/.test(prompt)) {
      return '房东视角：入住和退租都要与租客共同验房并签字，否则扣款容易被推翻。'
    }
    if (/扣款|扣押金/.test(prompt)) {
      return '房东视角：扣款须有照片、维修清单和票据，正常损耗不得扣，扩大扣减有被反诉风险。'
    }
    if (/催告|逾期|解约/.test(prompt)) {
      return '房东视角：未催告直接换锁收房可能承担民事甚至刑事责任，合法解约需书面通知留证。'
    }
    return '房东视角：合规收租、开票留痕是基础，代收需授权，加价水电费违规。'
  }
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
  if (isLandlordPrompt(prompt)) {
    if (/催告|逾期|解约/.test(prompt)) {
      return '保留催告记录、解约通知送达证明和交接清单，租客拒不腾退应通过诉讼解决。'
    }
    if (/扣款|扣押金/.test(prompt)) {
      return '退租时与租客当面核对并书面确认扣款明细，避免事后争议。'
    }
    return '把合同条款、租客违约事实和已留证据发来，我帮你判断合规处理路径。'
  }
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
        isLocalAnalysis: true,
      },
    }
  } catch {
    return context
  }
}

export function buildLocalReply({ prompt, context, contractText, findings = [], summary = null }) {
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
      '你好，我可以帮你看合同、验房、退租证据和补贴线索。',
      contextLines.length ? `已读到本机资料：${contextLines.join('；')}。` : '目前还没有关联资料，也可以直接问。',
      '联网不可用时会自动用本地分析。',
    ].join('\n')
  }
  const conclusion = answerConclusion(prompt)
  const contextRisk = buildContextRisk(prompt, resolvedContext)
  const action = actionAdvice(prompt)
  const nextStep = buildNextStep(prompt, resolvedContext)
  return [
    `${conclusion} ${contextRisk}`,
    `现在先做：${action} ${nextStep} 仅供参考，具体责任或资格以合同、证据和官方最新口径为准。`,
  ].join('\n')
}

export function formatMessageBlocks(content) {
  const lines = String(content || '').split('\n').map(cleanAiDisplayLine).filter(Boolean)
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
