import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import multer from 'multer'
import crypto from 'node:crypto'
import { existsSync } from 'node:fs'
import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWorker } from 'tesseract.js'
import { aiEvalCases } from './data/ai-eval-cases.mjs'
import { evaluateKnowledgeRetrieval, searchKnowledge } from './rag-engine.mjs'
import {
  createMiniappSessionToken,
  exchangeWechatLoginCode,
  getBearerToken,
  getCloudContainerIdentity,
  isValidMiniappSessionSecret,
  verifyMiniappSessionToken,
} from './miniapp-auth.mjs'
import {
  AI_GENERATED_NOTICE,
  buildMiniappAiMessages,
  buildMiniappCitations,
  buildMiniappContractReviewMessages,
  extractAiReply,
  extractMiniappContractReviewFindings,
  getContractReviewKnowledgeQuery,
  getMiniappAiRequestFingerprint,
  isCasualMiniappPrompt,
  mergeMiniappContractReviewFindings,
  normalizeMiniappAiRequest,
  splitMiniappContractForReview,
} from './miniapp-ai.mjs'
import { parseContractDocument } from './contract-document-parser.mjs'
import { createMiniappUsageStore } from './miniapp-usage-store.mjs'

dotenv.config()

// 结构化脱敏日志：只输出白名单字段，禁止记录用户问题、合同正文、contextSummary、
// 姓名、手机号、地址、openid、session token、API Key、Redis Token 等敏感数据。
const LOG_FIELD_WHITELIST = new Set([
  'requestId', 'route', 'statusCode', 'elapsedMs', 'model', 'provider',
  'usage', 'replayed', 'errorCode', 'storeMode',
])

// 对 requestId 做稳定短哈希，避免原样记录 body.requestId 或 x-request-id。
// 用户可能把身份证号、session token 等敏感数据放进 requestId，因此必须脱敏。
function hashRequestId(requestId) {
  if (!requestId || typeof requestId !== 'string') return null
  const hash = crypto.createHash('sha256').update(requestId).digest('hex')
  return `rid_${hash.slice(0, 12)}`
}

function logStructured(fields) {
  const entry = {}
  for (const key of LOG_FIELD_WHITELIST) {
    if (fields[key] !== undefined && fields[key] !== null) entry[key] = fields[key]
  }
  // requestId 统一替换为稳定短哈希，不记录原值
  if (entry.requestId) {
    entry.requestId = hashRequestId(entry.requestId)
  }
  // 强制脱敏：usage 只保留 token 数字，不保留任何文本字段
  if (entry.usage && typeof entry.usage === 'object') {
    entry.usage = {
      prompt_tokens: Number(entry.usage.prompt_tokens) || 0,
      completion_tokens: Number(entry.usage.completion_tokens) || 0,
      total_tokens: Number(entry.usage.total_tokens) || 0,
    }
  }
  console.log(JSON.stringify(entry))
}

const app = express()
const port = Number(process.env.PORT || process.env.AI_PROXY_PORT || 8787)
const allowedOrigin = process.env.AI_PROXY_ALLOWED_ORIGIN || 'http://localhost:5173'
const allowedOrigins = new Set(allowedOrigin.split(',').map((origin) => origin.trim()).filter(Boolean))
const requireTrustedOrigin = process.env.AI_PROXY_REQUIRE_ORIGIN === 'true' || process.env.NODE_ENV === 'production'
const accessToken = String(process.env.AI_PROXY_ACCESS_TOKEN || '').trim()
const wxAppId = String(process.env.WX_APPID || '').trim()
const wxAppSecret = String(process.env.WX_SECRET || '').trim()
const miniappSessionSecret = String(process.env.MINIAPP_SESSION_SECRET || '').trim()
const miniappSessionTtlSeconds = Math.max(300, Math.min(Number(process.env.MINIAPP_SESSION_TTL_SECONDS) || 7_200, 604_800))
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const indexHtmlPath = path.join(distDir, 'index.html')
const upstreamTimeoutMs = Math.max(5_000, Math.min(Number(process.env.AI_PROXY_TIMEOUT_MS) || 45_000, 120_000))
const ocrTimeoutMs = Math.max(15_000, Math.min(Number(process.env.OCR_TIMEOUT_MS) || 90_000, 180_000))
let ocrInFlight = false
let contractParsesInFlight = 0
const maxConcurrentContractParses = 2
const rateWindowMs = 60_000
const rateBuckets = new Map()
const quotaBuckets = new Map()
const miniappAiRequestCache = new Map()
const miniappAiAbortControllers = new Map()
const dailyQuota = Math.max(1, Number(process.env.AI_DAILY_QUOTA || 40))
const miniappUsageStore = createMiniappUsageStore({
  redisUrl: process.env.UPSTASH_REDIS_REST_URL,
  redisToken: process.env.UPSTASH_REDIS_REST_TOKEN,
})
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
})

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true)
      return
    }
    callback(new Error('CORS origin is not allowed'))
  },
}))
app.use(express.json({ limit: '12mb' }))

const maxUploadBytes = 8 * 1024 * 1024
const uploadMimeTypes = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  md: 'text/markdown',
}

