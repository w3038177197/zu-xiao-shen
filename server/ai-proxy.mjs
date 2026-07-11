import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import multer from 'multer'
import { existsSync } from 'node:fs'
import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWorker } from 'tesseract.js'
import { aiEvalCases } from './data/ai-eval-cases.mjs'
import { evaluateKnowledgeRetrieval, searchKnowledge } from './rag-engine.mjs'

dotenv.config()

const app = express()
const port = Number(process.env.PORT || process.env.AI_PROXY_PORT || 8787)
const allowedOrigin = process.env.AI_PROXY_ALLOWED_ORIGIN || 'http://localhost:5173'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const indexHtmlPath = path.join(distDir, 'index.html')
const upstreamTimeoutMs = Math.max(5_000, Math.min(Number(process.env.AI_PROXY_TIMEOUT_MS) || 45_000, 120_000))
const ocrTimeoutMs = Math.max(15_000, Math.min(Number(process.env.OCR_TIMEOUT_MS) || 90_000, 180_000))
let ocrInFlight = false
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
})

app.use(cors({ origin: allowedOrigin }))
app.use(express.json({ limit: '8mb' }))

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

function buildModelsUrl(baseUrl) {
  const trimmed = String(baseUrl || '').trim().replace(/\/$/, '')
  if (!trimmed) return ''
  if (trimmed.endsWith('/models')) return trimmed
  if (trimmed.endsWith('/chat/completions')) return trimmed.replace(/\/chat\/completions$/, '/models')
  if (/^https:\/\/api\.deepseek\.com\/?$/i.test(trimmed)) return `${trimmed}/models`
  if (trimmed.endsWith('/v1')) return `${trimmed}/models`
  return `${trimmed}/v1/models`
}

function buildModelsUrlCandidates(baseUrl) {
  const trimmed = String(baseUrl || '').trim().replace(/\/$/, '')
  if (!trimmed) return []

  const candidates = new Set()

  if (trimmed.endsWith('/models')) {
    candidates.add(trimmed)
  }

  if (trimmed.endsWith('/chat/completions')) {
    candidates.add(trimmed.replace(/\/chat\/completions$/, '/models'))
    candidates.add(trimmed.replace(/\/chat\/completions$/, '/v1/models'))
  }

  if (trimmed.endsWith('/v1')) {
    candidates.add(`${trimmed}/models`)
  } else {
    candidates.add(`${trimmed}/models`)
    candidates.add(`${trimmed}/v1/models`)
  }

  if (/^https:\/\/api\.deepseek\.com\/?$/i.test(trimmed)) {
    candidates.add(`${trimmed}/models`)
    candidates.add(`${trimmed}/v1/models`)
  }

  return [...candidates]
}

function readFirstEnv(keys) {
  return keys.map((key) => process.env[key]).find(Boolean) || ''
}

