import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import net from 'node:net'
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { Document, Packer, Paragraph } from 'docx'
import { createMiniappSessionToken } from '../server/miniapp-auth.mjs'

const SESSION_SECRET = 'test-secret-for-miniapp-session-32chars'
const TEST_OPENID = 'test-openid-1234567890abcdef'
const TEST_APPID = 'test-appid-1234567890ab'

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.listen(0, () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
}

function startMockUpstream(port) {
  const state = { mode: 'success', delay: 0, failNext: 0, aborted: 0 }
  const server = http.createServer((req, res) => {
    res.on('close', () => {
      if (!res.writableEnded) state.aborted += 1
    })
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      const respond = () => {
        if (res.destroyed) return
        let requestBody = {}
        try { requestBody = JSON.parse(body || '{}') } catch { /* 返回普通 mock 响应 */ }
        const isContractReview = requestBody.messages?.some((message) => String(message?.content || '').includes('合同全文复核模型'))
        const content = isContractReview
          ? JSON.stringify({ findings: [{
            title: '出租方未经同意入户',
            level: 'high',
            dimension: '居住权',
            evidence: '甲方可随时进入房屋，无需乙方同意',
            explain: '可能影响承租人的居住安宁。',
            suggestion: '改为提前预约并取得同意。',
            replacement: '甲方确需入户时，应提前与乙方协商时间并取得同意。',
          }] })
          : '这是来自测试模型的回答，建议先核对合同条款后再沟通。'
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          id: 'mock-completion-1',
          choices: [{
            index: 0,
            message: { role: 'assistant', content },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        }))
      }
      if (state.mode === 'error') {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: { message: 'mock upstream error' } }))
        return
      }
      if (state.failNext > 0) {
        state.failNext -= 1
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: { message: 'mock partial failure' } }))
        return
      }
      if (state.delay > 0) {
        setTimeout(respond, state.delay)
        return
      }
      respond()
    })
  })
  return new Promise((resolve, reject) => {
    server.listen(port, () => resolve({ server, state }))
    server.on('error', reject)
  })
}

// 持续收集子进程 stdout/stderr，用于最后做日志脱敏断言
const serverOutputBuffer = []

function waitForServerReady(child) {
  return new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => {
      reject(new Error(`Server failed to start within 20s. Output: ${output}`))
    }, 20_000)
    child.stdout.on('data', (data) => {
      const text = data.toString()
      output += text
      serverOutputBuffer.push(text)
      const match = output.match(/listening on http:\/\/localhost:(\d+)/)
      if (match) {
        clearTimeout(timer)
        resolve(Number(match[1]))
      }
    })
    child.stderr.on('data', (data) => {
      const text = data.toString()
      output += text
      serverOutputBuffer.push(text)
    })
    child.on('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`Server exited with code ${code} before becoming ready. Output: ${output}`))
    })
  })
}

const checks = []
const check = (name, fn) => checks.push([name, fn])

// 白名单 env：仅保留 Node 运行必要的系统变量，业务变量全部显式使用测试值。
// 这样可以保证测试不可能读到本机真实的 Redis、模型 Key、微信密钥或会话密钥。
const SYSTEM_ENV_WHITELIST = [
  'PATH', 'Path',
  'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'windir',
  'TEMP', 'TMP', 'TMPDIR',
  'ComSpec', 'COMSPEC',
  'PATHEXT', 'PathExt',
  'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE',
  'OS', 'APPDATA', 'LOCALAPPDATA', 'USERPROFILE',
  'HOME', 'HOMEDRIVE', 'HOMEPATH',
  'LANG', 'LC_ALL', 'LC_CTYPE',
  'TZ',
]