function acceptJsonUpload(fieldName) {
  return (request, response, next) => {
    if (request.file || !request.body?.fileBase64) {
      next()
      return
    }
    const fileBase64 = String(request.body.fileBase64)
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(fileBase64) || fileBase64.length % 4 !== 0) {
      response.status(400).json({ message: '文件内容格式无效', code: 'invalid-file' })
      return
    }
    const buffer = Buffer.from(fileBase64, 'base64')
    if (!buffer.length || buffer.length > maxUploadBytes) {
      response.status(413).json({ message: '文件超过 8MB 限制', code: 'file-too-large' })
      return
    }
    const originalname = path.basename(String(request.body.fileName || `${fieldName}.bin`)).slice(0, 200)
    const extension = path.extname(originalname).slice(1).toLowerCase()
    request.file = {
      buffer,
      originalname,
      mimetype: uploadMimeTypes[extension] || 'application/octet-stream',
      size: buffer.length,
    }
    next()
  }
}

function rateLimit(scope, maxRequests) {
  return (request, response, next) => {
    const identity = request.miniappSession?.openid || request.ip || request.socket.remoteAddress || 'unknown'
    const key = `${scope}:${identity}`
    const now = Date.now()
    const current = rateBuckets.get(key)
    const bucket = current && now - current.startedAt < rateWindowMs
      ? current
      : { startedAt: now, count: 0 }

    bucket.count += 1
    rateBuckets.set(key, bucket)

    if (bucket.count > maxRequests) {
      response.set('Retry-After', '60')
      response.status(429).json({ message: '请求过于频繁，请稍后再试' })
      return
    }

    if (rateBuckets.size > 2_000) {
      for (const [bucketKey, entry] of rateBuckets) {
        if (now - entry.startedAt >= rateWindowMs) rateBuckets.delete(bucketKey)
      }
    }

    next()
  }
}

function getAccountId(request) {
  if (request.miniappSession?.openid) return `wx:${request.miniappSession.openid}`
  return String(request.get('x-rental-safe-account') || `ip:${request.ip || request.socket.remoteAddress || 'unknown'}`).slice(0, 120)
}

function getQuotaSnapshot(accountId) {
  const day = new Date().toISOString().slice(0, 10)
  for (const quotaKey of quotaBuckets.keys()) {
    if (!quotaKey.startsWith(`${day}:`)) quotaBuckets.delete(quotaKey)
  }
  const key = `${day}:${accountId}`
  const used = quotaBuckets.get(key)?.used || 0
  return { key, used, limit: dailyQuota, remaining: Math.max(0, dailyQuota - used), resetAt: `${day}T23:59:59.999Z` }
}

function toPublicQuota(quota) {
  return {
    used: quota.used,
    limit: quota.limit,
    remaining: quota.remaining,
    resetAt: quota.resetAt,
  }
}

function reserveQuota(accountId) {
  const quota = getQuotaSnapshot(accountId)
  if (quota.remaining <= 0) return { ok: false, quota }
  quotaBuckets.set(quota.key, { used: quota.used + 1 })
  return { ok: true, quota: getQuotaSnapshot(accountId) }
}

function rollbackQuota(accountId) {
  const quota = getQuotaSnapshot(accountId)
  quotaBuckets.set(quota.key, { used: Math.max(0, quota.used - 1) })
}

function quotaLimit(request, response, next) {
  const accountId = getAccountId(request)
  const reservation = reserveQuota(accountId)
  if (!reservation.ok) {
    response.set('Retry-After', '3600')
    response.status(429).json({ message: '当前账号今日 AI 额度已用完，请明日再试', quota: toPublicQuota(reservation.quota) })
    return
  }
  response.set('X-AI-Quota-Limit', String(dailyQuota))
  response.set('X-AI-Quota-Remaining', String(reservation.quota.remaining))
  next()
}

function authenticateMiniappSession(request, response, next) {
  const result = verifyMiniappSessionToken(getBearerToken(request), miniappSessionSecret)
  if (!result.ok) {
    logStructured({
      requestId: request.get('x-request-id') || 'auth-fail',
      route: request.path,
      statusCode: 401,
      errorCode: result.reason || 'auth-failed',
      storeMode: miniappUsageStore.mode,
    })
    response.status(401).json({ message: '登录状态已失效，请重新登录', reason: result.reason })
    return
  }
  request.miniappSession = result
  next()
}

function trustedApiRequest(request, response, next) {
  const miniappSession = verifyMiniappSessionToken(getBearerToken(request), miniappSessionSecret)
  if (miniappSession.ok) {
    request.miniappSession = miniappSession
    next()
    return
  }

  if (!requireTrustedOrigin && !accessToken) {
    next()
    return
  }

  const token = String(request.get('x-ai-proxy-token') || '').trim()
  if (accessToken && token === accessToken) {
    next()
    return
  }

  const origin = String(request.get('origin') || '').trim()
  if (origin && allowedOrigins.has(origin)) {
    next()
    return
  }

  response.status(403).json({ message: '请求来源未被允许' })
}

