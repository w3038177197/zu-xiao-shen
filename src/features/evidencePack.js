import { CircleDollarSign, FileText, MessageSquareText, UploadCloud } from 'lucide-react'
import { STORAGE_KEYS } from '../constants/appConfig.js'
import { LEGAL_DISCLAIMER } from '../constants/legal.js'
import { compactText, formatEvidenceDate } from '../utils/text.js'

export const evidenceGroupMeta = {
  contract: {
    title: '合同文件',
    Icon: FileText,
    items: ['租赁合同原件或电子版', '押金收据或转账记录', '租金支付记录或银行流水'],
  },
  photos: {
    title: '房屋照片',
    Icon: UploadCloud,
    items: ['入住时房屋整体状况照片', '入住时家电家具状况照片', '退租时房屋整体状况照片', '退租时家电家具状况照片'],
  },
  chat: {
    title: '沟通记录',
    Icon: MessageSquareText,
    items: ['与房东或中介的聊天记录截图', '退租通知发送记录', '维修、押金、交接事项沟通记录'],
  },
  expense: {
    title: '费用凭证',
    Icon: CircleDollarSign,
    items: ['水电燃气缴费凭证', '物业费或宽带费缴纳凭证', '维修、保洁或其他费用凭证'],
  },
}

export const evidenceActions = [
  { title: '整理合同和押金凭证', desc: '把租赁合同、押金收据、租金支付记录统一保存。' },
  { title: '拍摄退租现状照片', desc: '覆盖客厅、卧室、厨房、卫生间、门锁、墙面和家电家具。' },
  { title: '导出沟通记录', desc: '重点保留退租通知、维修争议、押金扣款和交接时间确认。' },
  { title: '结清并留存费用凭证', desc: '水电燃气、物业、宽带等费用尽量取得账单或转账记录。' },
  { title: '预约现场交接', desc: '提前确认交接时间、在场人员、钥匙门禁卡数量和押金退还方式。' },
  { title: '发送押金退还说明', desc: '用书面方式发送，要求对方明确扣款依据和退还时间。' },
]

export const evidenceToolTabs = [
  { value: 'deposit', label: '押金退还' },
  { value: 'repair', label: '维修争议' },
  { value: 'handover', label: '退租交接' },
]

export const defaultEvidenceFormData = {
  address: '阳光花园3栋2单元601室',
  deposit: '3800',
  monthlyRent: '3800',
  landlordName: '',
  landlordPhone: '',
  checkinDate: '',
  checkoutDate: '',
  handoverDate: '',
  handoverTime: '',
  repairItem: '',
  repairCost: '',
  notes: '',
}

function createEmptyEvidenceState() {
  return Object.fromEntries(Object.entries(evidenceGroupMeta).map(([group, meta]) => [group, meta.items.map(() => false)]))
}

export function createDefaultEvidencePackState() {
  return {
    formData: defaultEvidenceFormData,
    evidence: createEmptyEvidenceState(),
    actions: evidenceActions.map(() => false),
    communicationText: '',
  }
}

export function normalizeEvidencePackState(savedState) {
  const defaults = createDefaultEvidencePackState()
  const savedEvidence = savedState?.evidence || {}

  return {
    formData: { ...defaults.formData, ...(savedState?.formData || {}) },
    evidence: Object.fromEntries(
      Object.entries(evidenceGroupMeta).map(([group, meta]) => {
        const savedGroup = Array.isArray(savedEvidence[group]) ? savedEvidence[group] : []
        return [group, meta.items.map((_, index) => Boolean(savedGroup[index]))]
      }),
    ),
    actions: evidenceActions.map((_, index) => Boolean(savedState?.actions?.[index])),
    communicationText: typeof savedState?.communicationText === 'string' ? savedState.communicationText : '',
  }
}

export function loadEvidencePackState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.evidencePack)
    return saved ? normalizeEvidencePackState(JSON.parse(saved)) : createDefaultEvidencePackState()
  } catch {
    return createDefaultEvidencePackState()
  }
}

export function buildEvidenceCommunication(type, formData) {
  const address = formData.address || 'XX小区XX栋XX室'
  const deposit = formData.deposit || 'XXXX'
  const checkin = formatEvidenceDate(formData.checkinDate)
  const checkout = formatEvidenceDate(formData.checkoutDate)
  const handoverDate = formatEvidenceDate(formData.handoverDate)
  const handoverTime = formData.handoverTime || '待协商'
  const repairItem = formData.repairItem || '房屋维修事项'
  const repairCost = formData.repairCost || '待确认'
  const notes = formData.notes || '房屋已按合同约定完成基础清洁，家电家具按现状交接。'

  if (type === 'repair') {
    return `尊敬的房东/中介：

您好。

关于${address}的${repairItem}，我已整理维修前后照片、沟通记录和费用凭证。当前维修费用为人民币${repairCost}元。

为便于核对，请您确认以下事项：
1. 该维修是否属于自然损耗、房屋老化或非承租人原因造成；
2. 如需从押金中扣除，请提供维修清单、照片、报价或有效票据；
3. 如属于出租方维修义务，请确认费用承担方式和处理时间。

我会配合合理核验，但不接受无凭证、无明细或将正常使用损耗直接从押金中扣除。

谢谢。`
  }

  if (type === 'handover') {
    return `尊敬的房东/中介：

您好。

我是${address}的承租人，计划于${handoverDate} ${handoverTime}办理退租交接。

交接时建议双方共同确认：
1. 房屋整体状况和重点设施状态；
2. 水、电、燃气、物业等费用结清情况；
3. 钥匙、门禁卡、遥控器等物品交还数量；
4. 押金退还金额、扣款依据和退还时间。

备注事项：${notes}

请您确认上述时间是否方便。如需调整，请回复可交接时间。`
  }

  return `尊敬的房东/中介：

您好。

我是${address}的承租人，入住时间为${checkin}，退租时间为${checkout}。根据租赁合同和实际交接情况，现申请退还押金人民币${deposit}元。

我已准备以下材料用于核对：
1. 租赁合同、押金收据或转账记录；
2. 入住和退租时房屋、家具、家电照片；
3. 水电燃气等费用结清凭证；
4. 与退租、维修、押金相关的沟通记录。

如您认为需要扣除押金，请提供明确扣款项目、金额、照片、维修清单和有效票据。正常使用损耗不应作为任意扣款依据。

请您在完成交接核对后确认押金退还安排。谢谢。`
}

