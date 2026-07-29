import assert from 'node:assert/strict'
import { createMiniappUsageStore } from '../server/miniapp-usage-store.mjs'

const checks = []
const check = (name, run) => checks.push([name, run])

check('内存额度：预占、限额和失败回滚保持一致', async () => {
  let timestamp = Date.parse('2026-07-28T10:00:00Z')
  const store = createMiniappUsageStore({ now: () => timestamp })
  assert.equal(store.mode, 'memory')
  assert.deepEqual(await store.getQuota('wx:user-a', 2), {
    used: 0, limit: 2, remaining: 2, resetAt: '2026-07-28T15:59:59.999Z',
  })
  assert.equal((await store.reserveQuota('wx:user-a', 2)).quota.remaining, 1)
  assert.equal((await store.reserveQuota('wx:user-a', 2)).quota.remaining, 0)
  assert.equal((await store.reserveQuota('wx:user-a', 2)).ok, false)
  assert.equal((await store.rollbackQuota('wx:user-a', 2)).remaining, 1)
  timestamp = Date.parse('2026-07-28T16:00:01Z')
  assert.equal((await store.getQuota('wx:user-a', 2)).used, 0)
})

check('内存幂等：成功回答可复用并按 TTL 过期', async () => {
  let timestamp = 1_000_000
  const store = createMiniappUsageStore({ now: () => timestamp })
  const response = { ok: true, requestId: 'zxs_request_123456', reply: '已生成回答' }
  await store.setCachedResponse('wx:user-a', response.requestId, response, 10)
  assert.deepEqual(await store.getCachedResponse('wx:user-a', response.requestId), response)
  timestamp += 10_001
  assert.equal(await store.getCachedResponse('wx:user-a', response.requestId), null)
})

check('身份键：远端命令只使用哈希，不暴露 openid', async () => {
  const commands = []
  const fetchImpl = async (_url, options) => {
    const command = JSON.parse(options.body)
    commands.push(command)
    if (command[0] === 'GET') return { ok: true, json: async () => ({ result: null }) }
    return { ok: true, json: async () => ({ result: 1 }) }
  }
  const store = createMiniappUsageStore({
    redisUrl: 'https://redis.example',
    redisToken: 'server-only-token',
    fetchImpl,
    now: () => Date.parse('2026-07-28T10:00:00Z'),
  })
  assert.equal(store.mode, 'redis-rest')
  await store.getQuota('wx:openid-sensitive-value', 20)
  await store.reserveQuota('wx:openid-sensitive-value', 20)
  assert.equal(JSON.stringify(commands).includes('openid-sensitive-value'), false)
  assert.match(commands[0][1], /^zxs:quota:2026-07-28:[a-f0-9]{32}$/)
  assert.equal(commands[1][0], 'EVAL')
})

check('Redis 健康探测：真实执行临时键 SET/GET/DEL，错误凭据不会误报就绪', async () => {
  const commands = []
  let stored = null
  const healthyStore = createMiniappUsageStore({
    redisUrl: 'https://redis.example',
    redisToken: 'server-only-token',
    fetchImpl: async (_url, options) => {
      const command = JSON.parse(options.body)
      commands.push(command)
      if (command[0] === 'SET') stored = command[2]
      if (command[0] === 'DEL') stored = null
      return { ok: true, json: async () => ({ result: command[0] === 'GET' ? stored : 1 }) }
    },
  })
  assert.deepEqual(await healthyStore.checkHealth(), { ok: true, persistent: true })
  assert.deepEqual(commands.map((command) => command[0]), ['SET', 'GET', 'DEL'])
  assert.match(commands[0][1], /^zxs:health:/)
  assert.equal(stored, null)

  const brokenStore = createMiniappUsageStore({
    redisUrl: 'https://redis.example',
    redisToken: 'wrong-token',
    fetchImpl: async () => { throw new Error('unauthorized') },
  })
  assert.deepEqual(await brokenStore.checkHealth(), { ok: false, persistent: true })
})