const providerPresets = {
  'OpenAI-compatible': {
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4.1-mini',
    keyEnv: ['OPENAI_API_KEY', 'AI_PROXY_API_KEY'],
  },
  DeepSeek: {
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-v4-flash',
    keyEnv: ['DEEPSEEK_API_KEY', 'AI_PROXY_API_KEY'],
  },
  '通义千问': {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    keyEnv: ['DASHSCOPE_API_KEY', 'QWEN_API_KEY', 'AI_PROXY_API_KEY'],
  },
  '智谱 GLM': {
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    keyEnv: ['ZHIPU_API_KEY', 'BIGMODEL_API_KEY', 'AI_PROXY_API_KEY'],
  },
  Moonshot: {
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    keyEnv: ['MOONSHOT_API_KEY', 'AI_PROXY_API_KEY'],
  },
  '百川智能': {
    baseUrl: 'https://api.baichuan-ai.com/v1',
    defaultModel: 'Baichuan4',
    keyEnv: ['BAICHUAN_API_KEY', 'AI_PROXY_API_KEY'],
  },
  '腾讯混元': {
    baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
    defaultModel: 'hunyuan-lite',
    keyEnv: ['HUNYUAN_API_KEY', 'TENCENT_HUNYUAN_API_KEY', 'AI_PROXY_API_KEY'],
  },
  '火山方舟': {
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-1-5-lite-32k-250115',
    keyEnv: ['ARK_API_KEY', 'VOLCENGINE_API_KEY', 'AI_PROXY_API_KEY'],
  },
  MiniMax: {
    baseUrl: 'https://api.minimax.chat/v1',
    defaultModel: 'MiniMax-Text-01',
    keyEnv: ['MINIMAX_API_KEY', 'AI_PROXY_API_KEY'],
  },
}

function buildChatCompletionsUrl(baseUrl) {
  const trimmed = String(baseUrl || '').trim().replace(/\/$/, '')
  if (!trimmed) return ''
  if (trimmed.endsWith('/chat/completions')) return trimmed
  if (/^https:\/\/api\.deepseek\.com\/?$/i.test(trimmed)) return `${trimmed}/chat/completions`
  if (trimmed.endsWith('/v1')) return `${trimmed}/chat/completions`
  return `${trimmed}/v1/chat/completions`
}

function readFirstEnv(keys) {
  return keys.map((key) => process.env[key]).find(Boolean) || ''
}

async function prepareTesseractLangPath() {
  const langPath = path.join(rootDir, '.cache', 'tesseract-lang')
  const languageFiles = [
    {
      from: path.join(rootDir, 'node_modules', '@tesseract.js-data', 'chi_sim', '4.0.0', 'chi_sim.traineddata.gz'),
      to: path.join(langPath, 'chi_sim.traineddata.gz'),
    },
    {
      from: path.join(rootDir, 'node_modules', '@tesseract.js-data', 'eng', '4.0.0', 'eng.traineddata.gz'),
      to: path.join(langPath, 'eng.traineddata.gz'),
    },
  ]

  await mkdir(langPath, { recursive: true })
  await Promise.all(languageFiles.map((item) => copyFile(item.from, item.to)))
  return langPath
}

// 轻量图片魔数校验：只接受 JPG/PNG/WEBP 真实签名，防止伪造扩展名进入 OCR worker
export function detectImageSignature(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 20) return null
  // JPEG: SOI/marker + EOI
  if (
    buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    && buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9
  ) return 'jpeg'
  // PNG: signature + terminal IEND chunk
  const pngEnd = Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82])
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
    && buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
    && buffer.subarray(-pngEnd.length).equals(pngEnd)
  ) return 'png'
  // WEBP: RIFF size + WEBP + a supported image chunk
  const webpChunk = buffer.subarray(12, 16).toString('ascii')
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46
    && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    && buffer.readUInt32LE(4) + 8 === buffer.length
    && ['VP8 ', 'VP8L', 'VP8X'].includes(webpChunk)
  ) return 'webp'
  return null
}

export async function recognizeImageOffline(buffer, {
  createWorkerImpl = createWorker,
  prepareLangPath = prepareTesseractLangPath,
  timeoutMs = ocrTimeoutMs,
} = {}) {
  const langPath = await prepareLangPath()
  const worker = await createWorkerImpl('chi_sim+eng', 1, {
    langPath,
    cachePath: path.join(rootDir, '.cache', 'tesseract'),
    gzip: true,
  })
  let timeoutId = 0

  try {
    const result = await Promise.race([
      worker.recognize(buffer),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('offline OCR timed out')), timeoutMs)
      }),
    ])
    return {
      text: result.data.text.trim(),
      confidence: Math.round(result.data.confidence || 0),
    }
  } finally {
    clearTimeout(timeoutId)
    await worker.terminate()
  }
}

function resolveProviderConfig({ provider, baseUrl, model } = {}) {
  const selectedProvider = provider || process.env.AI_PROXY_PROVIDER || (process.env.DEEPSEEK_API_KEY ? 'DeepSeek' : 'OpenAI-compatible')
  const preset = providerPresets[selectedProvider] || null
  const allowCustom = process.env.AI_PROXY_ALLOW_CUSTOM_UPSTREAM === 'true'

  if (preset) {
    return {
      endpoint: buildChatCompletionsUrl(process.env.AI_PROXY_BASE_URL || preset.baseUrl),
      apiKey: readFirstEnv(preset.keyEnv),
      model: model || process.env.AI_PROXY_MODEL || preset.defaultModel,
      provider: selectedProvider,
    }
  }

  if (allowCustom) {
    return {
      endpoint: buildChatCompletionsUrl(process.env.AI_PROXY_BASE_URL || baseUrl || ''),
      apiKey: process.env.AI_PROXY_API_KEY || '',
      model: process.env.AI_PROXY_MODEL || model || '',
      provider: provider || 'custom',
    }
  }

  return {
    endpoint: buildChatCompletionsUrl(process.env.AI_PROXY_BASE_URL || 'https://api.openai.com/v1'),
    apiKey: process.env.AI_PROXY_API_KEY || '',
    model: process.env.AI_PROXY_MODEL || 'gpt-4.1-mini',
    provider: 'server-default',
  }
}

