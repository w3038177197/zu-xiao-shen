import { STORAGE_KEYS } from '../constants/appConfig.js'
import { subsidyCities, subsidyPolicies, getSubsidyMatchScore } from '../data/subsidyPolicies.js'
import { compactText } from '../utils/text.js'

export function createDefaultSubsidyMatcherState() {
  return {
    city: '杭州',
    profile: '我是2026年应届本科毕业生，刚到杭州工作，公司已缴纳社保，目前租房居住，本市无房。',
  }
}

export function normalizeSubsidyMatcherState(savedState) {
  const defaults = createDefaultSubsidyMatcherState()

  return {
    city: subsidyCities.includes(savedState?.city) ? savedState.city : defaults.city,
    profile: typeof savedState?.profile === 'string' ? savedState.profile : defaults.profile,
  }
}

export function loadSubsidyMatcherState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.subsidyMatcher)
    return saved ? normalizeSubsidyMatcherState(JSON.parse(saved)) : createDefaultSubsidyMatcherState()
  } catch {
    return createDefaultSubsidyMatcherState()
  }
}

export function getSubsidyContextSummary(state) {
  const subsidyState = normalizeSubsidyMatcherState(state)
  const matches = subsidyPolicies
    .filter((item) => item.city === subsidyState.city)
    .map((policy) => ({
      ...policy,
      matchScore: getSubsidyMatchScore(policy, subsidyState.profile),
    }))
    .sort((a, b) => b.matchScore - a.matchScore)

  return [
    `城市：${subsidyState.city}`,
    `个人情况：${compactText(subsidyState.profile, 260)}`,
    `政策线索：${matches.slice(0, 3).map((policy) => `${policy.policy}（${policy.matchScore}%｜${policy.status}）`).join('；') || '暂无匹配政策'}`,
  ].join('\n')
}