// 必须被显式覆盖为测试值的密钥/凭据变量。
// 这里先列出名称，下方 main() 中会以测试值注入，确保即使本机设置了真实值也不会泄露到测试子进程。
const SENSITIVE_ENV_TO_OVERRIDE = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'DEEPSEEK_API_KEY',
  'DEEPSEEK_BASE_URL',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'AI_PROXY_API_KEY',
  'AI_PROXY_BASE_URL',
  'WX_SECRET',
  'WX_APPID',
  'MINIAPP_SESSION_SECRET',
  'MINIAPP_DEPLOY_REQUIRE_PERSISTENT',
]

function buildIsolatedEnv(mockPort, aiProxyPort) {
  const env = {}
  for (const key of SYSTEM_ENV_WHITELIST) {
    if (process.env[key] !== undefined) env[key] = process.env[key]
  }
  // 显式覆盖所有敏感变量为测试值，确保不可能来自本机真实环境
  env.UPSTASH_REDIS_REST_URL = ''
  env.UPSTASH_REDIS_REST_TOKEN = ''
  env.DEEPSEEK_API_KEY = ''
  env.DEEPSEEK_BASE_URL = ''
  env.OPENAI_API_KEY = 'test-api-key'
  env.OPENAI_BASE_URL = `http://localhost:${mockPort}`
  env.AI_PROXY_API_KEY = 'test-api-key'
  env.AI_PROXY_BASE_URL = `http://localhost:${mockPort}`
  env.WX_SECRET = 'test-wx-secret-value'
  env.WX_APPID = TEST_APPID
  env.MINIAPP_SESSION_SECRET = SESSION_SECRET
  env.MINIAPP_DEPLOY_REQUIRE_PERSISTENT = ''
  // 业务配置
  env.PORT = String(aiProxyPort)
  env.AI_PROXY_PROVIDER = 'OpenAI-compatible'
  env.AI_DAILY_QUOTA = '3'
  env.AI_PROXY_TIMEOUT_MS = '5000'
  env.OCR_TIMEOUT_MS = '15000'
  env.AI_PROXY_ALLOWED_ORIGIN = 'http://localhost:5173'
  env.NODE_ENV = 'test'
  return env
}

// 自检：确保隔离 env 中不存在任何真实密钥来源
function assertEnvIsolated(env) {
  for (const key of SENSITIVE_ENV_TO_OVERRIDE) {
    const value = env[key]
    if (value === undefined) {
      throw new Error(`隔离 env 自检失败：${key} 未设置（必须显式为测试值或空字符串）`)
    }
  }
  // 额外断言：Redis 与 DeepSeek 必须为空，确保不会连真实服务
  assert.equal(env.UPSTASH_REDIS_REST_URL, '', '测试环境不得配置真实 Redis URL')
  assert.equal(env.UPSTASH_REDIS_REST_TOKEN, '', '测试环境不得配置真实 Redis Token')
  assert.equal(env.DEEPSEEK_API_KEY, '', '测试环境不得配置真实 DeepSeek Key')
}