async function requestAiCompletion({ config, messages, temperature = 0.2, maxTokens = 2_200, signal }) {
  if (!config.endpoint) {
    const error = new Error('AI 服务地址尚未配置')
    error.status = 503
    throw error
  }
  if (!config.apiKey) {
    const error = new Error('AI 服务密钥尚未配置')
    error.status = 503
    throw error
  }

  const controller = new AbortController()
  const abortFromCaller = () => controller.abort()
  if (signal?.aborted) abortFromCaller()
  else signal?.addEventListener('abort', abortFromCaller, { once: true })
  const timeout = setTimeout(() => controller.abort(), upstreamTimeoutMs)
  try {
    const upstreamResponse = await fetch(config.endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        temperature: Math.max(0, Math.min(Number(temperature) || 0.2, 1)),
        max_tokens: Math.max(256, Math.min(Number(maxTokens) || 2_200, 4_000)),
        messages,
        ...(config.provider === 'DeepSeek' ? { thinking: { type: 'disabled' } } : {}),
      }),
    })
    const data = await upstreamResponse.json().catch(() => ({}))
    if (!upstreamResponse.ok) {
      const error = new Error(data?.error?.message || data?.message || `上游 AI 请求失败（HTTP ${upstreamResponse.status}）`)
      error.status = upstreamResponse.status >= 400 && upstreamResponse.status < 600 ? upstreamResponse.status : 502
      throw error
    }
    return data
  } catch (error) {
    if (error?.name === 'AbortError') {
      if (signal?.aborted) {
        const cancelledError = new Error('AI 请求已取消')
        cancelledError.status = 499
        cancelledError.code = 'client-aborted'
        throw cancelledError
      }
      const timeoutError = new Error('AI 响应超时，请稍后重试')
      timeoutError.status = 504
      throw timeoutError
    }
    throw error
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abortFromCaller)
  }
}

function cleanupMiniappAiRequestCache(now = Date.now()) {
  const ttl = 15 * 60 * 1_000
  for (const [key, entry] of miniappAiRequestCache) {
    if (now - entry.createdAt > ttl) miniappAiRequestCache.delete(key)
  }
  if (miniappAiRequestCache.size <= 1_000) return
  const oldest = [...miniappAiRequestCache.entries()]
    .sort((left, right) => left[1].createdAt - right[1].createdAt)
    .slice(0, miniappAiRequestCache.size - 1_000)
  oldest.forEach(([key]) => miniappAiRequestCache.delete(key))
}

app.get('/api/health', async (_request, response) => {
  const config = resolveProviderConfig()
  const usageHealth = await miniappUsageStore.checkHealth()
  response.json({
    ok: true,
    miniappApiVersion: 3,
    provider: config.provider,
    model: config.model,
    hasApiKey: Boolean(config.apiKey),
    miniappAuthConfigured: Boolean(wxAppId && wxAppSecret && isValidMiniappSessionSecret(miniappSessionSecret)),
    miniappUsageStore: miniappUsageStore.mode,
    miniappUsagePersistent: miniappUsageStore.mode !== 'memory',
    miniappUsageHealthy: usageHealth.ok,
    contractDocumentParsing: true,
    ocrMode: 'offline-tesseract',
  })
})

app.post('/api/auth/wx-login', rateLimit('wx-login', 12), async (request, response) => {
  response.set('Cache-Control', 'no-store')
  const startedAt = Date.now()
  const requestId = request.get('x-request-id') || `wxlogin-${startedAt}`
  const route = '/api/auth/wx-login'
  if (!isValidMiniappSessionSecret(miniappSessionSecret)) {
    logStructured({ requestId, route, statusCode: 503, elapsedMs: Date.now() - startedAt, errorCode: 'session-not-configured', storeMode: miniappUsageStore.mode })
    response.status(503).json({ message: '微信会话服务尚未配置' })
    return
  }

  try {
    const identity = getCloudContainerIdentity(request.headers, wxAppId)
      || await exchangeWechatLoginCode({
        code: request.body?.code,
        appId: wxAppId,
        appSecret: wxAppSecret,
      })
    const session = createMiniappSessionToken({ ...identity, ttlSeconds: miniappSessionTtlSeconds }, miniappSessionSecret)
    const quota = await miniappUsageStore.getQuota(`wx:${identity.openid}`, dailyQuota)
    logStructured({ requestId, route, statusCode: 200, elapsedMs: Date.now() - startedAt, storeMode: miniappUsageStore.mode })
    response.json({
      ok: true,
      token: session.token,
      expiresAt: session.expiresAt,
      quota: toPublicQuota(quota),
    })
  } catch (error) {
    logStructured({ requestId, route, statusCode: error?.status || 502, elapsedMs: Date.now() - startedAt, errorCode: 'wx-login-failed', storeMode: miniappUsageStore.mode })
    response.status(error?.status || 502).json({ message: error?.message || '微信登录失败，请稍后重试' })
  }
})

app.post('/api/miniapp/ai/cancel', authenticateMiniappSession, rateLimit('miniapp-cancel', 30), (request, response) => {
  const requestId = String(request.body?.requestId || '').trim()
  if (!/^[A-Za-z0-9_-]{12,96}$/.test(requestId)) {
    response.status(400).json({ message: 'AI 请求标识无效' })
    return
  }
  const controller = miniappAiAbortControllers.get(`${getAccountId(request)}:${requestId}`)
  controller?.abort()
  response.json({ ok: true, cancelled: Boolean(controller) })
})