check('跨实例幂等：requestId 占位与额度预占原子执行，不重复扣费或调用', async () => {
  let used = 0
  let pendingHash = ''
  let cachedResponse = ''
  const fetchImpl = async (_url, options) => {
    const command = JSON.parse(options.body)
    const script = command[1] || ''
    let result = 1
    if (command[0] === 'EVAL' && script.includes("return {'claimed'")) {
      const limit = Number(command[6])
      const requestHash = command[8]
      if (cachedResponse) result = ['cached', cachedResponse]
      else if (pendingHash) result = ['pending', pendingHash]
      else if (used >= limit) result = ['quota', String(used)]
      else {
        used += 1
        pendingHash = requestHash
        result = ['claimed', String(used)]
      }
    } else if (command[0] === 'EVAL' && script.includes("redis.call('SET', KEYS[1], ARGV[2]")) {
      if (pendingHash && pendingHash !== command[5]) result = 0
      else {
        cachedResponse = command[6]
        pendingHash = ''
        result = 1
      }
    } else if (command[0] === 'EVAL' && script.includes("redis.call('DECR', KEYS[2])")) {
      if (pendingHash === command[5]) {
        pendingHash = ''
        used = Math.max(0, used - 1)
      }
      result = used
    }
    return { ok: true, json: async () => ({ result }) }
  }
  const options = {
    redisUrl: 'https://redis.example',
    redisToken: 'server-only-token',
    fetchImpl,
    now: () => Date.parse('2026-07-28T10:00:00Z'),
  }
  const instanceA = createMiniappUsageStore(options)
  const instanceB = createMiniappUsageStore(options)
  const first = await instanceA.claimRequest('wx:user-a', 'req-1', 'hash-1', 5)
  assert.equal(first.status, 'claimed')
  assert.equal(first.quota.used, 1)
  assert.equal((await instanceB.claimRequest('wx:user-a', 'req-1', 'hash-1', 5)).status, 'pending')
  assert.equal((await instanceB.claimRequest('wx:user-a', 'req-1', 'other-hash', 5)).status, 'conflict')
  assert.equal(used, 1)

  assert.equal(await instanceA.completeRequest('wx:user-a', 'req-1', 'hash-1', { ok: true, reply: 'done' }), true)
  const replay = await instanceB.claimRequest('wx:user-a', 'req-1', 'hash-1', 5)
  assert.equal(replay.status, 'cached')
  assert.deepEqual(replay.value.result, { ok: true, reply: 'done' })
  assert.equal(used, 1)

  cachedResponse = ''
  assert.equal((await instanceA.claimRequest('wx:user-a', 'req-2', 'hash-2', 5)).status, 'claimed')
  assert.equal(used, 2)
  await instanceA.rollbackRequest('wx:user-a', 'req-2', 'hash-2', 5)
  assert.equal(used, 1)
})

check('远端异常：持久化服务失败时明确返回 503，不悄悄放宽额度', async () => {
  const store = createMiniappUsageStore({
    redisUrl: 'https://redis.example',
    redisToken: 'server-only-token',
    fetchImpl: async () => { throw new Error('network down') },
  })
  await assert.rejects(store.reserveQuota('wx:user-a', 20), (error) => (
    error?.code === 'usage-store-unavailable' && error?.status === 503
  ))
})

check('远端超时：AbortError 同样返回 503，不静默切换内存', async () => {
  const store = createMiniappUsageStore({
    redisUrl: 'https://redis.example',
    redisToken: 'server-only-token',
    fetchImpl: async (_url, options) => {
      const signal = options?.signal
      if (signal) {
        const error = new Error('The operation was aborted')
        error.name = 'AbortError'
        throw error
      }
      return { ok: true, json: async () => ({ result: 1 }) }
    },
  })
  await assert.rejects(store.reserveQuota('wx:user-a', 20), (error) => (
    error?.code === 'usage-store-unavailable' && error?.status === 503
  ))
  await assert.rejects(store.getQuota('wx:user-a', 20), (error) => (
    error?.code === 'usage-store-unavailable' && error?.status === 503
  ))
  await assert.rejects(store.rollbackQuota('wx:user-a', 20), (error) => (
    error?.code === 'usage-store-unavailable' && error?.status === 503
  ))
  await assert.rejects(store.getCachedResponse('wx:user-a', 'req-1'), (error) => (
    error?.code === 'usage-store-unavailable' && error?.status === 503
  ))
  await assert.rejects(store.setCachedResponse('wx:user-a', 'req-1', { ok: true }), (error) => (
    error?.code === 'usage-store-unavailable' && error?.status === 503
  ))
})

