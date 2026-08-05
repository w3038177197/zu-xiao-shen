import Taro from '@tarojs/taro'
import { subsidyPolicies, evaluateSubsidyMatch } from '../shared/subsidyPolicies.js'
import { STORAGE_KEYS } from '../constants/appConfig.js'
import {
  getCheckinContextSummary,
  getCheckinDefectRows,
  getCheckinStats,
  hasCheckinContent,
  loadCheckinInspectionState,
} from './checkinInspection.js'
import { evidenceGroupMeta, getAttachmentStats, loadEvidencePackState } from './evidencePack.js'

function parseStoredValue(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    // 合同草稿等 Storage 值本身就是普通字符串，不应因不是 JSON 而丢失。
    return value
  }
}

function readStorage(key, fallback) {
  try {
    return parseStoredValue(Taro.getStorageSync(key), fallback)
  } catch {
    return fallback
  }
}

function getReviewSnapshot(contractText, reviewHistory) {
  if (!contractText || !Array.isArray(reviewHistory)) return null
  const entry = reviewHistory.find((item) => item?.snapshot?.contractText === contractText)
  if (!entry) return null
  return {
    entry,
    findings: Array.isArray(entry.snapshot.findings) ? entry.snapshot.findings : [],
    summary: entry.snapshot.summary || null,
  }
}

function getEvidenceChecklistStats(state) {
  const groups = Object.keys(evidenceGroupMeta)
  const values = groups.flatMap((group) => Array.isArray(state?.evidence?.[group]) ? state.evidence[group] : [])
  return {
    checked: values.filter(Boolean).length,
    total: values.length,
  }
}

function hasMeaningfulEvidenceData(state, checklist, attachmentStats) {
  const form = state?.formData || {}
  return Boolean(
    attachmentStats.total
    || checklist.checked
    || (Array.isArray(state?.actions) && state.actions.some(Boolean))
    || String(state?.communicationText || '').trim()
    || Object.values(form).some((value) => String(value || '').trim()),
  )
}

function summarizeEvidenceGroups(state) {
  return Object.entries(evidenceGroupMeta).map(([key, meta]) => {
    const checkedItems = meta.items.filter((_, index) => Boolean(state?.evidence?.[key]?.[index]))
    const missingItems = meta.items.filter((_, index) => !state?.evidence?.[key]?.[index])
    const attachments = Array.isArray(state?.attachments?.[key]) ? state.attachments[key] : []
    return {
      key,
      title: meta.title,
      checkedItems,
      missingItems,
      attachmentCount: attachments.length,
      attachmentNames: attachments.map((item) => String(item?.fileName || '').trim()).filter(Boolean).slice(0, 8),
    }
  })
}

function summarizeSubsidy(savedState) {
  const city = typeof savedState?.city === 'string' ? savedState.city.trim() : ''
  const profile = typeof savedState?.profile === 'string' ? savedState.profile.trim() : ''
  if (!city && !profile) {
    return { hasData: false, city: '', profile: '', total: 0, satisfied: 0, pending: 0, unsatisfied: 0 }
  }

  const evaluations = subsidyPolicies
    .filter((policy) => policy.city === city)
    .map((policy) => ({ policy, evaluation: evaluateSubsidyMatch(policy, profile) }))
  return {
    hasData: Boolean(city || profile),
    city,
    profile,
    total: evaluations.length,
    satisfied: evaluations.filter((item) => item.evaluation.status === 'satisfied').length,
    pending: evaluations.filter((item) => item.evaluation.status === 'pending').length,
    unsatisfied: evaluations.filter((item) => item.evaluation.status === 'unsatisfied').length,
    matches: evaluations.slice(0, 5).map(({ policy, evaluation }) => ({
      policy: policy.policy,
      status: evaluation.status,
      score: evaluation.score,
      criteria: evaluation.criteria.slice(0, 8),
    })),
  }
}