async function main() {
  const mockPort = await getAvailablePort()
  const aiProxyPort = await getAvailablePort()
  const { server: mockServer, state: upstreamState } = await startMockUpstream(mockPort)

  const env = buildIsolatedEnv(mockPort, aiProxyPort)
  assertEnvIsolated(env)

  const child = spawn(process.execPath, ['server/ai-proxy.mjs'], {
    cwd: process.cwd(),
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  let serverPort
  try {
    serverPort = await waitForServerReady(child)
  } catch (error) {
    mockServer.close()
    throw error
  }

  const baseUrl = `http://localhost:${serverPort}`
  const { token } = createMiniappSessionToken(
    { openid: TEST_OPENID, ttlSeconds: 7200 },
    SESSION_SECRET,
  )

  // 测试中显式使用的敏感数据，用于断言这些内容绝不会出现在服务端日志中
  const sensitiveProbe = {
    phone: '13800138000',
    idCard: '110101199001011234',
    address: '北京市朝阳区某街道某号某室',
    userName: '张三丰',
    contractClause: '本合同约定押金为人民币伍仟元整，退租时三日内返还',
    contextSummary: '用户姓名张三丰，手机13800138000，住址北京市朝阳区某街道某号某室',
    openid: TEST_OPENID,
    sessionToken: token,
    apiKey: 'test-api-key',
    redisToken: 'test-redis-token-should-not-appear',
    sensitiveRequestId: '110101199001011234',  // 身份证号作为 requestId
    sensitiveXRequestId: 'sk-test-api-key-leak-probe',  // 模拟 API key 作为 x-request-id
  }

  try {
    let passed = 0
    for (const [name, fn] of checks) {
      await fn({ baseUrl, token, upstreamState, sensitiveProbe })
      passed += 1
      console.log(`PASS ${name}`)
    }

    // 等待子进程 flush 剩余日志
    await new Promise((resolve) => setTimeout(resolve, 300))
    const fullOutput = serverOutputBuffer.join('')

    // 日志脱敏断言：服务端输出中不得包含任何敏感数据
    const leakedItems = []
    for (const [key, value] of Object.entries(sensitiveProbe)) {
      if (value && value.length > 4 && fullOutput.includes(value)) {
        leakedItems.push(`${key}=${value.slice(0, 8)}...`)
      }
    }
    assert.equal(leakedItems.length, 0,
      `日志脱敏失败，以下敏感数据出现在服务端输出中：\n${leakedItems.join('\n')}\n--- 服务端输出片段 ---\n${fullOutput.slice(-2000)}`)

    console.log(`PASS 日志脱敏：服务端 stdout/stderr 中不包含任何敏感数据`)

    // 收口点3：解析 stdout 中的 JSON 日志并做真实断言
    const ALLOWED_LOG_FIELDS = new Set([
      'requestId', 'route', 'statusCode', 'elapsedMs', 'model', 'provider',
      'usage', 'replayed', 'errorCode', 'storeMode',
    ])
    const structuredLogs = []
    for (const line of fullOutput.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('{')) continue
      try {
        const parsed = JSON.parse(trimmed)
        // 只收集看起来像结构化日志的对象（含 route 或 statusCode 字段）
        if (parsed.route || parsed.statusCode !== undefined) {
          structuredLogs.push(parsed)
        }
      } catch {
        // 非 JSON 行，跳过
      }
    }
    assert.ok(structuredLogs.length >= 8, `应至少解析出 8 条结构化日志，实际 ${structuredLogs.length}\n输出片段：\n${fullOutput.slice(-1500)}`)

    // 断言1：所有日志字段必须属于白名单
    for (const log of structuredLogs) {
      for (const key of Object.keys(log)) {
        assert.ok(ALLOWED_LOG_FIELDS.has(key),
          `日志字段越界：发现非白名单字段 "${key}"，日志内容：${JSON.stringify(log)}`)
      }
    }

    // 断言2：requestId 必须是短哈希格式（rid_ 开头 + 12 位 hex），不得是原值
    for (const log of structuredLogs) {
      if (log.requestId) {
        assert.match(log.requestId, /^rid_[a-f0-9]{12}$/,
          `requestId 未正确脱敏：${log.requestId}，日志内容：${JSON.stringify(log)}`)
      }
    }

    // 断言3：storeMode 必须存在且为合法值
    for (const log of structuredLogs) {
      if (log.storeMode !== undefined) {
        assert.ok(log.storeMode === 'memory' || log.storeMode === 'redis-rest',
          `storeMode 非法：${log.storeMode}`)
      }
    }

    // 断言4：验证成功场景（正常聊天，statusCode=200, replayed=false, provider/model/usage 存在）
    const successLogs = structuredLogs.filter((l) => l.route === '/api/miniapp/ai/chat' && l.statusCode === 200 && l.replayed === false)
    assert.ok(successLogs.length >= 1, `未找到成功场景日志`)
    const successLog = successLogs[0]
    assert.ok(successLog.provider, '成功日志必须包含 provider')
    assert.ok(successLog.model, '成功日志必须包含 model')
    assert.ok(successLog.usage && typeof successLog.usage === 'object', '成功日志必须包含 usage 对象')
    assert.ok(typeof successLog.usage.total_tokens === 'number', 'usage.total_tokens 必须是数字')
    assert.equal(successLog.storeMode, 'memory')

    // 断言5：验证上游失败场景（errorCode=upstream-failed, statusCode>=500）
    const failLogs = structuredLogs.filter((l) => l.route === '/api/miniapp/ai/chat' && l.errorCode === 'upstream-failed')
    assert.ok(failLogs.length >= 1, `未找到上游失败场景日志`)
    assert.ok(failLogs[0].statusCode >= 500, `上游失败 statusCode 必须 >= 500`)
    assert.ok(failLogs[0].elapsedMs >= 0)

    // 断言6：验证超时场景（errorCode=upstream-timeout, statusCode=504）
    const timeoutLogs = structuredLogs.filter((l) => l.errorCode === 'upstream-timeout')
    assert.ok(timeoutLogs.length >= 1, `未找到超时场景日志`)
    assert.equal(timeoutLogs[0].statusCode, 504)

    // 断言7：验证幂等重放场景（replayed=true, statusCode=200, 无 usage 字段）
    const replayLogs = structuredLogs.filter((l) => l.route === '/api/miniapp/ai/chat' && l.replayed === true)
    assert.ok(replayLogs.length >= 1, `未找到幂等重放场景日志`)
    assert.equal(replayLogs[0].statusCode, 200)
    assert.equal(replayLogs[0].usage, undefined, '重放日志不应包含 usage')

    // 断言8：验证鉴权失败场景（statusCode=401, errorCode=malformed 或 signature）
    const authFailLogs = structuredLogs.filter((l) => l.statusCode === 401)
    assert.ok(authFailLogs.length >= 2, `应至少找到 2 条鉴权失败日志（无 token + 篡改 token），实际 ${authFailLogs.length}`)
    const errorCodes = authFailLogs.map((l) => l.errorCode).sort()
    assert.ok(errorCodes.includes('malformed'), '应包含 malformed 错误码')
    assert.ok(errorCodes.includes('signature'), '应包含 signature 错误码')

    console.log(`PASS 日志结构化断言：解析 ${structuredLogs.length} 条日志，字段白名单/短哈希/成功/失败/超时/重放/鉴权失败全部验证通过`)
    passed += 2
    console.log(`Miniapp HTTP integration test passed: ${passed}/${checks.length + 2}`)
  } finally {
    child.kill()
    mockServer.close()
  }
}

check('健康检查：服务端正确暴露鉴权与额度配置', async ({ baseUrl }) => {
  const response = await fetch(`${baseUrl}/api/health`)
  const data = await response.json()
  assert.equal(response.status, 200)
  assert.equal(data.miniappAuthConfigured, true)
  assert.equal(data.miniappUsageStore, 'memory')
  assert.equal(data.contractDocumentParsing, true)
  assert.equal(data.ocrMode, 'offline-tesseract')
  assert.equal(data.miniappApiVersion, 3)
})

check('鉴权失败：无 Authorization 头返回 401', async ({ baseUrl }) => {
  const response = await fetch(`${baseUrl}/api/miniapp/ai/quota`)
  const data = await response.json()
  assert.equal(response.status, 401)
  assert.equal(data.reason, 'malformed')
})

check('鉴权失败：篡改的令牌返回 401 且 reason=signature', async ({ baseUrl }) => {
  const response = await fetch(`${baseUrl}/api/miniapp/ai/quota`, {
    headers: { Authorization: 'Bearer fake.token.value' },
  })
  const data = await response.json()
  assert.equal(response.status, 401)
  assert.equal(data.reason, 'signature')
})

check('上游失败回滚：模型 500 时额度回滚且返回 5xx', async ({ baseUrl, token, upstreamState }) => {
  upstreamState.mode = 'error'
  upstreamState.delay = 0
  const response = await fetch(`${baseUrl}/api/miniapp/ai/chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId: 'upstream-fail-test-0001', prompt: '押金被扣了怎么办？' }),
  })
  upstreamState.mode = 'success'
  assert.ok(response.status >= 500, `上游 500 时应返回 5xx，实际 ${response.status}`)
  const quotaResponse = await fetch(`${baseUrl}/api/miniapp/ai/quota`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const quota = await quotaResponse.json()
  assert.equal(quota.used, 0, '上游失败后额度应回滚到 0')
  assert.ok(quota.remaining > 0)
})

check('正常聊天：有效请求返回 200 和模型回答（含敏感数据不泄露）', async ({ baseUrl, token, sensitiveProbe }) => {
  // 显式在 prompt 和 contextSummary 中塞入敏感数据，用于验证日志不会泄露
  // requestId 用身份证号、x-request-id 用模拟 API key，验证日志中只出现短哈希
  const response = await fetch(`${baseUrl}/api/miniapp/ai/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-request-id': sensitiveProbe.sensitiveXRequestId,
    },
    body: JSON.stringify({
      requestId: sensitiveProbe.sensitiveRequestId,
      prompt: `房东不退押金怎么办？我叫${sensitiveProbe.userName}，手机${sensitiveProbe.phone}，住${sensitiveProbe.address}`,
      contextSummary: sensitiveProbe.contextSummary,
    }),
  })
  const data = await response.json()
  assert.equal(response.status, 200)
  assert.equal(data.ok, true)
  assert.equal(data.requestId, sensitiveProbe.sensitiveRequestId)
  assert.ok(data.reply.length > 0)
  assert.ok(!data.replayed, '首次请求不应标记为重放')
  assert.ok(Array.isArray(data.citations))
  assert.equal(data.aiGenerated, true)
  // 收口点1：客户端响应中不得出现 _upstreamUsage
  assert.equal(data._upstreamUsage, undefined, '客户端响应不得包含 _upstreamUsage')
})

