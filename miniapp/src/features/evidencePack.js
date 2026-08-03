import Taro from '@tarojs/taro'
import { STORAGE_KEYS } from '../constants/appConfig.js'

const LEGACY_STORAGE_KEY = 'evidence_pack_data'

export const evidenceGroupMeta = {
  contract: {
    title: '合同文件',
    items: ['租赁合同原件或电子版', '押金收据或转账记录', '租金支付记录或银行流水'],
  },
  photos: {
    title: '房屋照片',
    items: ['入住时房屋整体状况照片', '入住时家电家具状况照片', '退租时房屋整体状况照片', '退租时家电家具状况照片'],
  },
  chat: {
    title: '沟通记录',
    items: ['与房东或中介的聊天记录截图', '退租通知发送记录', '维修、押金、交接事项沟通记录'],
  },
  expense: {
    title: '费用凭证',
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
  address: '',
  deposit: '',
  monthlyRent: '',
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
  const state = {}
  Object.entries(evidenceGroupMeta).forEach(([group, meta]) => {
    state[group] = meta.items.map(() => false)
  })
  return state
}

function createEmptyAttachments() {
  const attachments = {}
  Object.keys(evidenceGroupMeta).forEach((group) => {
    attachments[group] = []
  })
  return attachments
}

function isValidAttachment(item) {
  if (!item || typeof item !== 'object') return false
  if (typeof item.id !== 'string' || !item.id) return false
  // 真实附件需要 localPath；模块引用的文本类附件允许只有 textContent
  const hasLocalPath = typeof item.localPath === 'string' && item.localPath
  const hasTextContent = typeof item.textContent === 'string' && item.textContent
  return Boolean(hasLocalPath || hasTextContent)
}

function normalizeAttachment(item) {
  if (!isValidAttachment(item)) return null
  const fileName = typeof item.fileName === 'string' && item.fileName
    ? item.fileName
    : item.fileType === 'image' ? '图片附件' : '证据附件'
  const fileType = item.fileType === 'image' || item.fileType === 'file'
    ? item.fileType
    : /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName) ? 'image' : 'file'

  return {
    ...item,
    fileName,
    fileType,
    source: typeof item.source === 'string' && item.source ? item.source : 'unknown',
    size: Number.isFinite(Number(item.size)) ? Number(item.size) : 0,
    createdAt: typeof item.createdAt === 'string' && item.createdAt ? item.createdAt : new Date().toISOString(),
  }
}

// 兼容旧记录：旧 state 没有 attachments 字段，补全为空数组，不破坏已有 evidence 勾选
export function normalizeAttachments(savedAttachments) {
  const attachments = {}
  Object.keys(evidenceGroupMeta).forEach((group) => {
    const list = savedAttachments?.[group]
    attachments[group] = Array.isArray(list) ? list.map(normalizeAttachment).filter(Boolean) : []
  })
  return attachments
}

export function createDefaultEvidencePackState() {
  return {
    formData: { ...defaultEvidenceFormData },
    evidence: createEmptyEvidenceState(),
    attachments: createEmptyAttachments(),
    actions: evidenceActions.map(() => false),
    communicationText: '',
  }
}

export function normalizeEvidencePackState(savedState) {
  const defaults = createDefaultEvidencePackState()
  const savedEvidence = savedState?.evidence || {}
  const savedFormData = savedState?.formData && typeof savedState.formData === 'object' ? savedState.formData : {}

  const formData = {}
  Object.entries(defaults.formData).forEach(([field, defaultValue]) => {
    formData[field] = typeof savedFormData[field] === 'string' ? savedFormData[field] : defaultValue
  })

  const evidence = {}
  Object.entries(evidenceGroupMeta).forEach(([group, meta]) => {
    const savedGroup = Array.isArray(savedEvidence[group]) ? savedEvidence[group] : []
    evidence[group] = meta.items.map((_, index) => Boolean(savedGroup[index]))
  })

  return {
    formData,
    evidence,
    attachments: normalizeAttachments(savedState?.attachments),
    actions: evidenceActions.map((_, index) => Boolean(savedState?.actions?.[index])),
    communicationText: typeof savedState?.communicationText === 'string' ? savedState.communicationText : '',
  }
}

