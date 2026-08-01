const DATE_PATTERN = /\d{4}\s*[年./-]\s*\d{1,2}\s*[月./-]\s*\d{1,2}/
const MONEY_PATTERN = /\d+(?:\.\d+)?\s*元/

export function reviewContractOcrText(text) {
  const source = String(text || '')
  const warnings = []
  if (!source.trim()) return { ok: false, warnings: ['没有识别到合同正文，请重新拍摄或改用文件导入。'], requiresManualCheck: true }

  if (/(?:租赁期限|租赁时间|租期)/.test(source) && !DATE_PATTERN.test(source)) {
    warnings.push('租期附近没有识别到完整日期，请重点核对年份、月份和日期。')
  }
  if (/(?:月租金|租金|押金|违约金)/.test(source) && !MONEY_PATTERN.test(source)) {
    warnings.push('金额条款附近没有识别到“元”及数字，请重点核对租金、押金和违约金。')
  }
  if (/(?:进入|入户|带人看房|维修)/.test(source) && !/(?:不得|不应|禁止|须经|同意|提前通知)/.test(source)) {
    warnings.push('入户、维修或带看条款缺少明显的限制词，需人工核对是否漏识“不得/同意/提前通知”。')
  }

  return { ok: warnings.length === 0, warnings, requiresManualCheck: warnings.length > 0 }
}