check('远端 Redis REST 返回 error 字段也按 503 抛出，不回退内存', async () => {
  const store = createMiniappUsageStore({
    redisUrl: 'https://redis.example',
    redisToken: 'server-only-token',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ error: 'UPSTREAM_ERROR' }),
    }),
  })
  await assert.rejects(store.reserveQuota('wx:user-a', 20), (error) => (
    error?.code === 'usage-store-unavailable' && error?.status === 503
  ))
})

check('幂等缓存：命中缓存结果时不重复扣额度', async () => {
  const commands = []
  let evalResult = 1
  const fetchImpl = async (_url, options) => {
    const command = JSON.parse(options.body)
    commands.push(command)
    if (command[0] === 'EVAL') return { ok: true, json: async () => ({ result: evalResult }) }
    if (command[0] === 'GET') {
      if (command[1].includes('ai-response')) {
        return { ok: true, json: async () => ({ result: JSON.stringify({ requestHash: 'h', result: { ok: true, reply: 'cached' } }) }) }
      }
      return { ok: true, json: async () => ({ result: null }) }
    }
    return { ok: true, json: async () => ({ result: 1 }) }
  }
  const store = createMiniappUsageStore({
    redisUrl: 'https://redis.example',
    redisToken: 'server-only-token',
    fetchImpl,
    now: () => Date.parse('2026-07-28T10:00:00Z'),
  })
  const cached = await store.getCachedResponse('wx:user-a', 'req-1')
  assert.deepEqual(cached, { requestHash: 'h', result: { ok: true, reply: 'cached' } })
  const evalCalls = commands.filter((c) => c[0] === 'EVAL').length
  assert.equal(evalCalls, 0, '命中缓存后不应再调用 EVAL 预占额度')
})

check('Redis 原子预占：达到上限后拒绝并返回已用满额度', async () => {
  let stored = 0
  const fetchImpl = async (_url, options) => {
    const command = JSON.parse(options.body)
    if (command[0] === 'EVAL' && command[1].includes('current >= tonumber')) {
      const limit = Number(command[4])
      if (stored >= limit) return { ok: true, json: async () => ({ result: -1 }) }
      stored += 1
      return { ok: true, json: async () => ({ result: stored }) }
    }
    if (command[0] === 'GET') return { ok: true, json: async () => ({ result: String(stored) }) }
    return { ok: true, json: async () => ({ result: stored }) }
  }
  const store = createMiniappUsageStore({
    redisUrl: 'https://redis.example',
    redisToken: 'server-only-token',
    fetchImpl,
    now: () => Date.parse('2026-07-28T10:00:00Z'),
  })
  const limit = 2
  const r1 = await store.reserveQuota('wx:user-a', limit)
  assert.equal(r1.ok, true)
  assert.equal(r1.quota.used, 1)
  const r2 = await store.reserveQuota('wx:user-a', limit)
  assert.equal(r2.ok, true)
  assert.equal(r2.quota.used, 2)
  const r3 = await store.reserveQuota('wx:user-a', limit)
  assert.equal(r3.ok, false)
  assert.equal(r3.quota.used, limit)
  assert.equal(r3.quota.remaining, 0)
})

check('Redis 失败回滚：DECR 后额度恢复', async () => {
  let stored = 1
  const fetchImpl = async (_url, options) => {
    const command = JSON.parse(options.body)
    if (command[0] === 'EVAL' && command[1].includes('DECR')) {
      stored = Math.max(0, stored - 1)
      return { ok: true, json: async () => ({ result: stored }) }
    }
    if (command[0] === 'EVAL' && command[1].includes('INCR')) {
      stored += 1
      return { ok: true, json: async () => ({ result: stored }) }
    }
    if (command[0] === 'GET') return { ok: true, json: async () => ({ result: String(stored) }) }
    return { ok: true, json: async () => ({ result: stored }) }
  }
  const store = createMiniappUsageStore({
    redisUrl: 'https://redis.example',
    redisToken: 'server-only-token',
    fetchImpl,
    now: () => Date.parse('2026-07-28T10:00:00Z'),
  })
  const reserved = await store.reserveQuota('wx:user-a', 5)
  assert.equal(reserved.quota.used, 2)
  const rolled = await store.rollbackQuota('wx:user-a', 5)
  assert.equal(rolled.used, 1)
})

let passed = 0
for (const [name, run] of checks) {
  await run()
  passed += 1
  console.log(`PASS ${name}`)
}
console.log(`Miniapp usage store check passed: ${passed}/${checks.length}`)