export function buildWorkflowContext({
  contractText = '',
  reviewHistory = [],
  checkinState,
  checkinRoomType,
  evidencePackState,
  subsidyState,
} = {}) {
  const safeContractText = typeof contractText === 'string' ? contractText.trim() : ''
  const reviewSnapshot = getReviewSnapshot(safeContractText, reviewHistory)
  const checkinStats = getCheckinStats(checkinState, checkinRoomType)
  const checkinHasData = hasCheckinContent(checkinState, checkinRoomType)
  const attachmentStats = getAttachmentStats(evidencePackState)
  const evidenceChecklist = getEvidenceChecklistStats(evidencePackState)
  const evidenceHasData = hasMeaningfulEvidenceData(evidencePackState, evidenceChecklist, attachmentStats)
  const subsidy = summarizeSubsidy(subsidyState)

  const context = {
    contractText: safeContractText,
    review: {
      hasDraft: Boolean(safeContractText),
      isCurrent: Boolean(reviewSnapshot),
      historyCount: Array.isArray(reviewHistory) ? reviewHistory.length : 0,
      findings: reviewSnapshot?.findings || [],
      summary: reviewSnapshot?.summary || null,
    },
    checkin: {
      hasData: checkinHasData,
      stats: checkinStats,
      defects: getCheckinDefectRows(checkinState, checkinRoomType),
      summary: checkinHasData ? getCheckinContextSummary(checkinState, checkinRoomType) : '',
    },
    evidence: {
      hasData: evidenceHasData,
      checklist: evidenceChecklist,
      attachmentStats,
      address: String(evidencePackState?.formData?.address || '').trim(),
      deposit: String(evidencePackState?.formData?.deposit || '').trim(),
      groups: summarizeEvidenceGroups(evidencePackState),
      hasCommunication: Boolean(String(evidencePackState?.communicationText || '').trim()),
      communicationText: String(evidencePackState?.communicationText || '').replace(/\s+/g, ' ').trim().slice(0, 500),
    },
    subsidy,
  }

  context.modules = {
    review: context.review.isCurrent
      ? { hasData: true, status: '已审查', detail: `${context.review.summary?.score ?? 0} 分 · ${context.review.findings.length} 个风险` }
      : context.review.hasDraft
        ? { hasData: true, status: '待审查', detail: `已录入 ${safeContractText.length} 字` }
        : { hasData: false, status: '未开始', detail: '粘贴合同后开始审查' },
    checkin: checkinHasData
      ? { hasData: true, status: checkinStats.checked === checkinStats.total ? '已完成' : '进行中', detail: `${checkinStats.checked}/${checkinStats.total} 项 · ${checkinStats.photos} 张照片` }
      : { hasData: false, status: '未开始', detail: '按房间拍照并标记状态' },
    evidence: evidenceHasData
      ? { hasData: true, status: attachmentStats.total ? '已整理' : '待补附件', detail: `${attachmentStats.total} 个附件 · 清单 ${evidenceChecklist.checked}/${evidenceChecklist.total}` }
      : { hasData: false, status: '未开始', detail: '整理合同、照片和费用凭证' },
    subsidy: subsidy.hasData
      ? { hasData: true, status: '已匹配', detail: `${subsidy.city || '未选城市'} · ${subsidy.total} 条线索` }
      : { hasData: false, status: '未开始', detail: '填写城市和个人情况' },
  }

  context.linkedSources = [
    context.review.hasDraft ? { key: 'review', label: context.review.isCurrent ? `合同 ${context.review.summary?.score ?? 0} 分` : '合同待审查' } : null,
    checkinHasData ? { key: 'checkin', label: `验房 ${checkinStats.checked}/${checkinStats.total}` } : null,
    evidenceHasData ? { key: 'evidence', label: `证据 ${attachmentStats.total} 件` } : null,
    subsidy.hasData ? { key: 'subsidy', label: `补贴 ${subsidy.city || '待选城市'}` } : null,
  ].filter(Boolean)

  return context
}

export function loadWorkflowContext() {
  const contractText = String(readStorage(STORAGE_KEYS.contractDraft, '') || '')
  const reviewHistory = readStorage(STORAGE_KEYS.reviewHistory, [])
  const subsidyState = readStorage(STORAGE_KEYS.subsidyMatcher, null)
  const checkinRoomType = String(readStorage(STORAGE_KEYS.checkinRoomType, '') || '')
  return buildWorkflowContext({
    contractText,
    reviewHistory,
    checkinState: loadCheckinInspectionState(),
    checkinRoomType,
    evidencePackState: loadEvidencePackState(),
    subsidyState,
  })
}

export function getWorkflowContextLines(context) {
  const lines = []
  if (context?.review?.hasDraft) {
    lines.push(context.review.isCurrent
      ? `合同：${context.review.summary?.score ?? 0} 分，${context.review.findings.length} 个风险点`
      : '合同：已有正文，当前版本尚未审查')
  }
  if (context?.checkin?.hasData) {
    const stats = context.checkin.stats
    lines.push(`验房：${stats.checked}/${stats.total} 项，${stats.defects} 处瑕疵，${stats.photos} 张照片`)
  }
  if (context?.evidence?.hasData) {
    lines.push(`证据包：${context.evidence.attachmentStats.total} 个附件，清单 ${context.evidence.checklist.checked}/${context.evidence.checklist.total}`)
  }
  if (context?.subsidy?.hasData) {
    lines.push(`补贴：${context.subsidy.city || '未选城市'}，${context.subsidy.total} 条政策线索`)
  }
  return lines
}
