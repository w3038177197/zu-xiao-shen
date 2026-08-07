function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function splitClauses(text) {
  return String(text || '').split(/[，。；;\n]/).map((item) => item.trim()).filter(Boolean)
}

function toYuan(raw) {
  const text = String(raw || '').replace(/,/g, '')
  const match = text.match(/(\d+(?:\.\d+)?)(\s*万)?/)
  if (!match) return ''
  const amount = Number(match[1]) * (match[2] ? 10000 : 1)
  if (!Number.isFinite(amount) || amount <= 0) return ''
  return String(Math.round(amount))
}

function toDate(raw) {
  const text = String(raw || '').trim()
  const match = text.match(/(20\d{2})[年\-/.](\d{1,2})[月\-/.](\d{1,2})/)
  if (!match) return ''
  return match[1] + '-' + String(match[2]).padStart(2, '0') + '-' + String(match[3]).padStart(2, '0')
}

function findTextAfter(text, patterns, maxLength = 40) {
  for (const pattern of patterns) {
    const value = String(text || '').match(pattern)?.[1]?.trim()
    if (value) return value.replace(/[，。；;：:\s]+$/g, '').slice(0, maxLength)
  }
  return ''
}

function findDateAfter(text, labels) {
  const source = String(text || '')
  for (const label of labels) {
    const match = source.match(new RegExp(label + '[^20\\d]{0,20}((?:20\\d{2})[年\\-/.]\\d{1,2}[月\\-/.]\\d{1,2})'))
    const date = toDate(match?.[1])
    if (date) return date
  }
  return ''
}

function findLeaseDates(text) {
  const source = String(text || '')
  const match = source.match(/(?:租期|租赁期限|租赁期)[\s\S]{0,30}?(?:自|从)?\s*((?:20\d{2})[年\-/.]\d{1,2}[月\-/.]\d{1,2})[\s\S]{0,20}?(?:至|到|止于|截止至)\s*((?:20\d{2})[年\-/.]\d{1,2}[月\-/.]\d{1,2})/)
  return { start: toDate(match?.[1]), end: toDate(match?.[2]) }
}

function findTimeAfter(text, labels) {
  const source = String(text || '')
  for (const label of labels) {
    const match = source.match(new RegExp(label + '[^\\d]{0,20}(\\d{1,2})[:：时点](\\d{1,2})?'))
    if (!match) continue
    const hour = Math.min(23, Number(match[1]))
    const minute = Math.min(59, Number(match[2] || 0))
    if (Number.isFinite(hour) && Number.isFinite(minute)) return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0')
  }
  return ''
}

function findMoney(text, labels, { min = 100 } = {}) {
  const clauses = splitClauses(text)
  const labelPattern = new RegExp(labels.join('|'))
  const patterns = [
    /(?:为|是|人民币|金额|金为|金：|金:)?\s*((?:\d+(?:\.\d+)?)(?:\s*万)?)(?:元|块|人民币)/,
    /(?:为|是|人民币|金额|金为|金：|金:)?\s*((?:\d+(?:\.\d+)?)(?:\s*万)?)/,
  ]
  for (const clause of clauses) {
    if (!labelPattern.test(clause)) continue
    for (const pattern of patterns) {
      const match = clause.match(pattern)
      const amount = toYuan(match?.[1] || match?.[0])
      if (amount && Number(amount) >= min) return amount
    }
  }
  for (const pattern of labels.map((label) => new RegExp(label + '[^\\d，。；;\\n]{0,16}((?:\\d+(?:\\.\\d+)?)(?:\\s*万)?)(?:元|块|人民币)?'))) {
    const match = text.match(pattern)
    const amount = toYuan(match?.[1] || match?.[0])
    if (amount && Number(amount) >= min) return amount
  }
  return ''
}

