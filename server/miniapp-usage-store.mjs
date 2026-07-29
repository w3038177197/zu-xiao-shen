import { createHash, randomUUID } from 'node:crypto'

const DEFAULT_CACHE_TTL_SECONDS = 15 * 60
const DEFAULT_CLAIM_TTL_SECONDS = 5 * 60
const REDIS_TIMEOUT_MS = 4_000
const HEALTH_CACHE_MS = 30_000
const CHINA_TIME_OFFSET_MS = 8 * 60 * 60 * 1_000

function dayKey(now = Date.now()) {
  return new Date(now + CHINA_TIME_OFFSET_MS).toISOString().slice(0, 10)
}

function secondsUntilTomorrow(now = Date.now()) {
  const current = new Date(now + CHINA_TIME_OFFSET_MS)
  const tomorrow = Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate() + 1) - CHINA_TIME_OFFSET_MS
  return Math.max(60, Math.ceil((tomorrow - now) / 1_000) + 3_600)
}

function resetAt(now = Date.now()) {
  const current = new Date(now + CHINA_TIME_OFFSET_MS)
  const tomorrow = Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate() + 1) - CHINA_TIME_OFFSET_MS
  return new Date(tomorrow - 1).toISOString()
}

function safeIdentity(value) {
  return createHash('sha256').update(String(value || 'unknown')).digest('hex').slice(0, 32)
}

function publicQuota(used, limit, now = Date.now()) {
  const safeUsed = Math.max(0, Number(used) || 0)
  return {
    used: safeUsed,
    limit,
    remaining: Math.max(0, limit - safeUsed),
    resetAt: resetAt(now),
  }
}

function createStoreError(message, cause) {
  const error = new Error(message)
  error.code = 'usage-store-unavailable'
  error.status = 503
  error.cause = cause
  return error
}