app.get('/api/miniapp/ai/quota', authenticateMiniappSession, rateLimit('miniapp-quota', 60), async (request, response) => {
  response.set('Cache-Control', 'no-store')
  try {
    response.json(toPublicQuota(await miniappUsageStore.getQuota(getAccountId(request), dailyQuota)))
  } catch (error) {
    response.status(error?.status || 503).json({ message: error?.message || '额度服务暂时不可用' })
  }
})

app.post('/api/miniapp/ai/chat', authenticateMiniappSession, rateLimit('miniapp-chat', 20), async (request, response) => {
  response.set('Cache-Control', 'no-store')
  const startedAt = Date.now()
  let input
  try {
    input = normalizeMiniappAiRequest(request.body)
  } catch (error) {
    logStructured({
      requestId: request.get('x-request-id') || 'invalid-input',
      route: '/api/miniapp/ai/chat',
      statusCode: error?.status || 400,
      elapsedMs: Date.now() - startedAt,
      errorCode: 'invalid-input',
      storeMode: miniappUsageStore.mode,
    })
    response.status(error?.status || 400).json({ message: error?.message || 'AI 请求内容无效' })
    return
  }

  cleanupMiniappAiRequestCache()
  const accountId = getAccountId(request)
  const cacheKey = `${accountId}:${input.requestId}`
  const requestHash = getMiniappAiRequestFingerprint(input)
  const cached = miniappAiRequestCache.get(cacheKey)
  if (cached) {
    if (cached.requestHash !== requestHash) {
      logStructured({
        requestId: input.requestId,
        route: '/api/miniapp/ai/chat',
        statusCode: 409,
        elapsedMs: Date.now() - startedAt,
        errorCode: 'request-id-conflict',
        storeMode: miniappUsageStore.mode,
      })
      response.status(409).json({ message: '请求标识已被其他问题使用，请重新发送', code: 'request-id-conflict' })
      return
    }
    try {
      // cached.promise 解析为 { result, upstreamUsage }；upstreamUsage 不进入重放响应
      const resolved = cached.result ? { result: cached.result } : await cached.promise
      const result = resolved.result || resolved
      logStructured({
        requestId: input.requestId,
        route: '/api/miniapp/ai/chat',
        statusCode: 200,
        elapsedMs: Date.now() - startedAt,
        replayed: true,
        storeMode: miniappUsageStore.mode,
      })
      response.json({ ...result, replayed: true })
    } catch (error) {
      logStructured({
        requestId: input.requestId,
        route: '/api/miniapp/ai/chat',
        statusCode: error?.status || 502,
        elapsedMs: Date.now() - startedAt,
        replayed: true,
        errorCode: 'replay-failed',
        storeMode: miniappUsageStore.mode,
      })
      response.status(error?.status || 502).json({ message: error?.message || 'AI 请求失败，请稍后重试' })
    }
    return
  }


  let claim
  try {
    claim = await miniappUsageStore.claimRequest(accountId, input.requestId, requestHash, dailyQuota)
  } catch (error) {
    logStructured({
      requestId: input.requestId,
      route: '/api/miniapp/ai/chat',
      statusCode: error?.status || 503,
      elapsedMs: Date.now() - startedAt,
      errorCode: 'claim-failed',
      storeMode: miniappUsageStore.mode,
    })
    response.status(error?.status || 503).json({ message: error?.message || '额度服务暂时不可用' })
    return
  }
  if (claim.status === 'cached') {
    const persistedResult = claim.value?.result || claim.value
    if (persistedResult?.privateResultOmitted) {
      logStructured({
        requestId: input.requestId,
        route: '/api/miniapp/ai/chat',
        statusCode: 409,
        elapsedMs: Date.now() - startedAt,
        replayed: true,
        errorCode: 'private-result-not-cached',
        storeMode: miniappUsageStore.mode,
      })
      response.status(409).json({
        message: '该合同审查已完成；为保护合同隐私，服务端不缓存逐字证据，请重新点击综合审查获取新报告',
        code: 'private-result-not-cached',
      })
      return
    }
    miniappAiRequestCache.set(cacheKey, { createdAt: Date.now(), requestHash, result: persistedResult })
    logStructured({
      requestId: input.requestId,
      route: '/api/miniapp/ai/chat',
      statusCode: 200,
      elapsedMs: Date.now() - startedAt,
      replayed: true,
      storeMode: miniappUsageStore.mode,
    })
    response.json({ ...persistedResult, replayed: true })
    return
  }
  if (claim.status === 'conflict') {
    logStructured({
      requestId: input.requestId,
      route: '/api/miniapp/ai/chat',
      statusCode: 409,
      elapsedMs: Date.now() - startedAt,
      errorCode: 'request-id-conflict',
      storeMode: miniappUsageStore.mode,
    })
    response.status(409).json({ message: '请求标识已被其他问题使用，请重新发送', code: 'request-id-conflict' })
    return
  }
  if (claim.status === 'pending') {
    response.set('Retry-After', '2')
    logStructured({
      requestId: input.requestId,
      route: '/api/miniapp/ai/chat',
      statusCode: 425,
      elapsedMs: Date.now() - startedAt,
      errorCode: 'request-in-progress',
      storeMode: miniappUsageStore.mode,
    })
    response.status(425).json({ message: '相同请求正在处理中，请稍后重试', code: 'request-in-progress' })
    return
  }
  if (claim.status === 'quota') {
    response.set('Retry-After', '3600')
    logStructured({
      requestId: input.requestId,
      route: '/api/miniapp/ai/chat',
      statusCode: 429,
      elapsedMs: Date.now() - startedAt,
      errorCode: 'quota-exhausted',
      storeMode: miniappUsageStore.mode,
    })
    response.status(429).json({ message: '今日联网 AI 额度已用完，本地分析仍可使用', quota: toPublicQuota(claim.quota) })
    return
  }
  const reservation = { quota: claim.quota }

  const config = resolveProviderConfig()
  const workController = new AbortController()
  const abortOnDisconnect = () => {
    if (!response.writableEnded) workController.abort()
  }
  miniappAiAbortControllers.set(cacheKey, workController)
  response.once('close', abortOnDisconnect)
  // work 返回 { result, upstreamUsage }：result 是纯净的客户端结果，不含 _upstreamUsage；
  // upstreamUsage 只用于结构化日志，绝不进入内存缓存、Redis 幂等缓存或客户端响应。
  const work = (async () => {
    if (input.task === 'contract-review') {
      const chunks = splitMiniappContractForReview(input.contractText)
      const knowledge = searchKnowledge(getContractReviewKnowledgeQuery(input.profile.contractType), 4)
      const settledResults = await Promise.allSettled(chunks.map(async (chunk, chunkIndex) => {
        const data = await requestAiCompletion({
          config,
          messages: buildMiniappContractReviewMessages({
            chunk,
            chunkIndex,
            chunkCount: chunks.length,
            profile: input.profile,
            knowledge,
            localFindings: input.localFindings,
          }),
          temperature: 0.1,
          maxTokens: 1_600,
          signal: workController.signal,
        })
        const findings = extractMiniappContractReviewFindings(data, chunk).filter((finding) => (
          input.profile.reviewDepth === 'strict'
          || (input.profile.reviewDepth === 'business' ? finding.level === 'high' : finding.level !== 'low')
        ))
        return {
          findings,
          usage: data?.usage,
        }
      }))
      if (workController.signal.aborted) {
        const error = new Error('AI 请求已取消')
        error.status = 499
        error.code = 'client-aborted'
        throw error
      }
      const results = settledResults.filter((item) => item.status === 'fulfilled').map((item) => item.value)
      if (!results.length) throw settledResults.find((item) => item.status === 'rejected')?.reason || new Error('AI 分段复核失败')
      const failedChunks = settledResults.length - results.length
      const upstreamUsage = results.reduce((total, item) => ({
        prompt_tokens: total.prompt_tokens + (Number(item.usage?.prompt_tokens) || 0),
        completion_tokens: total.completion_tokens + (Number(item.usage?.completion_tokens) || 0),
        total_tokens: total.total_tokens + (Number(item.usage?.total_tokens) || 0),
      }), { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 })
      return {
        result: {
          ok: true,
          requestId: input.requestId,
          findings: mergeMiniappContractReviewFindings(results.map((item) => item.findings)),
          reviewedChars: input.contractText.length,
          chunksReviewed: results.length,
          chunksTotal: chunks.length,
          partial: failedChunks > 0,
          aiGenerated: true,
          notice: AI_GENERATED_NOTICE,
          quota: toPublicQuota(reservation.quota),
        },
        upstreamUsage,
      }
    }

    const knowledge = isCasualMiniappPrompt(input.prompt)
      ? []
      : searchKnowledge(`${input.prompt} ${input.contextSummary}`, 4)
    const messages = buildMiniappAiMessages({ ...input, knowledge })
    const data = await requestAiCompletion({ config, messages, temperature: 0.2, maxTokens: 900, signal: workController.signal })
    const result = {
      ok: true,
      requestId: input.requestId,
      reply: extractAiReply(data),
      citations: buildMiniappCitations(knowledge),
      aiGenerated: true,
      notice: AI_GENERATED_NOTICE,
      // 额度已在调用模型前原子预占。直接返回预占快照，避免模型成功后
      // 因额度存储的第二次读取短暂失败而把有效回答误报为失败。
      quota: toPublicQuota(reservation.quota),
    }
    return { result, upstreamUsage: data?.usage }
  })()
  miniappAiRequestCache.set(cacheKey, { createdAt: Date.now(), requestHash, promise: work })

  try {
    const { result, upstreamUsage } = await work
    const persistedResult = input.task === 'contract-review'
      ? { requestId: input.requestId, privateResultOmitted: true }
      : result
    if (input.task === 'contract-review') miniappAiRequestCache.delete(cacheKey)
    else miniappAiRequestCache.set(cacheKey, { createdAt: Date.now(), requestHash, result })
    try {
      await miniappUsageStore.completeRequest(accountId, input.requestId, requestHash, persistedResult)
    } catch (cacheError) {
      logStructured({
        requestId: input.requestId,
        route: '/api/miniapp/ai/chat',
        statusCode: 500,
        errorCode: 'idempotency-cache-write-failed',
        storeMode: miniappUsageStore.mode,
      })
    }
    logStructured({
      requestId: input.requestId,
      route: '/api/miniapp/ai/chat',
      statusCode: 200,
      elapsedMs: Date.now() - startedAt,
      model: config.model,
      provider: config.provider,
      usage: upstreamUsage,
      replayed: false,
      storeMode: miniappUsageStore.mode,
    })
    response.json(result)
  } catch (error) {
    miniappAiRequestCache.delete(cacheKey)
    try {
      await miniappUsageStore.rollbackRequest(accountId, input.requestId, requestHash, dailyQuota)
    } catch (rollbackError) {
      logStructured({
        requestId: input.requestId,
        route: '/api/miniapp/ai/chat',
        statusCode: 500,
        errorCode: 'quota-rollback-failed',
        storeMode: miniappUsageStore.mode,
      })
    }
    const errorCode = error?.status === 504 ? 'upstream-timeout' : 'upstream-failed'
    logStructured({
      requestId: input.requestId,
      route: '/api/miniapp/ai/chat',
      statusCode: error?.status || 502,
      elapsedMs: Date.now() - startedAt,
      model: config.model,
      provider: config.provider,
      errorCode,
      storeMode: miniappUsageStore.mode,
    })
    if (!response.destroyed) response.status(error?.status || 502).json({ message: error?.message || 'AI 请求失败，请稍后重试' })
  }
  response.off('close', abortOnDisconnect)
  if (miniappAiAbortControllers.get(cacheKey) === workController) miniappAiAbortControllers.delete(cacheKey)
})

