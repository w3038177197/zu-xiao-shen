import Taro from '@tarojs/taro'
import { STORAGE_KEYS } from '../constants/appConfig.js'

export const REVIEW_HISTORY_LIMIT = 8
export const REVIEW_HISTORY_SNAPSHOT_BUDGET = 500_000

export function createReviewHistoryEntry(reviewResult) {
  const { contractText, findings, summary, dimensions, adoptedItems, revisedDraft, activeProfile, profile } = reviewResult
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    time: new Date().toLocaleString('zh-CN', { hour12: false }),
    score: summary.score,
    label: summary.label,
    count: findings.length,
    snapshot: {
      contractText,
      findings,
      summary,
      dimensions,
      adoptedItems,
      revisedDraft,
      activeProfile,
      profile: { ...profile },
    },
  }
}

export function withoutReviewSnapshot(entry) {
  const summary = { ...entry }
  delete summary.snapshot
  return summary
}

export function compactReviewHistory(entries, snapshotBudget = REVIEW_HISTORY_SNAPSHOT_BUDGET) {
  let remaining = snapshotBudget
  return entries.slice(0, REVIEW_HISTORY_LIMIT).map((entry) => {
    if (!entry?.snapshot) return entry
    const size = JSON.stringify(entry.snapshot).length
    if (size > remaining) return withoutReviewSnapshot(entry)
    remaining -= size
    return entry
  })
}

export function saveReviewHistory(entries) {
  // ponytail: fixed character budget keeps local history bounded; use byte telemetry only if this conservative cap proves insufficient.
  const history = compactReviewHistory(entries)
  const degraded = Boolean(entries[0]?.snapshot && !history[0]?.snapshot)
  try {
    Taro.setStorageSync(STORAGE_KEYS.reviewHistory, history)
    return { ok: true, history, degraded }
  } catch (error) {
    const summaries = history.map(withoutReviewSnapshot)
    try {
      Taro.setStorageSync(STORAGE_KEYS.reviewHistory, summaries)
      return { ok: true, history: summaries, degraded: true, error }
    } catch (fallbackError) {
      return { ok: false, history, degraded: false, error: fallbackError }
    }
  }
}
