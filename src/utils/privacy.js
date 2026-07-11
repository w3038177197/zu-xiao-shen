const phonePattern = /(?<!\d)1[3-9]\d{9}(?!\d)/g
const idCardPattern = /(?<!\d)\d{17}[\dXx](?!\d)/g
const bankCardPattern = /(?<!\d)\d{16,19}(?!\d)/g
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi

export function redactSensitiveText(value) {
  return String(value || '')
    .replace(phonePattern, '[手机号已脱敏]')
    .replace(idCardPattern, '[身份证号已脱敏]')
    .replace(bankCardPattern, '[银行卡号已脱敏]')
    .replace(emailPattern, '[邮箱已脱敏]')
}
