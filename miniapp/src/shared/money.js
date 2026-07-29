export function parseMoney(value) {
  const amount = Number(String(value).replace(/[^\d.]/g, ''))
  return Number.isFinite(amount) ? amount : 0
}

export function formatMoney(value) {
  return `${Math.max(0, Math.round(value)).toLocaleString('zh-CN')} 元`
}

export function calculateDepositReturn(inputs) {
  const depositAmount = parseMoney(inputs.depositAmount)
  const unpaidFees = parseMoney(inputs.unpaidFees)
  const repairCost = parseMoney(inputs.repairCost)
  const cleaningCost = parseMoney(inputs.cleaningCost)
  const hasVoucher = inputs.hasVoucher === 'yes'
  const normalWear = inputs.normalWear === 'yes'
  const documentedDamageDeduction = hasVoucher && !normalWear ? repairCost + cleaningCost : 0
  const totalDeduction = Math.min(depositAmount, unpaidFees + documentedDamageDeduction)
  const estimatedReturn = Math.max(0, depositAmount - totalDeduction)
  const warning = !hasVoucher && (repairCost > 0 || cleaningCost > 0)
    ? '房东未提供票据时，维修和保洁扣款建议要求照片、清单和发票。'
    : normalWear
      ? '正常使用损耗通常不应从押金中随意扣除。'
      : '存在非正常损坏且有凭证时，可按实际损失协商扣除。'

  return {
    estimatedReturn,
    totalDeduction,
    warning,
  }
}