function sendRagSearchResponse(response, { query, limit }) {
  const normalizedQuery = String(query || '').slice(0, 4_000)
  const items = searchKnowledge(normalizedQuery, limit)

  response.json({
    ok: true,
    mode: 'local-hybrid-rag',
    query: normalizedQuery,
    total: items.length,
    items,
  })
}

app.get('/api/rag/search', trustedApiRequest, rateLimit('rag', 60), (request, response) => {
  sendRagSearchResponse(response, {
    query: String(request.query.q || ''),
    limit: Number(request.query.limit || 5),
  })
})

app.post('/api/rag/search', trustedApiRequest, rateLimit('rag', 60), (request, response) => {
  sendRagSearchResponse(response, {
    query: String(request.body?.query || request.body?.q || ''),
    limit: Number(request.body?.limit || 5),
  })
})

app.get('/api/rag/evaluate', trustedApiRequest, rateLimit('rag-evaluate', 10), (request, response) => {
  const limit = Number(request.query.limit || 5)
  const results = evaluateKnowledgeRetrieval(aiEvalCases, limit)
  const passed = results.filter((item) => item.passed).length

  response.json({
    ok: passed === results.length,
    mode: 'local-hybrid-rag',
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  })
})

async function handleOcrUpload(request, response) {
  response.set('Cache-Control', 'no-store')
  const startedAt = Date.now()
  const requestId = request.get('x-request-id') || `ocr-${startedAt}`
  const route = request.path
  if (!request.file) {
    logStructured({ requestId, route, statusCode: 400, elapsedMs: Date.now() - startedAt, errorCode: 'missing-image', storeMode: miniappUsageStore.mode })
    response.status(400).json({ message: '请选择需要识别的合同图片', code: 'missing-image' })
    return
  }

  if (!/^image\//i.test(request.file.mimetype || '')) {
    logStructured({ requestId, route, statusCode: 415, elapsedMs: Date.now() - startedAt, errorCode: 'unsupported-image', storeMode: miniappUsageStore.mode })
    response.status(415).json({ message: '仅支持 JPG、PNG 或 WEBP 合同图片', code: 'unsupported-image' })
    return
  }

  // 真实文件签名校验，防止伪造扩展名（如把 .txt 改名 .jpg）进入 OCR worker
  const imageSignature = detectImageSignature(request.file.buffer)
  if (!imageSignature) {
    logStructured({ requestId, route, statusCode: 415, elapsedMs: Date.now() - startedAt, errorCode: 'invalid-image-signature', storeMode: miniappUsageStore.mode })
    response.status(415).json({ message: '图片内容无效或格式不支持，请重新选择', code: 'invalid-image-signature' })
    return
  }

  if (ocrInFlight) {
    response.set('Retry-After', '10')
    logStructured({ requestId, route, statusCode: 429, elapsedMs: Date.now() - startedAt, errorCode: 'busy', storeMode: miniappUsageStore.mode })
    response.status(429).json({ message: '图片识别服务繁忙，请稍后重试', code: 'busy' })
    return
  }

  ocrInFlight = true
  try {
    const result = await recognizeImageOffline(request.file.buffer)
    logStructured({ requestId, route, statusCode: 200, elapsedMs: Date.now() - startedAt, storeMode: miniappUsageStore.mode })
    response.json({
      ok: true,
      mode: 'offline-tesseract',
      language: 'chi_sim+eng',
      text: result.text,
      confidence: result.confidence,
    })
  } catch (error) {
    logStructured({ requestId, route, statusCode: 500, elapsedMs: Date.now() - startedAt, errorCode: 'ocr-failed', storeMode: miniappUsageStore.mode })
    response.status(500).json({
      message: error.message || '合同图片识别失败，请重试',
      code: 'ocr-failed',
      fallback: 'vision-model',
    })
  } finally {
    ocrInFlight = false
  }
}