check('额度预占：聊天后当日已用额度增加', async ({ baseUrl, token }) => {
  const response = await fetch(`${baseUrl}/api/miniapp/ai/quota`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await response.json()
  assert.equal(response.status, 200)
  assert.equal(data.used, 1)
  assert.equal(data.limit, 3)
  assert.equal(data.remaining, 2)
  assert.ok(data.resetAt)
})

check('幂等重放：相同 requestId 和内容返回缓存结果且不重复扣额度', async ({ baseUrl, token, upstreamState, sensitiveProbe }) => {
  upstreamState.mode = 'success'
  upstreamState.delay = 0
  // 必须使用与首次请求完全相同的 prompt 和 contextSummary 才能命中缓存
  const response = await fetch(`${baseUrl}/api/miniapp/ai/chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId: sensitiveProbe.sensitiveRequestId,
      prompt: `房东不退押金怎么办？我叫${sensitiveProbe.userName}，手机${sensitiveProbe.phone}，住${sensitiveProbe.address}`,
      contextSummary: sensitiveProbe.contextSummary,
    }),
  })
  const data = await response.json()
  assert.equal(response.status, 200)
  assert.equal(data.replayed, true)
  // 收口点1：重放响应中也不得出现 _upstreamUsage
  assert.equal(data._upstreamUsage, undefined, '重放响应不得包含 _upstreamUsage')
  const quotaResponse = await fetch(`${baseUrl}/api/miniapp/ai/quota`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const quota = await quotaResponse.json()
  assert.equal(quota.used, 1, '重放不应再次扣减额度')
})

check('冲突 requestId：相同 requestId 不同内容返回 409', async ({ baseUrl, token, upstreamState, sensitiveProbe }) => {
  upstreamState.mode = 'success'
  upstreamState.delay = 0
  const response = await fetch(`${baseUrl}/api/miniapp/ai/chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId: sensitiveProbe.sensitiveRequestId, prompt: '合同里有违约金条款合理吗？' }),
  })
  const data = await response.json()
  assert.equal(response.status, 409)
  assert.equal(data.code, 'request-id-conflict')
})

