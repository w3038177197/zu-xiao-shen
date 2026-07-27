import { aiReplySections, knowledgeBaseItems } from '../../../src/data/knowledgeBase.js'

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

export function buildLocalReply({ prompt, contractText, findings = [], summary = null }) {
  const knowledge = pickKnowledge(prompt)
  const topFinding = findings[0]
  const risk = summary && topFinding
    ? `当前合同评分 ${summary.score}/100（${summary.label}），共 ${findings.length} 个风险点。优先处理「${topFinding.title}」，合同证据为「${compactText(topFinding.evidence || topFinding.explain, 72)}」。`
    : contractText
      ? '已关联合同正文，但还没有可用审查结果，建议先到合同审查页运行本地审查。'
      : '当前未关联合同，可以先粘贴合同，或直接发送具体条款。'
  return [
    `结论：${actionAdvice(prompt)}`,
    `重点风险：${risk}`,
    `建议动作：${actionAdvice(prompt)}`,
    `依据：${knowledge.map((item) => `${item.title}（${item.source || '租小审内置知识库'}）`).join('；')}`,
    '下一步：发送对方的具体要求、合同原文或扣款明细，我会继续按证据和沟通话术拆解。政策与法规请以官方最新口径为准。',
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