export function createBasicInfoAiPrompt(contractText) {
  const source = String(contractText || '').replace(/\r\n?/g, '\n').trim().slice(0, 3_200)
  return [
    '请只从下面的租房合同正文中提取退租证据包基本信息。',
    '只返回 JSON，不要解释，不要 Markdown。',
    'JSON 字段固定为：{"address":"","deposit":"","monthlyRent":"","landlordName":"","landlordPhone":"","checkinDate":"","checkoutDate":"","handoverDate":"","handoverTime":""}。',
    'address 填房屋地址；deposit 和 monthlyRent 只填阿拉伯数字金额，单位为元。',
    'landlordName 填甲方/出租方/房东/中介名称；landlordPhone 填联系电话。',
    '日期统一 YYYY-MM-DD；handoverTime 统一 HH:mm。',
    '无法确定的字段填空字符串。',
    '',
    '合同正文：',
    source,
  ].join('\n')
}

export function parseBasicInfoFromAiReply(reply) {
  const text = String(reply || '').trim()
  const jsonText = text.match(/\{[\s\S]*\}/)?.[0] || ''
  if (!jsonText) return parseBasicInfoFromContract('')
  try {
    const value = JSON.parse(jsonText)
    return {
      address: String(value?.address || '').trim().slice(0, 120),
      deposit: toYuan(value?.deposit),
      monthlyRent: toYuan(value?.monthlyRent),
      landlordName: String(value?.landlordName || '').trim().slice(0, 40),
      landlordPhone: String(value?.landlordPhone || '').replace(/\D/g, '').slice(0, 11),
      checkinDate: toDate(value?.checkinDate),
      checkoutDate: toDate(value?.checkoutDate),
      handoverDate: toDate(value?.handoverDate),
      handoverTime: findTimeAfter(String(value?.handoverTime || ''), ['^']),
    }
  } catch {
    return parseBasicInfoFromContract('')
  }
}

export function parseBasicInfoFromContract(text) {
  const normalized = normalizeText(text)
  const empty = { address: '', deposit: '', monthlyRent: '', landlordName: '', landlordPhone: '', checkinDate: '', checkoutDate: '', handoverDate: '', handoverTime: '' }
  if (!normalized) return empty

  const addressPatterns = [
    /坐落于\s*([^，。；;\n]{4,80}?)(?:的房屋|房屋|出租|，|。|；|;)/,
    /房屋(?:坐落|地址|位于|位置)[:：为\s]*([^，。；;\n]{4,80})/,
    /(?:租赁|出租)房屋[:：为\s]*([^，。；;\n]{4,80})/,
  ]
  const address = (addressPatterns.map((pattern) => normalized.match(pattern)?.[1]?.trim()).find(Boolean) || '')

  const deposit = findMoney(text, ['押金', '保证金'])

  const monthlyRent = findMoney(text, ['月租金', '每月租金', '租金标准', '租金'])

  const leaseDates = findLeaseDates(text)
  const landlordName = findTextAfter(text, [
    /(?:出租方|出租人|甲方|房东|中介)(?:（[^）]+）)?[:：\s]*([^\n，。；;、]{2,40})/,
  ])
  const landlordPhone = String(text || '').match(/(?<!\d)1[3-9]\d{9}(?!\d)/)?.[0] || ''
  const checkinDate = findDateAfter(text, ['入住日期', '入住时间', '交付日期', '交房日期', '房屋交付']) || leaseDates.start
  const checkoutDate = findDateAfter(text, ['退租日期', '退租时间', '合同到期', '租期届满', '租赁期限届满']) || leaseDates.end
  const handoverDate = findDateAfter(text, ['交接日期', '交接时间', '验收日期', '退房交接']) || checkoutDate
  const handoverTime = findTimeAfter(text, ['交接时间', '交接时点', '验收时间', '退房交接'])

  return { ...empty, address, deposit, monthlyRent, landlordName, landlordPhone, checkinDate, checkoutDate, handoverDate, handoverTime }
}