check('超时清理：上游超时后返回 504 且额度回滚', async ({ baseUrl, token, upstreamState }) => {
  upstreamState.mode = 'success'
  upstreamState.delay = 6_000
  const start = Date.now()
  const response = await fetch(`${baseUrl}/api/miniapp/ai/chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId: 'timeout-test-request-0001', prompt: '退租时水电费怎么结算？' }),
  })
  const elapsed = Date.now() - start
  upstreamState.delay = 0
  assert.equal(response.status, 504)
  assert.ok(elapsed >= 4_500 && elapsed < 8_000, `应在 5s 超时后返回 504，实际 ${elapsed}ms`)
  const quotaResponse = await fetch(`${baseUrl}/api/miniapp/ai/quota`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const quota = await quotaResponse.json()
  assert.equal(quota.used, 1, '超时回滚后额度应保持 1')
})

check('综合审查：AI 返回逐字证据，幂等缓存只保留无正文完成标记', async ({ baseUrl, token, sensitiveProbe }) => {
  const payload = {
    task: 'contract-review',
    requestId: 'contract-review-http-0001',
    contractText: `出租人姓名：${sensitiveProbe.userName}\n身份证号：${sensitiveProbe.idCard}\n电话：${sensitiveProbe.phone}\n第六条 甲方可随时进入房屋，无需乙方同意。`,
    profile: { contractType: 'lease', partyRole: 'partyB', reviewDepth: 'strict' },
  }
  const send = () => fetch(`${baseUrl}/api/miniapp/ai/chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const firstResponse = await send()
  const first = await firstResponse.json()
  assert.equal(firstResponse.status, 200)
  assert.equal(first.findings.length, 1)
  assert.equal(first.findings[0].source, 'ai')
  assert.equal(first.findings[0].evidence, '甲方可随时进入房屋，无需乙方同意')
  assert.equal(first.reviewedChars > 0, true)
  assert.equal(first._upstreamUsage, undefined)

  const replayResponse = await send()
  const replay = await replayResponse.json()
  assert.equal(replayResponse.status, 409)
  assert.equal(replay.code, 'private-result-not-cached')
  assert.doesNotMatch(JSON.stringify(replay), /甲方可随时进入房屋|张三丰|110101199001011234/)
  const quotaResponse = await fetch(`${baseUrl}/api/miniapp/ai/quota`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const quota = await quotaResponse.json()
  assert.equal(quota.used, 2, '合同复核重放不应重复扣额度')
})

check('综合审查取消：服务端中止上游调用并回滚额度', async ({ baseUrl, token, upstreamState }) => {
  upstreamState.mode = 'success'
  upstreamState.delay = 6_000
  const abortedBefore = upstreamState.aborted
  const requestId = 'contract-cancel-http-0001'
  const reviewPromise = fetch(`${baseUrl}/api/miniapp/ai/chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task: 'contract-review',
      requestId,
      contractText: '第六条 甲方可随时进入房屋，无需乙方同意。',
      profile: { contractType: 'lease', partyRole: 'partyB', reviewDepth: 'strict' },
    }),
  })
  await new Promise((resolve) => setTimeout(resolve, 150))
  const cancelResponse = await fetch(`${baseUrl}/api/miniapp/ai/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId }),
  })
  const cancellation = await cancelResponse.json()
  assert.equal(cancelResponse.status, 200)
  assert.equal(cancellation.cancelled, true)
  const reviewResponse = await reviewPromise
  assert.equal(reviewResponse.status, 499)
  upstreamState.delay = 0
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.ok(upstreamState.aborted > abortedBefore, '上游连接应在取消后中止')
  const quota = await (await fetch(`${baseUrl}/api/miniapp/ai/quota`, { headers: { Authorization: `Bearer ${token}` } })).json()
  assert.equal(quota.used, 2, '取消后应回滚额度')
})