// 新增附件到指定组，返回新 state（不修改原 state）
export function addAttachment(state, group, attachment) {
  if (!evidenceGroupMeta[group] || !isValidAttachment(attachment)) return state
  const attachments = { ...state.attachments }
  attachments[group] = [...(attachments[group] || []), attachment]
  return { ...state, attachments }
}

// 删除指定组的某个附件，返回新 state（不修改原 state，不删除持久化文件）
export function removeAttachment(state, group, attachmentId) {
  const list = state.attachments?.[group]
  if (!Array.isArray(list)) return state
  const attachments = { ...state.attachments }
  attachments[group] = list.filter((item) => item.id !== attachmentId)
  return { ...state, attachments }
}

// 判断指定组是否已存在某模块引用（按来源模块 + 来源路径去重）
export function hasModuleReference(state, group, sourceModule, sourcePath) {
  const list = state?.attachments?.[group] || []
  return list.some((item) =>
    item && item.source === 'module'
    && item.sourceModule === sourceModule
    && item.sourcePath === sourcePath,
  )
}

// 添加模块引用附件：按 sourceModule + sourcePath 去重，已存在则返回原 state
export function addModuleReference(state, group, refAttachment) {
  if (!evidenceGroupMeta[group] || !isValidAttachment(refAttachment)) return state
  if (refAttachment.source !== 'module') return addAttachment(state, group, refAttachment)
  if (hasModuleReference(state, group, refAttachment.sourceModule, refAttachment.sourcePath)) {
    return state
  }
  return addAttachment(state, group, refAttachment)
}

// 批量导入模块引用：返回 { state, added, skipped }
export function importModuleReferences(state, group, refAttachments) {
  if (!Array.isArray(refAttachments) || !refAttachments.length) {
    return { state, added: 0, skipped: 0 }
  }
  let next = state
  let added = 0
  let skipped = 0
  refAttachments.forEach((ref) => {
    if (!ref || ref.source !== 'module' || !isValidAttachment(ref)) {
      skipped += 1
      return
    }
    if (hasModuleReference(next, group, ref.sourceModule, ref.sourcePath)) {
      skipped += 1
      return
    }
    next = addAttachment(next, group, ref)
    added += 1
  })
  return { state: next, added, skipped }
}

export function getGroupAttachments(state, group) {
  const list = state?.attachments?.[group]
  return Array.isArray(list) ? list.map(normalizeAttachment).filter(Boolean) : []
}

// 统计真实附件数量，按组和总计
export function getAttachmentStats(state) {
  const byGroup = {}
  let total = 0
  Object.keys(evidenceGroupMeta).forEach((group) => {
    const count = (state?.attachments?.[group] || []).length
    byGroup[group] = count
    total += count
  })
  return { byGroup, total }
}

export function loadEvidencePackState() {
  try {
    const saved = Taro.getStorageSync(STORAGE_KEYS.evidencePack) || Taro.getStorageSync(LEGACY_STORAGE_KEY)
    return saved ? normalizeEvidencePackState(JSON.parse(saved)) : createDefaultEvidencePackState()
  } catch {
    return createDefaultEvidencePackState()
  }
}

export function saveEvidencePackState(state) {
  try {
    Taro.setStorageSync(STORAGE_KEYS.evidencePack, JSON.stringify(normalizeEvidencePackState(state)))
    return true
  } catch {
    return false
  }
}