// 小程序使用独立路径和短期微信会话；旧 Web 接口继续保留来源/共享令牌校验。
app.post('/api/miniapp/ocr/image', authenticateMiniappSession, rateLimit('miniapp-ocr', 6), upload.single('image'), acceptJsonUpload('image'), handleOcrUpload)
app.post('/api/ocr/image', trustedApiRequest, rateLimit('ocr', 6), upload.single('image'), handleOcrUpload)

app.post('/api/miniapp/contract/parse', authenticateMiniappSession, rateLimit('contract-parse', 12), upload.single('document'), acceptJsonUpload('document'), async (request, response) => {
  response.set('Cache-Control', 'no-store')
  const startedAt = Date.now()
  const requestId = request.get('x-request-id') || `contract-${startedAt}`
  const route = '/api/miniapp/contract/parse'
  if (!request.file) {
    logStructured({ requestId, route, statusCode: 400, elapsedMs: Date.now() - startedAt, errorCode: 'missing-file', storeMode: miniappUsageStore.mode })
    response.status(400).json({ message: '请选择需要解析的合同文件', code: 'missing-file' })
    return
  }

  if (contractParsesInFlight >= maxConcurrentContractParses) {
    response.set('Retry-After', '10')
    logStructured({ requestId, route, statusCode: 429, elapsedMs: Date.now() - startedAt, errorCode: 'busy', storeMode: miniappUsageStore.mode })
    response.status(429).json({ message: '合同解析服务繁忙，请稍后重试', code: 'busy' })
    return
  }

  contractParsesInFlight += 1
  try {
    const result = await parseContractDocument({
      buffer: request.file.buffer,
      fileName: request.body?.fileName || request.file.originalname,
    })
    logStructured({ requestId, route, statusCode: 200, elapsedMs: Date.now() - startedAt, storeMode: miniappUsageStore.mode })
    response.json({ ok: true, ...result, retained: false })
  } catch (error) {
    logStructured({ requestId, route, statusCode: error?.status || 422, elapsedMs: Date.now() - startedAt, errorCode: error?.code || 'parse-failed', storeMode: miniappUsageStore.mode })
    response.status(error?.status || 422).json({
      message: error?.message || '合同文件解析失败',
      code: error?.code || 'parse-failed',
    })
  } finally {
    contractParsesInFlight = Math.max(0, contractParsesInFlight - 1)
  }
})

