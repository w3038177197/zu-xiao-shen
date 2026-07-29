const baseUrl = String(process.env.MINIAPP_API_BASE_URL || 'https://express-kqoh-288630-10-1435338026.sh.run.tcloudbase.com').replace(/\/+$/, '')
const timeoutMs = Math.max(5_000, Number(process.env.MINIAPP_DEPLOY_CHECK_TIMEOUT_MS) || 60_000)

async function request(path, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${baseUrl}${path}`, { ...options, signal: controller.signal })
    const data = await response.json().catch(() => ({}))
    return { status: response.status, data }
  } finally {
    clearTimeout(timer)
  }
}

const failures = []
let health
try {
  health = await request('/api/health')
} catch (error) {
  console.error(`FAIL 无法访问 ${baseUrl}/api/health：${error?.message || error}`)
  process.exit(1)
}

if (health.status !== 200 || health.data?.ok !== true) failures.push('健康检查未返回可用状态')
if (Number(health.data?.miniappApiVersion) < 1) failures.push('线上仍是旧后端，缺少 miniappApiVersion')
if (health.data?.miniappAuthConfigured !== true) failures.push('微信登录环境变量尚未完整配置')
if (health.data?.hasApiKey !== true) failures.push('模型服务密钥尚未配置')
if (health.data?.contractDocumentParsing !== true) failures.push('合同 DOCX/PDF 解析尚未部署')
if (!health.data?.ocrMode) failures.push('合同图片 OCR 尚未部署')

// 生产验收模式：额度必须持久化（redis-rest），memory 模式判为未完成
// 通过 MINIAPP_DEPLOY_REQUIRE_PERSISTENT=1 启用，避免本地开发误判
const requirePersistent = process.env.MINIAPP_DEPLOY_REQUIRE_PERSISTENT === '1'
const usageMode = String(health.data?.miniappUsageStore || '')
const usagePersistent = health.data?.miniappUsagePersistent === true
const usageHealthy = health.data?.miniappUsageHealthy === true
if (requirePersistent) {
  if (usageMode !== 'redis-rest') failures.push(`生产验收模式下额度存储必须为 redis-rest，实际为 ${usageMode || '旧版/未知'}`)
  if (!usagePersistent) failures.push('生产验收模式下额度存储未持久化（memory 模式不可用于生产）')
  if (!usageHealthy) failures.push('生产验收模式下额度存储真实读写探测失败，请检查 Redis REST 凭据和网络')
} else if (usageMode === 'memory') {
  console.log('提示：额度存储为 memory 模式（未持久化），仅适合本地开发与比赛演示。生产请配置 UPSTASH_REDIS_REST_URL 与 UPSTASH_REDIS_REST_TOKEN 后设置 MINIAPP_DEPLOY_REQUIRE_PERSISTENT=1 验收。')
}

const protectedRoutes = [
  ['GET', '/api/miniapp/ai/quota'],
  ['POST', '/api/miniapp/contract/parse'],
  ['POST', '/api/miniapp/ocr/image'],
]

for (const [method, path] of protectedRoutes) {
  try {
    const result = await request(path, { method })
    if (result.status !== 401) failures.push(`${path} 未按预期返回 401 鉴权保护（实际 ${result.status}）`)
  } catch (error) {
    failures.push(`${path} 探测失败：${error?.message || error}`)
  }
}

console.log(`服务地址：${baseUrl}`)
console.log(`小程序 API 版本：${health.data?.miniappApiVersion || '旧版/未知'}`)
console.log(`模型服务：${health.data?.hasApiKey ? '已配置' : '未配置'}`)
console.log(`微信登录：${health.data?.miniappAuthConfigured ? '已配置' : '未配置'}`)
console.log(`额度存储：${health.data?.miniappUsageStore || '旧版/未知'}${health.data?.miniappUsagePersistent ? '（可跨重启）' : '（未持久化）'}`)
console.log(`额度存储探测：${usageHealthy ? '可读写' : '未就绪'}`)

if (failures.length) {
  failures.forEach((message) => console.error(`FAIL ${message}`))
  process.exit(1)
}

console.log('PASS 小程序线上服务已具备微信鉴权、联网 AI、合同解析和 OCR 能力')