export function formatEvidenceDate(value) {
  if (!value) return '待确认'
  return value
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
    return [
      '您好，关于' + address + '的' + repairItem + '，我这边已经把维修前后照片、沟通记录和费用凭证整理好了，当前费用是 ' + repairCost + ' 元。',
      '麻烦您一起核对一下：这项维修是否属于自然损耗或房屋老化；如果需要扣押金，请把维修清单、照片、报价或票据发我。',
      '我愿意配合合理核验，但没有明细和凭证的扣款，我这边暂时不能确认。谢谢。',
    ].join('\n\n')
  }

  if (type === 'handover') {
    return [
      '您好，我这边计划在 ' + handoverDate + ' ' + handoverTime + ' 办理' + address + '的退租交接，想和您确认一下这个时间是否方便。',
      '交接时我们一起核对房屋现状、水电燃气和物业费用、钥匙门禁数量，以及押金退还金额和时间。',
      '备注：' + notes + ' 如果时间需要调整，麻烦您直接发一个方便交接的时间。',
    ].join('\n\n')
  }

  return [
    '您好，我是' + address + '的租客，入住时间是 ' + checkin + '，退租时间是 ' + checkout + '。我这边想和您确认押金 ' + deposit + ' 元的退还安排。',
    '我已经整理了合同、押金/转账记录、入住和退租照片、水电燃气凭证，以及相关沟通记录，方便双方核对。',
    '如果有需要扣除的项目，请您发一下具体金额、原因、照片或维修票据。正常使用损耗这部分，我这边不接受直接从押金里扣。谢谢。',
  ].join('\n\n')
}

export function createEvidencePackageText({ formData, evidence, attachments, actions, communicationText }) {
  const selectedLines = []
  const missingLines = []
  const attachmentSections = []
  const safeAttachments = normalizeAttachments(attachments)

  Object.entries(evidenceGroupMeta).forEach(([group, meta]) => {
    meta.items.forEach((item, index) => {
      const line = `${meta.title}：${item}`
      if (evidence[group][index]) {
        selectedLines.push(line)
      } else {
        missingLines.push(line)
      }
    })
    const groupAttachments = safeAttachments[group] || []
    if (groupAttachments.length) {
      const realCount = groupAttachments.filter((att) => att.source !== 'module').length
      const refCount = groupAttachments.length - realCount
      const countLabel = refCount > 0
        ? `${groupAttachments.length} 个附件（真实 ${realCount} · 模块引用 ${refCount}）`
        : `${groupAttachments.length} 个真实附件`
      attachmentSections.push(`${meta.title}（${countLabel}）`)
      groupAttachments.forEach((att, i) => {
        const sourceLabel = att.source === 'module'
          ? `模块引用·${att.sourceModule || '未知'}`
          : att.source === 'album' ? '相册' : '微信文件'
        attachmentSections.push(`  ${i + 1}. ${att.fileName} · ${sourceLabel} · ${att.createdAt}`)
      })
    }
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
    '二、真实附件清单',
    attachmentSections.length ? attachmentSections.join('\n') : '暂未上传任何附件。',
    '',
    '三、已勾选证据项',
    selectedLines.length ? selectedLines.join('\n') : '暂无已勾选证据。',
    '',
    '四、待补齐证据项',
    missingLines.length ? missingLines.join('\n') : '证据清单已全部勾选。',
    '',
    '五、下一步行动',
    actionLines.join('\n'),
    '',
    '六、沟通说明',
    communicationText || '尚未生成沟通说明。',
  ].join('\n')
}

export function getEvidenceGapAdvice(evidenceStats, evidence) {
  const missingGroups = Object.entries(evidenceGroupMeta)
    .map(([group, meta]) => {
      const missingItems = meta.items.filter((_, index) => !evidence[group][index])
      return { group, title: meta.title, missingItems }
    })
    .filter((item) => item.missingItems.length > 0)

  const firstMissing = missingGroups[0]?.missingItems[0] || '证据清单已完整'
  const summary = evidenceStats.percent >= 80
    ? '证据包已接近完整，可以进入交接和押金退还沟通。'
    : evidenceStats.percent >= 50
      ? '证据包已有基础材料，建议优先补齐照片和费用凭证。'
      : '证据链还比较薄，建议先补合同、押金凭证和退租照片。'

  return { summary, firstMissing, missingGroups }
}
