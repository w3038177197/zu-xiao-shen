import Taro from '@tarojs/taro'
import { STORAGE_KEYS } from '../constants/appConfig.js'

const LIMIT = 100

export function loadReviewFeedback() {
  try {
    const value = Taro.getStorageSync(STORAGE_KEYS.aiFeedback)
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

export function saveReviewFeedback({ findingId, type, contractType = 'lease' }) {
  if (!findingId || !['accurate', 'review'].includes(type)) return { ok: false, reason: 'invalid' }
  const next = [
    { findingId, type, contractType, createdAt: new Date().toISOString() },
    ...loadReviewFeedback().filter((item) => !(item.findingId === findingId && item.contractType === contractType)),
  ].slice(0, LIMIT)
  try {
    Taro.setStorageSync(STORAGE_KEYS.aiFeedback, next)
    return { ok: true, entries: next }
  } catch (error) {
    return { ok: false, reason: 'storage-failed', error }
  }
}

export function formatReviewFeedbackExport() {
  return JSON.stringify({
    app: '租小审',
    exportedAt: new Date().toISOString(),
    notes: '仅包含规则反馈，不包含合同正文、姓名、证件号、地址或本地文件路径。',
    entries: loadReviewFeedback(),
  }, null, 2)
}