function normalizeModelList(data) {
  const rawModels = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : []

  return Array.from(
    new Set(
      rawModels
        .map((item) => (typeof item === 'string' ? item : item?.id || item?.name || item?.model))
        .filter(Boolean)
        .map((model) => String(model).trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b))
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

async function recognizeImageOffline(buffer) {
  const langPath = await prepareTesseractLangPath()
  const worker = await createWorker('chi_sim+eng', 1, {
    langPath,
    cachePath: path.join(rootDir, '.cache', 'tesseract'),
    gzip: true,
  })
  let timeoutId = 0

  try {
    const result = await Promise.race([
      worker.recognize(buffer),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('offline OCR timed out')), ocrTimeoutMs)
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
  const allowClientBaseUrl = process.env.AI_PROXY_ALLOW_CLIENT_BASE_URL === 'true'

  if (preset) {
    return {
      endpoint: buildChatCompletionsUrl((allowClientBaseUrl ? baseUrl : '') || process.env.AI_PROXY_BASE_URL || preset.baseUrl),
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

app.get('/api/health', (_request, response) => {
  const config = resolveProviderConfig()
  response.json({
    ok: true,
    provider: config.provider,
    model: config.model,
    hasApiKey: Boolean(config.apiKey),
  })
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

app.get('/api/rag/search', (request, response) => {
  sendRagSearchResponse(response, {
    query: String(request.query.q || ''),
    limit: Number(request.query.limit || 5),
  })
})

app.post('/api/rag/search', (request, response) => {
  sendRagSearchResponse(response, {
    query: String(request.body?.query || request.body?.q || ''),
    limit: Number(request.body?.limit || 5),
  })
})

app.get('/api/rag/evaluate', (request, response) => {
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

app.post('/api/ai/models', async (request, response) => {
  const { provider, baseUrl, apiKey } = request.body || {}
  const preset = providerPresets[provider] || null
  const allowClientBaseUrl = process.env.AI_PROXY_ALLOW_CLIENT_BASE_URL === 'true'
  const allowBrowserKeyForLocal = process.env.AI_PROXY_ALLOW_BROWSER_KEY_MODEL_LIST !== 'false'
  const effectiveBaseUrl = (allowClientBaseUrl ? baseUrl : '') || process.env.AI_PROXY_BASE_URL || preset?.baseUrl || baseUrl || ''
  const endpoints = buildModelsUrlCandidates(effectiveBaseUrl)
  const keyFromServer = preset ? readFirstEnv(preset.keyEnv) : process.env.AI_PROXY_API_KEY || ''
  const effectiveApiKey = keyFromServer || (allowBrowserKeyForLocal ? String(apiKey || '').trim() : '')

  if (!endpoints.length) {
    response.status(400).json({ message: 'Base URL is required before fetching models' })
    return
  }

  if (!effectiveApiKey) {
    response.status(401).json({ message: 'API Key is required to fetch model list' })
    return
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)

  try {
    let lastError = null

    for (const endpoint of endpoints) {
      const upstreamResponse = await fetch(endpoint, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${effectiveApiKey}`,
          Accept: 'application/json',
        },
      })
      const data = await upstreamResponse.json().catch(() => ({}))

      if (upstreamResponse.ok) {
        const models = normalizeModelList(data)

        response.json({
          ok: true,
          provider: provider || 'custom',
          endpoint,
          models,
          source: keyFromServer ? 'server-key' : 'browser-key',
        })
        return
      }

      lastError = {
        status: upstreamResponse.status,
        message: data?.error?.message || data?.message || `Fetch models failed: HTTP ${upstreamResponse.status}`,
      }

      if (upstreamResponse.status !== 404) {
        response.status(upstreamResponse.status).json({ message: lastError.message })
        return
      }
    }

    response.status(lastError?.status || 404).json({
      message: lastError?.message || 'Fetch models failed: HTTP 404',
      tried: endpoints,
    })
  } catch (error) {
    response.status(error.name === 'AbortError' ? 504 : 502).json({
      message: error.name === 'AbortError' ? 'Fetch models timed out' : error.message || 'Fetch models failed',
    })
  } finally {
    clearTimeout(timeout)
  }
})

app.post('/api/ocr/image', upload.single('image'), async (request, response) => {
  if (!request.file) {
    response.status(400).json({ message: 'image file is required' })
    return
  }

  if (!/^image\//i.test(request.file.mimetype || '')) {
    response.status(415).json({ message: 'only image uploads are supported for OCR' })
    return
  }

  if (ocrInFlight) {
    response.status(429).json({ message: 'OCR is busy, please retry after the current image finishes' })
    return
  }

  ocrInFlight = true
  try {
    const result = await recognizeImageOffline(request.file.buffer)
    response.json({
      ok: true,
      mode: 'offline-tesseract',
      language: 'chi_sim+eng',
      text: result.text,
      confidence: result.confidence,
    })
  } catch (error) {
    response.status(500).json({
      message: error.message || 'offline OCR failed',
      fallback: 'vision-model',
    })
  } finally {
    ocrInFlight = false
  }
})

app.post('/api/ai/chat', async (request, response) => {
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
        temperature,
        max_tokens: Math.min(Number(maxTokens) || 2200, 4000),
        messages,
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
      message: error.code === 'LIMIT_FILE_SIZE' ? 'image exceeds the 8MB upload limit' : error.message,
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

app.listen(port, () => {
  console.log(`Zu Xiao Shen AI proxy listening on http://localhost:${port}`)
})
