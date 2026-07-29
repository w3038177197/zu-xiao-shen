export function createRemoteAiRequestId(now = Date.now(), random = Math.random()) {
  const randomPart = Math.floor(Math.max(0, Math.min(Number(random) || 0, 0.999999999)) * 1_000_000_000)
    .toString(36)
    .padStart(6, '0')
  return `zxs_${Number(now).toString(36)}_${randomPart}`
}

export const REMOTE_CONTEXT_MODULES = [
  { key: 'review', label: '合同审查' },
  { key: 'checkin', label: '入住验房' },
  { key: 'evidence', label: '证据包' },
  { key: 'subsidy', label: '补贴匹配' },
]

const AI_TASK_TTL_MS = 10 * 60 * 1000

export const AI_TASK_PRESETS = {
  review: {
    label: '解读审查结果',
    prompt: '请结合当前合同审查结果，优先解释高风险条款的含义和影响，给出条款修改建议，并生成可直接与房东或中介协商的修改文本。AI 只会看到审查摘要和风险点，不会看到完整合同正文。',
    modules: ['review'],
  },
  checkin: {
    label: '解读验房记录',
    prompt: '请结合当前入住验房的文字记录和瑕疵描述，提醒记录是否仍不完整，并根据已有文字瑕疵生成发给房东确认的简短话术。AI 只会看到验房统计和瑕疵文字，不会看到照片内容，也无法判断损坏程度或照片清晰度。',
    modules: ['checkin'],
  },
  evidence: {
    label: '证据缺口检查',
    prompt: '请结合当前退租证据包，找出最重要的证据缺口，给出可执行的补证顺序，并生成克制、清楚、可直接发送的沟通文本。',
    modules: ['evidence'],
  },
  subsidy: {
    label: '补贴结果解释',
    prompt: '请结合当前补贴匹配结果，解释待确认和不满足的条件，列出下一步需要核对的材料与官方渠道。资格结论必须以官方政策为准。',
    modules: ['subsidy'],
  },
}

export function createAiTaskHandoff(taskKey, now = Date.now()) {
  const preset = AI_TASK_PRESETS[taskKey]
  if (!preset) return null
  return { version: 1, taskKey, createdAt: Number(now), ...preset, modules: [...preset.modules] }
}

export function normalizeAiTaskHandoff(value, now = Date.now()) {
  const preset = value && AI_TASK_PRESETS[value.taskKey]
  const createdAt = Number(value?.createdAt)
  if (!preset || !Number.isFinite(createdAt) || createdAt <= 0 || Number(now) - createdAt > AI_TASK_TTL_MS) return null
  return createAiTaskHandoff(value.taskKey, createdAt)
}

// 小程序需兼容较旧的 JSCore，避免使用正则 lookbehind。
const PHONE_PATTERN = /1[3-9]\d{9}/g
const ID_CARD_PATTERN = /(?:\d{17}[0-9Xx]|\d{15})/g
const BANK_CARD_PATTERN = /(?:\d[ -]?){15,18}\d/g
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const LABELED_NAME_PATTERN = /((?:姓名|房东|出租人|承租人|联系人)\s*[：:]\s*)[\p{Script=Han}·]{2,8}/gu
const LABELED_ADDRESS_PATTERN = /((?:住址|地址|房屋地址|租赁地址)\s*[：:]\s*)[^\n，。;；]{4,100}/gu

function compact(value, maxLength = 240) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

export function redactRemoteContext(value) {
  return String(value || '')
    .replace(EMAIL_PATTERN, '[已隐藏邮箱]')
    .replace(ID_CARD_PATTERN, '[已隐藏身份证号]')
    .replace(BANK_CARD_PATTERN, '[已隐藏银行卡号]')
    .replace(PHONE_PATTERN, '[已隐藏手机号]')
    .replace(LABELED_NAME_PATTERN, '$1[已隐藏姓名]')
    .replace(LABELED_ADDRESS_PATTERN, '$1[已隐藏地址]')
}

export function getAvailableRemoteContextModules(context) {
  return REMOTE_CONTEXT_MODULES.filter(({ key }) => {
    if (key === 'review') return Boolean(context?.review?.hasDraft)
    return Boolean(context?.[key]?.hasData)
  })
}

function buildReviewLines(context) {
  const review = context?.review
  if (!review?.hasDraft) return []
  const lines = [review.isCurrent
    ? `合同评分 ${review.summary?.score ?? 0} 分，共 ${review.findings?.length || 0} 个风险点。`
    : '已有合同正文，但当前版本尚未审查。']
  if (review.isCurrent) {
    review.findings?.slice(0, 8).forEach((finding, index) => {
      const evidence = compact(finding?.evidence || finding?.original || finding?.replaceFrom, 180)
      const suggestion = compact(finding?.suggestion || finding?.action || finding?.recommendation, 160)
      lines.push(`${index + 1}. ${compact(finding?.title || finding?.name || '合同风险', 80)}${finding?.severity ? `（${compact(finding.severity, 16)}）` : ''}${evidence ? `；相关原文：${evidence}` : ''}${suggestion ? `；建议：${suggestion}` : ''}`)
    })
  }
  return lines
}