export function createMiniappUsageStore({
  redisUrl = '',
  redisToken = '',
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
} = {}) {
  const endpoint = String(redisUrl || '').replace(/\/+$/, '')
  const token = String(redisToken || '').trim()
  const redisEnabled = Boolean(endpoint && token)
  const memoryQuotas = new Map()
  const memoryResponses = new Map()
  const memoryClaims = new Map()
  let healthCache = null

  const quotaKey = (accountId, timestamp = now()) => `zxs:quota:${dayKey(timestamp)}:${safeIdentity(accountId)}`
  const responseKey = (accountId, requestId) => `zxs:ai-response:${safeIdentity(accountId)}:${String(requestId).slice(0, 96)}`
  const claimKey = (accountId, requestId) => `zxs:ai-claim:${safeIdentity(accountId)}:${String(requestId).slice(0, 96)}`

  async function redisCommand(command) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REDIS_TIMEOUT_MS)
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
        signal: controller.signal,
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data?.error) throw new Error(data?.error || `Redis REST ${response.status}`)
      return data?.result
    } catch (error) {
      throw createStoreError('联网额度服务暂时不可用，请使用本地分析后稍后重试', error)
    } finally {
      clearTimeout(timer)
    }
  }

  function cleanupMemory(timestamp = now()) {
    const currentDay = dayKey(timestamp)
    for (const key of memoryQuotas.keys()) {
      if (!key.includes(`:${currentDay}:`)) memoryQuotas.delete(key)
    }
    for (const [key, entry] of memoryResponses) {
      if (entry.expiresAt <= timestamp) memoryResponses.delete(key)
    }
    for (const [key, entry] of memoryClaims) {
      if (entry.expiresAt <= timestamp) memoryClaims.delete(key)
    }
  }

  return {
    mode: redisEnabled ? 'redis-rest' : 'memory',

    async checkHealth() {
      if (!redisEnabled) return { ok: true, persistent: false }
      const timestamp = now()
      if (healthCache && healthCache.expiresAt > timestamp) return healthCache.result

      const key = `zxs:health:${randomUUID()}`
      const value = randomUUID()
      let result
      try {
        await redisCommand(['SET', key, value, 'EX', '30'])
        const stored = await redisCommand(['GET', key])
        await redisCommand(['DEL', key])
        result = { ok: stored === value, persistent: true }
      } catch {
        result = { ok: false, persistent: true }
      }
      healthCache = { expiresAt: timestamp + HEALTH_CACHE_MS, result }
      return result
    },

    async claimRequest(accountId, requestId, requestHash, limit) {
      const timestamp = now()
      const quota = quotaKey(accountId, timestamp)
      const response = responseKey(accountId, requestId)
      const claim = claimKey(accountId, requestId)
      const hash = String(requestHash || '')

      if (redisEnabled) {
        const script = [
          "local cached = redis.call('GET', KEYS[1])",
          "if cached then return {'cached', cached} end",
          "local pending = redis.call('GET', KEYS[2])",
          "if pending then return {'pending', pending} end",
          "local current = tonumber(redis.call('GET', KEYS[3]) or '0')",
          'if current >= tonumber(ARGV[1]) then return {\'quota\', tostring(current)} end',
          "current = redis.call('INCR', KEYS[3])",
          "redis.call('EXPIRE', KEYS[3], ARGV[2])",
          "redis.call('SET', KEYS[2], ARGV[3], 'EX', ARGV[4])",
          "return {'claimed', tostring(current)}",
        ].join('\n')
        const raw = await redisCommand([
          'EVAL', script, '3', response, claim, quota,
          String(limit), String(secondsUntilTomorrow(timestamp)), hash, String(DEFAULT_CLAIM_TTL_SECONDS),
        ])
        const [status, value] = Array.isArray(raw) ? raw : []
        if (status === 'cached') {
          try {
            const cached = JSON.parse(value)
            return cached?.requestHash && cached.requestHash !== hash
              ? { status: 'conflict' }
              : { status: 'cached', value: cached }
          } catch {
            return { status: 'conflict' }
          }
        }
        if (status === 'pending') return { status: value === hash ? 'pending' : 'conflict' }
        if (status === 'quota') return { status: 'quota', quota: publicQuota(value, limit, timestamp) }
        if (status === 'claimed') return { status: 'claimed', quota: publicQuota(value, limit, timestamp) }
        throw createStoreError('联网额度服务返回了无效结果')
      }

      cleanupMemory(timestamp)
      const cached = memoryResponses.get(response)?.value
      if (cached) {
        return cached?.requestHash && cached.requestHash !== hash
          ? { status: 'conflict' }
          : { status: 'cached', value: cached }
      }
      const pending = memoryClaims.get(claim)
      if (pending) return { status: pending.requestHash === hash ? 'pending' : 'conflict' }
      const used = Number(memoryQuotas.get(quota) || 0)
      if (used >= limit) return { status: 'quota', quota: publicQuota(used, limit, timestamp) }
      memoryQuotas.set(quota, used + 1)
      memoryClaims.set(claim, { requestHash: hash, expiresAt: timestamp + DEFAULT_CLAIM_TTL_SECONDS * 1_000 })
      return { status: 'claimed', quota: publicQuota(used + 1, limit, timestamp) }
    },

    async completeRequest(accountId, requestId, requestHash, value, ttlSeconds = DEFAULT_CACHE_TTL_SECONDS) {
      const response = responseKey(accountId, requestId)
      const claim = claimKey(accountId, requestId)
      const hash = String(requestHash || '')
      const payload = JSON.stringify({ requestHash: hash, result: value })
      if (redisEnabled) {
        const script = [
          "local pending = redis.call('GET', KEYS[2])",
          "if pending and pending ~= ARGV[1] then return 0 end",
          "redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])",
          "redis.call('DEL', KEYS[2])",
          'return 1',
        ].join('\n')
        return Number(await redisCommand(['EVAL', script, '2', response, claim, hash, payload, String(ttlSeconds)])) === 1
      }
      const pending = memoryClaims.get(claim)
      if (pending && pending.requestHash !== hash) return false
      memoryResponses.set(response, { value: { requestHash: hash, result: value }, expiresAt: now() + ttlSeconds * 1_000 })
      memoryClaims.delete(claim)
      return true
    },

    async rollbackRequest(accountId, requestId, requestHash, limit) {
      const timestamp = now()
      const quota = quotaKey(accountId, timestamp)
      const claim = claimKey(accountId, requestId)
      const hash = String(requestHash || '')
      if (redisEnabled) {
        const script = [
          "local pending = redis.call('GET', KEYS[1])",
          "local current = tonumber(redis.call('GET', KEYS[2]) or '0')",
          "if not pending or pending ~= ARGV[1] then return current end",
          "redis.call('DEL', KEYS[1])",
          "if current > 0 then current = redis.call('DECR', KEYS[2]) end",
          'return current',
        ].join('\n')
        const used = await redisCommand(['EVAL', script, '2', claim, quota, hash])
        return publicQuota(used, limit, timestamp)
      }
      cleanupMemory(timestamp)
      const pending = memoryClaims.get(claim)
      if (!pending || pending.requestHash !== hash) {
        return publicQuota(memoryQuotas.get(quota) || 0, limit, timestamp)
      }
      memoryClaims.delete(claim)
      const used = Math.max(0, Number(memoryQuotas.get(quota) || 0) - 1)
      memoryQuotas.set(quota, used)
      return publicQuota(used, limit, timestamp)
    },

    async getQuota(accountId, limit) {
      const timestamp = now()
      const key = quotaKey(accountId, timestamp)
      if (redisEnabled) {
        const used = await redisCommand(['GET', key])
        return publicQuota(used, limit, timestamp)
      }
      cleanupMemory(timestamp)
      return publicQuota(memoryQuotas.get(key) || 0, limit, timestamp)
    },

    async reserveQuota(accountId, limit) {
      const timestamp = now()
      const key = quotaKey(accountId, timestamp)
      if (redisEnabled) {
        const script = [
          "local current = tonumber(redis.call('GET', KEYS[1]) or '0')",
          'if current >= tonumber(ARGV[1]) then return -1 end',
          "current = redis.call('INCR', KEYS[1])",
          "redis.call('EXPIRE', KEYS[1], ARGV[2])",
          'return current',
        ].join('\n')
        const used = Number(await redisCommand(['EVAL', script, '1', key, String(limit), String(secondsUntilTomorrow(timestamp))]))
        if (used < 0) return { ok: false, quota: publicQuota(limit, limit, timestamp) }
        return { ok: true, quota: publicQuota(used, limit, timestamp) }
      }
      cleanupMemory(timestamp)
      const used = Number(memoryQuotas.get(key) || 0)
      if (used >= limit) return { ok: false, quota: publicQuota(used, limit, timestamp) }
      memoryQuotas.set(key, used + 1)
      return { ok: true, quota: publicQuota(used + 1, limit, timestamp) }
    },

    async rollbackQuota(accountId, limit) {
      const timestamp = now()
      const key = quotaKey(accountId, timestamp)
      if (redisEnabled) {
        const script = [
          "local current = tonumber(redis.call('GET', KEYS[1]) or '0')",
          'if current <= 0 then return 0 end',
          "return redis.call('DECR', KEYS[1])",
        ].join('\n')
        const used = await redisCommand(['EVAL', script, '1', key])
        return publicQuota(used, limit, timestamp)
      }
      cleanupMemory(timestamp)
      const used = Math.max(0, Number(memoryQuotas.get(key) || 0) - 1)
      memoryQuotas.set(key, used)
      return publicQuota(used, limit, timestamp)
    },

    async getCachedResponse(accountId, requestId) {
      const timestamp = now()
      const key = responseKey(accountId, requestId)
      if (redisEnabled) {
        const raw = await redisCommand(['GET', key])
        if (!raw) return null
        try { return JSON.parse(raw) } catch { return null }
      }
      cleanupMemory(timestamp)
      return memoryResponses.get(key)?.value || null
    },

    async setCachedResponse(accountId, requestId, value, ttlSeconds = DEFAULT_CACHE_TTL_SECONDS) {
      const key = responseKey(accountId, requestId)
      if (redisEnabled) {
        await redisCommand(['SET', key, JSON.stringify(value), 'EX', String(ttlSeconds)])
        return
      }
      memoryResponses.set(key, { value, expiresAt: now() + ttlSeconds * 1_000 })
    },
  }
}