app.get('/api/ai/quota', trustedApiRequest, (request, response) => {
  const accountId = getAccountId(request)
  const day = new Date().toISOString().slice(0, 10)
  const used = quotaBuckets.get(`${day}:${accountId}`)?.used || 0
  response.json({ used, limit: dailyQuota, remaining: Math.max(0, dailyQuota - used), resetAt: `${day}T23:59:59.999Z` })
})

app.post('/api/ai/chat', trustedApiRequest, rateLimit('chat', 20), quotaLimit, async (request, response) => {
  const { provider, baseUrl, model, messages, temperature = 0.2, maxTokens = 2200 } = request.body || {}
  const config = resolveProviderConfig({ provider, baseUrl, model })

  if (!config.endpoint) {
    response.status(500).json({ message: 'AI_PROXY_BASE_URL is not configured' })
    return
  }

  if (!config.apiKey) {
    response.status(500).json({ message: 'AI_PROXY_API_KEY is not configured' })
    return
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    response.status(400).json({ message: 'messages must be a non-empty array' })
    return
  }

  const rawMessageChars = messages.reduce((total, message) => total + String(message?.content || '').length, 0)
  if (rawMessageChars > 80_000) {
    response.status(413).json({ message: 'AI 请求内容过长，请缩短合同或对话内容后重试' })
    return
  }

  const normalizedMessages = messages.slice(-16).map((message) => ({
    role: ['system', 'user', 'assistant'].includes(message?.role) ? message.role : 'user',
    content: String(message?.content || '').slice(0, 12_000),
  }))
  const totalMessageChars = normalizedMessages.reduce((total, message) => total + message.content.length, 0)

  if (!normalizedMessages.every((message) => message.content.trim()) || totalMessageChars > 80_000) {
    response.status(413).json({ message: 'AI 请求内容过长，请缩短合同或对话内容后重试' })
    return
  }

  const safeTemperature = Math.max(0, Math.min(Number(temperature) || 0.2, 1))
  const safeMaxTokens = Math.max(256, Math.min(Number(maxTokens) || 2200, 4000))

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), upstreamTimeoutMs)

  try {
    const upstreamResponse = await fetch(config.endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        temperature: safeTemperature,
        max_tokens: safeMaxTokens,
        messages: normalizedMessages,
      }),
    })

    const data = await upstreamResponse.json().catch(() => ({}))

    if (!upstreamResponse.ok) {
      response.status(upstreamResponse.status).json({
        message: data?.error?.message || data?.message || `Upstream AI request failed: HTTP ${upstreamResponse.status}`,
      })
      return
    }

    response.json(data)
  } catch (error) {
    response.status(error?.name === 'AbortError' ? 504 : 502).json({
      message: error?.name === 'AbortError' ? 'Upstream AI request timed out' : error?.message || 'AI proxy request failed',
    })
  } finally {
    clearTimeout(timeout)
  }
})

app.use((error, _request, response, next) => {
  if (error instanceof multer.MulterError) {
    response.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      message: error.code === 'LIMIT_FILE_SIZE' ? '文件超过 8MB 上传限制' : error.message,
    })
    return
  }

  next(error)
})

if (existsSync(indexHtmlPath)) {
  app.use(express.static(distDir))
  app.get(/^\/(?!api(?:\/|$)).*/, (_request, response) => {
    response.sendFile(indexHtmlPath)
  })
} else {
  app.get('/', (_request, response) => {
    response.status(404).send('Frontend build not found. Run `npm run build` before `npm start`.')
  })
}

const isMainModule = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isMainModule) {
  app.listen(port, () => {
    console.log(`Zu Xiao Shen AI proxy listening on http://localhost:${port}`)
  })
}
