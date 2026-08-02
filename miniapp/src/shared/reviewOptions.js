export const contractTypeOptions = [
  { value: 'auto', label: '自动识别' },
  { value: 'service', label: '服务 / 外包合同' },
  { value: 'purchase', label: '采购 / 供货合同' },
  { value: 'lease', label: '房屋租赁合同' },
  { value: 'employment', label: '劳动 / 劳务合同' },
  { value: 'cooperation', label: '合作协议' },
]

export const partyRoleOptions = [
  { value: 'neutral', label: '中立评估' },
  { value: 'partyA', label: '我方是甲方' },
  { value: 'partyB', label: '我方是租客' },
]

export const reviewDepthOptions = [
  { value: 'balanced', label: '标准', desc: '显示高、中风险，适合日常签约前检查' },
  { value: 'strict', label: '严格风控', desc: '显示高、中、低风险，并完整提示缺失和矛盾' },
  { value: 'business', label: '宽松友好', desc: '只显示高风险和签署阻断项' },
]