export function createEvidencePackageText({ formData, evidence, actions, communicationText }) {
  const selectedLines = []
  const missingLines = []

  Object.entries(evidenceGroupMeta).forEach(([group, meta]) => {
    meta.items.forEach((item, index) => {
      const line = `${meta.title}：${item}`
      if (evidence[group][index]) {
        selectedLines.push(line)
      } else {
        missingLines.push(line)
      }
    })
  })

  const actionLines = evidenceActions.map((item, index) => `${actions[index] ? '[已完成]' : '[待完成]'} ${item.title}：${item.desc}`)

  return [
    '租小审 退租证据包摘要',
    `生成时间：${new Date().toLocaleString()}`,
    '',
    '一、退租基础信息',
    `房屋地址：${formData.address || '待填写'}`,
    `押金金额：${formData.deposit || '待填写'} 元`,
    `月租金：${formData.monthlyRent || '待填写'} 元`,
    `房东/中介：${formData.landlordName || '待填写'}`,
    `联系电话：${formData.landlordPhone || '待填写'}`,
    `入住日期：${formatEvidenceDate(formData.checkinDate)}`,
    `退租日期：${formatEvidenceDate(formData.checkoutDate)}`,
    `交接时间：${formatEvidenceDate(formData.handoverDate)} ${formData.handoverTime || ''}`.trim(),
    '',
    '二、已收集证据',
    selectedLines.length ? selectedLines.join('\n') : '暂无已勾选证据。',
    '',
    '三、待补齐证据',
    missingLines.length ? missingLines.join('\n') : '证据清单已全部勾选。',
    '',
    '四、下一步行动',
    actionLines.join('\n'),
    '',
    '五、沟通说明',
    communicationText || '尚未生成沟通说明。',
    '',
    LEGAL_DISCLAIMER,
  ].join('\n')
}

export function getEvidenceGapAdvice(evidenceStats, evidence) {
  const missingGroups = Object.entries(evidenceGroupMeta)
    .map(([group, meta]) => {
      const missingItems = meta.items.filter((_, index) => !evidence[group][index])
      return {
        group,
        title: meta.title,
        missingItems,
      }
    })
    .filter((item) => item.missingItems.length > 0)

  const firstMissing = missingGroups[0]?.missingItems[0] || '证据清单已完整'
  const summary = evidenceStats.percent >= 80
    ? '证据包已接近完整，可以进入交接和押金退还沟通。'
    : evidenceStats.percent >= 50
      ? '证据包已有基础材料，建议优先补齐照片和费用凭证。'
      : '证据链还比较薄，建议先补合同、押金凭证和退租照片。'

  return {
    summary,
    firstMissing,
    missingGroups,
  }
}

export function getEvidenceContextSummary(state) {
  const evidenceState = normalizeEvidencePackState(state)
  const values = Object.values(evidenceState.evidence).flat()
  const checked = values.filter(Boolean).length
  const total = values.length
  const percent = total ? Math.round((checked / total) * 100) : 0
  const missingGroups = Object.entries(evidenceGroupMeta)
    .map(([group, meta]) => {
      const missing = meta.items.filter((_, index) => !evidenceState.evidence[group][index])
      return missing.length ? `${meta.title}缺${missing.length}项` : ''
    })
    .filter(Boolean)

  return [
    `完整度：${percent}%（${checked}/${total}）`,
    `地址：${evidenceState.formData.address || '待填写'}`,
    `押金：${evidenceState.formData.deposit || '待填写'} 元，月租：${evidenceState.formData.monthlyRent || '待填写'} 元`,
    `退租/交接：${formatEvidenceDate(evidenceState.formData.checkoutDate)} / ${formatEvidenceDate(evidenceState.formData.handoverDate)} ${evidenceState.formData.handoverTime || ''}`.trim(),
    `缺口：${missingGroups.slice(0, 5).join('；') || '暂无明显缺口'}`,
    `沟通说明：${compactText(evidenceState.communicationText || '尚未生成', 260)}`,
  ].join('\n')
}