check('综合审查分段容错：单个分段失败仍返回成功分段', async ({ baseUrl, token, upstreamState }) => {
  upstreamState.mode = 'success'
  upstreamState.failNext = 1
  const contractText = '甲方可随时进入房屋，无需乙方同意。\n'.repeat(900)
  const response = await fetch(`${baseUrl}/api/miniapp/ai/chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task: 'contract-review',
      requestId: 'contract-partial-http-0001',
      contractText,
      profile: { contractType: 'lease', partyRole: 'partyB', reviewDepth: 'strict' },
    }),
  })
  const result = await response.json()
  assert.equal(response.status, 200)
  assert.equal(result.partial, true)
  assert.ok(result.chunksTotal > result.chunksReviewed)
  assert.ok(result.chunksReviewed > 0)
  assert.equal(result.findings.length, 1)
})

check('DOCX 上传：真实文档解析出合同正文（含敏感数据不泄露）', async ({ baseUrl, token, sensitiveProbe }) => {
  // 显式在合同正文中塞入敏感数据，用于验证日志不会泄露合同正文
  const document = new Document({ sections: [{ children: [
    new Paragraph('房屋租赁合同'),
    new Paragraph(sensitiveProbe.contractClause),
    new Paragraph(`承租人：${sensitiveProbe.userName}，身份证：${sensitiveProbe.idCard}，电话：${sensitiveProbe.phone}`),
    new Paragraph(`房屋坐落：${sensitiveProbe.address}`),
  ] }] })
  const buffer = await Packer.toBuffer(document)
  const response = await fetch(`${baseUrl}/api/miniapp/contract/parse`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileBase64: buffer.toString('base64'), fileName: '合同.docx' }),
  })
  const data = await response.json()
  assert.equal(response.status, 200)
  assert.equal(data.ok, true)
  assert.equal(data.extension, 'docx')
  assert.match(data.text, /房屋租赁合同/)
  assert.match(data.text, /退租时三日内返还/)
  assert.equal(data.retained, false)
})

check('PDF 上传：真实样本逐页解析出正文', async ({ baseUrl, token }) => {
  const buffer = await readFile(new URL('../public/dataset/rental-contracts/qhd-2025-rental-contract.pdf', import.meta.url))
  const response = await fetch(`${baseUrl}/api/miniapp/contract/parse`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileBase64: buffer.toString('base64'), fileName: '示范合同.pdf' }),
  })
  const data = await response.json()
  assert.equal(response.status, 200)
  assert.equal(data.ok, true)
  assert.equal(data.extension, 'pdf')
  assert.ok(data.pageCount > 1)
  assert.match(data.text, /房屋租赁合同/)
  assert.equal(data.retained, false)
})

check('OCR 格式拒绝：非图片扩展名返回 415', async ({ baseUrl, token }) => {
  const response = await fetch(`${baseUrl}/api/miniapp/ocr/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileBase64: Buffer.from('hello world').toString('base64'), fileName: 'not-an-image.txt' }),
  })
  const data = await response.json()
  assert.equal(response.status, 415)
  assert.equal(data.code, 'unsupported-image')
})

check('OCR 签名拒绝：伪造图片返回 415', async ({ baseUrl, token }) => {
  const response = await fetch(`${baseUrl}/api/miniapp/ocr/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileBase64: Buffer.from('fake image content').toString('base64'), fileName: 'fake.jpg' }),
  })
  const data = await response.json()
  assert.equal(response.status, 415)
  assert.equal(data.code, 'invalid-image-signature')
})

main().catch((error) => {
  console.error('Miniapp HTTP integration test failed:', error)
  process.exit(1)
})
