import { subsidyPolicies } from '../src/data/subsidyPolicies.js'

const refreshIntervalHours = Math.max(1, Math.min(Number(process.env.SUBSIDY_POLICY_REFRESH_HOURS) || 24, 168))
const CACHE_TTL_MS = refreshIntervalHours * 60 * 60 * 1_000
const SOURCE_TIMEOUT_MS = 8_000
const cache = new Map()

function policyWasUpdatedAfterReview(policy, lastModified) {
  const reviewedAt = Date.parse(`${policy.checkedAt}T23:59:59+08:00`)
  const modifiedAt = Date.parse(lastModified)
  return Number.isFinite(reviewedAt) && Number.isFinite(modifiedAt) && modifiedAt > reviewedAt
}

export async function checkOfficialPolicySource(policy, {
  fetchImpl = globalThis.fetch,
  now = Date.now(),
  timeoutMs = SOURCE_TIMEOUT_MS,
} = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(policy.sourceUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        Range: 'bytes=0-0',
        'User-Agent': 'zu-xiao-shen-policy-monitor/1.0',
      },
    })
    await response.body?.cancel?.().catch(() => {})
    const lastModified = response.headers?.get?.('last-modified') || ''
    const available = response.status >= 200 && response.status < 400
    return {
      status: available ? 'available' : response.status === 404 || response.status === 410 ? 'unavailable' : 'manual-review',
      httpStatus: response.status,
      checkedAt: new Date(now).toISOString(),
      finalUrl: response.url || policy.sourceUrl,
      lastModified,
      mayHaveChanged: available && policyWasUpdatedAfterReview(policy, lastModified),
    }
  } catch (error) {
    return {
      status: error?.name === 'AbortError' ? 'timeout' : 'network-error',
      httpStatus: 0,
      checkedAt: new Date(now).toISOString(),
      finalUrl: policy.sourceUrl,
      lastModified: '',
      mayHaveChanged: false,
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function getSubsidyPolicyFeed(city, options = {}) {
  const selected = subsidyPolicies.filter((policy) => policy.city === city)
  if (!selected.length) return { generatedAt: new Date(options.now || Date.now()).toISOString(), refreshIntervalHours, policies: [] }

  const now = Number(options.now) || Date.now()
  const cached = cache.get(city)
  if (!options.fetchImpl && cached && now - cached.createdAt < CACHE_TTL_MS) return cached.value

  const reviews = await Promise.all(selected.map((policy) => checkOfficialPolicySource(policy, { ...options, now })))
  const value = {
    generatedAt: new Date(now).toISOString(),
    refreshIntervalHours,
    policies: selected.map((policy, index) => ({ ...policy, liveReview: reviews[index] })),
  }
  if (!options.fetchImpl) cache.set(city, { createdAt: now, value })
  return value
}

export function listSubsidyCities() {
  return [...new Set(subsidyPolicies.map((policy) => policy.city))]
}

export function getSubsidyRefreshConfig() {
  return { refreshIntervalHours }
}
