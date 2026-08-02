import Taro from '@tarojs/taro'
import { STORAGE_KEYS } from '../constants/appConfig.js'
import { getCheckinItems } from '../constants/checkinConfig.js'
import { getCheckinContextSummary, hasCheckinContent, loadCheckinInspectionState } from './checkinInspection.js'
import { loadEvidencePackState } from './evidencePack.js'

// 模块引用附件统一生成入口：
// - 只读取原模块的持久化数据，不复制或删除原模块文件
// - 文件类引用（验房照片）直接复用原 localPath，不写入新文件
// - 文本类引用（验房报告 / 合同正文 / 审查报告）将生成的文本存入 textContent，
//   不在 USER_DATA_PATH 创建新文件，也不触碰原模块的 Storage
// - 每个引用带 sourceModule + sourcePath，用于在证据包中按来源和路径去重

const ROOM_LABELS = {
  living: '客厅/卧室',
  kitchen: '厨房',
  bathroom: '卫生间',
  meter: '水电燃气',
}

function genRefId() {
  return `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function nowIso() {
  return new Date().toISOString()
}

// 读取验房状态中的所有照片，构建图片引用列表
export function buildCheckinPhotoRefs() {
  const checkinState = loadCheckinInspectionState()
  const refs = []
  Object.keys(checkinState).forEach((roomKey) => {
    const room = checkinState[roomKey] || {}
    Object.keys(room).forEach((itemKey) => {
      const record = room[itemKey] || {}
      const photos = Array.isArray(record.photos) ? record.photos : []
      photos.forEach((path, idx) => {
        if (typeof path !== 'string' || !path) return
        refs.push({
          id: genRefId(),
          fileName: `验房照片-${ROOM_LABELS[roomKey] || roomKey}-${getCheckinItems(roomKey).find((item) => item.key === itemKey)?.label || itemKey}-${idx + 1}.jpg`,
          fileType: 'image',
          size: 0,
          localPath: path,
          source: 'module',
          sourceModule: 'checkin',
          sourcePath: `${roomKey}.${itemKey}.photos[${idx}]`,
          createdAt: nowIso(),
        })
      })
    })
  })
  return refs
}

// 验房照片被导入证据包后仍然是同一份持久化文件。验房页删除记录时，
// 必须保留这些仍被证据包引用的文件，否则证据包会出现失效缩略图。
export function getEvidenceReferencedCheckinPhotoPaths(state = loadEvidencePackState()) {
  const paths = new Set()
  Object.values(state?.attachments || {}).forEach((attachments) => {
    if (!Array.isArray(attachments)) return
    attachments.forEach((attachment) => {
      if (
        attachment?.source === 'module'
        && attachment.sourceModule === 'checkin'
        && typeof attachment.localPath === 'string'
        && attachment.localPath
      ) {
        paths.add(attachment.localPath)
      }
    })
  })
  return paths
}

// 基于当前验房状态生成验房报告文本快照
// 状态、照片、备注和瑕疵说明均为空时才视为完全未验房
export function buildCheckinReportRef() {
  const checkinState = loadCheckinInspectionState()
  if (!hasCheckinContent(checkinState)) return null
  const summary = getCheckinContextSummary(checkinState)
  const dateStr = new Date().toLocaleDateString('zh-CN')
  const textContent = [
    '租小审 验房报告',
    `生成时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`,
    '',
    summary,
  ].join('\n')
  return {
    id: genRefId(),
    fileName: `验房报告-${dateStr}.txt`,
    fileType: 'file',
    size: textContent.length,
    textContent,
    source: 'module',
    sourceModule: 'checkin',
    sourcePath: 'summary',
    createdAt: nowIso(),
  }
}

// 读取当前合同正文，构建文本引用
export function buildContractTextRef() {
  let contractText = ''
  try {
    contractText = Taro.getStorageSync(STORAGE_KEYS.contractDraft) || ''
  } catch {
    contractText = ''
  }
  if (!contractText) return null
  return {
    id: genRefId(),
    fileName: '合同正文.txt',
    fileType: 'file',
    size: contractText.length,
    textContent: contractText,
    source: 'module',
    sourceModule: 'contract',
    sourcePath: 'draft',
    createdAt: nowIso(),
  }
}

// 读取审查历史，为每个带快照的历史条目生成审查报告引用
export function buildReviewReportRefs() {
  let history = []
  try {
    history = Taro.getStorageSync(STORAGE_KEYS.reviewHistory) || []
  } catch {
    history = []
  }
  if (!Array.isArray(history)) return []

  return history
    .filter((entry) => entry && entry.snapshot)
    .map((entry) => {
      const snap = entry.snapshot || {}
      const findings = Array.isArray(snap.findings) ? snap.findings : []
      const summary = snap.summary || {}
      const levelLabel = (lv) => (lv === 'high' ? '高' : lv === 'medium' ? '中' : '低')
      const lines = [
        '租小审 合同审查报告',
        `审查时间：${entry.time || ''}`,
        `风险评分：${summary.score ?? 0} 分（${summary.label || '未评级'}）`,
        `风险点：${findings.length} 个`,
        '',
        '一、风险总览',
        summary.advice || '—',
        '',
        '二、逐条风险点',
        ...findings.map((f, i) => `${i + 1}. [${levelLabel(f.level)}风险] ${f.title}\n   ${f.explain || f.description || ''}`),
        '',
        '三、修订建议',
        ...findings.filter((f) => f.suggestion).map((f, i) => `${i + 1}. ${f.title}：${f.suggestion}`),
      ]
      return {
        id: genRefId(),
        fileName: `审查报告-${entry.time || '未知时间'}.txt`,
        fileType: 'file',
        size: lines.join('\n').length,
        textContent: lines.join('\n'),
        source: 'module',
        sourceModule: 'review',
        sourcePath: `history.${entry.id}`,
        createdAt: nowIso(),
      }
    })
}

// 检查指定来源模块 + 来源路径在某组中是否已存在引用（用于 UI 提示）
export function findExistingRef(state, group, sourceModule, sourcePath) {
  const list = state?.attachments?.[group] || []
  return list.find((item) =>
    item && item.source === 'module'
    && item.sourceModule === sourceModule
    && item.sourcePath === sourcePath,
  ) || null
}

// 检查证据包是否已导入过某类引用（按 sourceModule 维度）
export function listExistingRefsByModule(state, group, sourceModule) {
  const list = state?.attachments?.[group] || []
  return list.filter((item) =>
    item && item.source === 'module'
    && item.sourceModule === sourceModule,
  )
}