function buildCheckinLines(context) {
  const checkin = context?.checkin
  if (!checkin?.hasData) return []
  const stats = checkin.stats || {}
  const lines = [`已检查 ${stats.checked || 0}/${stats.total || 0} 项，记录 ${stats.defects || 0} 处瑕疵、${stats.photos || 0} 张照片。`]
  checkin.defects?.slice(0, 10).forEach((item, index) => {
    lines.push(`${index + 1}. ${compact(item?.roomLabel || item?.room || '房间', 30)}·${compact(item?.itemLabel || item?.item || '检查项', 40)}：${compact(item?.note || item?.description || item?.status || '已标记瑕疵', 160)}`)
  })
  return lines
}

function buildEvidenceLines(context) {
  const evidence = context?.evidence
  if (!evidence?.hasData) return []
  const lines = [`共 ${evidence.attachmentStats?.total || 0} 个附件，清单完成 ${evidence.checklist?.checked || 0}/${evidence.checklist?.total || 0}${evidence.deposit ? `，押金 ${compact(evidence.deposit, 30)} 元` : ''}。`]
  evidence.groups?.forEach((group) => {
    if (!group.attachmentCount && !group.checkedItems?.length && !group.missingItems?.length) return
    const missing = group.missingItems?.slice(0, 4).map((item) => compact(item, 50)).join('、')
    const names = group.attachmentNames?.slice(0, 4).map((item) => compact(item, 50)).join('、')
    lines.push(`${compact(group.title, 40)}：${group.attachmentCount || 0} 个附件${names ? `（${names}）` : ''}${missing ? `；待补：${missing}` : '；清单已勾选完整'}`)
  })
  return lines
}

function buildSubsidyLines(context) {
  const subsidy = context?.subsidy
  if (!subsidy?.hasData) return []
  return [`城市 ${compact(subsidy.city || '未选择', 30)}，共 ${subsidy.total || 0} 条政策线索：满足 ${subsidy.satisfied || 0}、待确认 ${subsidy.pending || 0}、不满足 ${subsidy.unsatisfied || 0}。`]
}

export function buildRemoteContextSections(context, selectedModules) {
  const selected = new Set(Array.isArray(selectedModules) ? selectedModules : [])
  const sections = []
  const builders = {
    review: buildReviewLines,
    checkin: buildCheckinLines,
    evidence: buildEvidenceLines,
    subsidy: buildSubsidyLines,
  }
  REMOTE_CONTEXT_MODULES.forEach(({ key, label }) => {
    if (!selected.has(key)) return
    const lines = builders[key](context)
    if (lines.length) sections.push({ key, label, lines })
  })
  return sections
}

export function getRemoteContextSummary(context, selectedModules = getAvailableRemoteContextModules(context).map((item) => item.key)) {
  const text = buildRemoteContextSections(context, selectedModules)
    .map((section) => `【${section.label}】\n${section.lines.join('\n')}`)
    .join('\n\n')
  return redactRemoteContext(text).slice(0, 6_000)
}

export function getRemoteContextPreview(context, selectedModules) {
  return getRemoteContextSummary(context, selectedModules) || '本次未选择任何本机资料，只会发送当前问题。'
}

export function getRemoteContextSummaryLegacy(context) {
  const lines = []
  if (context?.review?.hasDraft) {
    lines.push(context.review.isCurrent
      ? `合同：${context.review.summary?.score ?? 0} 分，${context.review.findings?.length || 0} 个风险点`
      : '合同：已有正文，尚未完成审查')
  }
  if (context?.checkin?.hasData) {
    const stats = context.checkin.stats || {}
    lines.push(`验房：${stats.checked || 0}/${stats.total || 0} 项，${stats.defects || 0} 处瑕疵，${stats.photos || 0} 张照片`)
  }
  if (context?.evidence?.hasData) {
    lines.push(`证据包：${context.evidence.attachmentStats?.total || 0} 个附件，清单 ${context.evidence.checklist?.checked || 0}/${context.evidence.checklist?.total || 0}`)
  }
  if (context?.subsidy?.hasData) {
    lines.push(`补贴：${context.subsidy.city || '未选城市'}，${context.subsidy.total || 0} 条政策线索`)
  }
  return lines.join('；').slice(0, 2_000)
}

function compactMessage(message) {
  const role = message?.role === 'assistant' ? 'assistant' : 'user'
  const content = String(message?.content || '').replace(/\s+/g, ' ').trim().slice(0, 1_200)
  return content ? { role, content } : null
}

export function buildRemoteAiPayload({
  prompt,
  messages = [],
  context,
  includeContext = false,
  selectedModules,
  requestId = createRemoteAiRequestId(),
}) {
  const safePrompt = String(prompt || '').trim().slice(0, 4_000)
  const history = messages
    .slice(-8)
    .map(compactMessage)
    .filter(Boolean)
    .slice(-6)

  return {
    requestId,
    prompt: safePrompt,
    history,
    contextSummary: Array.isArray(selectedModules)
      ? getRemoteContextSummary(context, selectedModules)
      : includeContext ? getRemoteContextSummary(context) : '',
  }
}

export function normalizeRemoteAiResponse(value) {
  const reply = typeof value?.reply === 'string' ? value.reply.trim() : ''
  if (!value?.ok || !reply) throw new Error('联网 AI 没有返回有效内容')
  return {
    requestId: String(value.requestId || ''),
    reply,
    citations: Array.isArray(value.citations) ? value.citations.slice(0, 4) : [],
    quota: value.quota || null,
    notice: String(value.notice || '内容由 AI 生成，仅供参考。'),
    replayed: Boolean(value.replayed),
  }
}
