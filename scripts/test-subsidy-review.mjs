import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import http from 'node:http'
import net from 'node:net'
import { readFile, writeFile, rm, mkdtemp } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildOfflineReport,
  buildOnlineReport,
  classifyReviewStatus,
  summarize,
  renderMarkdown,
  writeReports,
  loadBaseline,
  subsidyPolicies,
} from './review-subsidy-policies.mjs'

// 读取源文件初始内容，测试后验证不被修改
const sourcePath = fileURLToPath(new URL('../src/data/subsidyPolicies.js', import.meta.url))
const miniappPath = fileURLToPath(new URL('../miniapp/src/shared/subsidyPolicies.js', import.meta.url))
const originalSource = await readFile(sourcePath, 'utf8')
const originalMiniapp = await readFile(miniappPath, 'utf8')

const checks = []
const check = (name, fn) => checks.push([name, fn])

// ============================================================
// 工具函数
// ============================================================

// 获取可用随机端口
function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
}

// 计算内容的 SHA-256 哈希（与 fetchWithLimits 内部算法一致）
function sha256(content) {
  return crypto.createHash('sha256').update(Buffer.from(content, 'utf8')).digest('hex')
}

// 创建临时目录（使用 os.tmpdir + mkdtemp，确保跨平台且不污染工作区）
async function createTempDir() {
  const prefix = `subsidy-review-test-`
  return mkdtemp(path.join(os.tmpdir(), prefix))
}

// ============================================================
// 真实本地 HTTP mock 服务器
// ============================================================
//
// 路由设计：
//   /ok-unchanged   → 200，返回 contentA
//   /ok-changed     → 200，返回 contentB
//   /ok-default     → 200，返回 default-content（其余政策默认路由）
//   /redirect       → 302 → /redirected
//   /redirected     → 200，返回 redirected-content
//   /forbidden      → 403
//   /notfound       → 404
//   /gone           → 410
//   /ratelimit      → 429
//   /slow           → 延迟 5000ms 后返回 200（超过测试超时 500ms）
//   /huge           → 200，返回超过 maxBytes 的超大响应
//   /server-error   → 500

const TEST_CONTENT_A = 'government page content A for unchanged test'
const TEST_CONTENT_B = 'government page content B for changed test'
const TEST_CONTENT_DEFAULT = 'default government page content'
const TEST_CONTENT_REDIRECTED = 'redirected government page content'
const TEST_HUGE_SIZE = 4 * 1024 * 1024 // 4MB，超过默认 maxBytes(2MB)

function startMockServer(port) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`)
    const pathname = url.pathname

    // /slow 延迟响应，让 AbortController 真实触发
    if (pathname === '/slow') {
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('slow response that should never arrive')
      }, 5000)
      return
    }

    // /huge 超大响应，验证截断
    if (pathname === '/huge') {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      // 写入超过 maxBytes 的数据
      const chunk = Buffer.alloc(64 * 1024, 0x41) // 64KB 'A'
      const chunksNeeded = Math.ceil(TEST_HUGE_SIZE / chunk.length)
      for (let i = 0; i < chunksNeeded; i++) {
        res.write(chunk)
      }
      res.end()
      return
    }

    // /redirect → 302 → /redirected
    if (pathname === '/redirect') {
      res.writeHead(302, { Location: `/redirected` })
      res.end()
      return
    }

    const routes = {
      '/ok-unchanged': { status: 200, body: TEST_CONTENT_A },
      '/ok-changed': { status: 200, body: TEST_CONTENT_B },
      '/ok-default': { status: 200, body: TEST_CONTENT_DEFAULT },
      '/redirected': { status: 200, body: TEST_CONTENT_REDIRECTED },
      '/forbidden': { status: 403, body: 'Forbidden' },
      '/notfound': { status: 404, body: 'Not Found' },
      '/gone': { status: 410, body: 'Gone' },
      '/ratelimit': { status: 429, body: 'Too Many Requests' },
      '/server-error': { status: 500, body: 'Internal Server Error' },
    }

    const route = routes[pathname]
    if (route) {
      res.writeHead(route.status, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(route.body)
      return
    }

    // 默认 404
    res.writeHead(404, { 'Content-Type': 'text/html' })
    res.end('unknown route')
  })

  return new Promise((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => resolve(server))
    server.on('error', reject)
  })
}

// 创建 fetchImpl：把政策 sourceUrl 映射到本地服务器路径
// urlMap: { [policySourceUrl]: localPath }
function createLocalFetchRedirect(baseUrl, urlMap) {
  return async (url, options = {}) => {
    const localPath = urlMap[url] || '/ok-default'
    const localUrl = `${baseUrl}${localPath}`
    return globalThis.fetch(localUrl, options)
  }
}

// 为政策构建 URL 映射：前 N 条按 assignments 分配，其余默认
function buildUrlMap(assignments) {
  // assignments: { policyIndex: localPath }
  const map = {}
  for (const [idx, localPath] of Object.entries(assignments)) {
    const policy = subsidyPolicies[Number(idx)]
    if (policy) map[policy.sourceUrl] = localPath
  }
  return map
}

// ============================================================
// 离线模式测试
// ============================================================

check('离线模式：不发网络请求，输出全部政策元数据', async () => {
  const report = buildOfflineReport()
  assert.equal(report.total, subsidyPolicies.length)
  assert.equal(report.entries.length, subsidyPolicies.length)
  // 按城市排序
  const cities = report.entries.map((e) => e.city)
  const sorted = [...cities].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  assert.deepEqual(cities, sorted)
  // 所有条目都是 no-baseline
  for (const e of report.entries) {
    assert.equal(e.reviewStatus, 'no-baseline')
    assert.ok(e.city)
    assert.ok(e.policy)
    assert.ok(e.sourceName)
    assert.ok(e.sourceUrl)
    assert.match(e.checkedAt, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(e.status)
  }
  assert.equal(report.counts['no-baseline'], subsidyPolicies.length)
})

check('离线模式：断网也必须成功（不调用 fetch）', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = () => { throw new Error('fetch should not be called in offline mode') }
  try {
    const report = buildOfflineReport()
    assert.equal(report.total, subsidyPolicies.length)
  } finally {
    globalThis.fetch = originalFetch
  }
})

// ============================================================
// 分类逻辑单元测试
// ============================================================

check('分类逻辑：200 未变化 → unchanged', () => {
  const hash = 'abc123'
  const result = classifyReviewStatus({ ok: true, httpStatus: 200, contentHash: hash }, hash)
  assert.equal(result.reviewStatus, 'unchanged')
})

check('分类逻辑：200 内容变化 → content-changed', () => {
  const result = classifyReviewStatus({ ok: true, httpStatus: 200, contentHash: 'new' }, 'old')
  assert.equal(result.reviewStatus, 'content-changed')
})

check('分类逻辑：200 无基线 → no-baseline', () => {
  const result = classifyReviewStatus({ ok: true, httpStatus: 200, contentHash: 'hash' }, null)
  assert.equal(result.reviewStatus, 'no-baseline')
})

check('分类逻辑：403 → manual-review（不写失效）', () => {
  const result = classifyReviewStatus({ ok: true, httpStatus: 403 }, null)
  assert.equal(result.reviewStatus, 'manual-review')
  assert.ok(!result.note.includes('失效'))
})

check('分类逻辑：404 → source-unavailable（不写政策失效）', () => {
  const result = classifyReviewStatus({ ok: true, httpStatus: 404 }, null)
  assert.equal(result.reviewStatus, 'source-unavailable')
  assert.ok(!result.note.includes('失效'))
  assert.ok(result.note.includes('不可用'))
})

check('分类逻辑：410 → source-unavailable（不写政策失效）', () => {
  const result = classifyReviewStatus({ ok: true, httpStatus: 410 }, null)
  assert.equal(result.reviewStatus, 'source-unavailable')
  assert.ok(!result.note.includes('失效'))
})

check('分类逻辑：429 → manual-review', () => {
  const result = classifyReviewStatus({ ok: true, httpStatus: 429 }, null)
  assert.equal(result.reviewStatus, 'manual-review')
})

check('分类逻辑：超时（AbortError）→ manual-review', () => {
  const result = classifyReviewStatus({ ok: false, errorName: 'AbortError', errorMessage: 'aborted' }, null, { timeoutMs: 500 })
  assert.equal(result.reviewStatus, 'manual-review')
  assert.ok(result.note.includes('超时'))
})

check('分类逻辑：TLS/DNS 失败（TypeError）→ manual-review', () => {
  const result = classifyReviewStatus({ ok: false, errorName: 'TypeError', errorMessage: 'fetch failed' }, null)
  assert.equal(result.reviewStatus, 'manual-review')
  assert.ok(result.note.includes('TLS/DNS'))
})

check('分类逻辑：401 → manual-review', () => {
  const result = classifyReviewStatus({ ok: true, httpStatus: 401 }, null)
  assert.equal(result.reviewStatus, 'manual-review')
})

check('分类逻辑：500 → manual-review', () => {
  const result = classifyReviewStatus({ ok: true, httpStatus: 500 }, null)
  assert.equal(result.reviewStatus, 'manual-review')
})

// ============================================================
// 真实本地 HTTP mock 联网测试
// ============================================================

check('联网模式（真实 HTTP）：200 未变化 + 200 内容变化 + 403 + 404 + 429 + 超时 + 超大响应 全覆盖', async () => {
  const tmpDir = await createTempDir()
  const baselinePath = path.join(tmpDir, 'baseline.json')
  const reportDir = path.join(tmpDir, 'reports')
  const port = await getAvailablePort()
  const server = await startMockServer(port)
  const baseUrl = `http://127.0.0.1:${port}`

  try {
    // 准备基线：第 0 条用 contentA 的哈希（unchanged），第 1 条用旧哈希（content-changed）
    const hashA = sha256(TEST_CONTENT_A)
    const baselineData = {
      generatedAt: '2026-01-01T00:00:00.000Z',
      entries: [
        { sourceUrl: subsidyPolicies[0].sourceUrl, contentHash: hashA },
        { sourceUrl: subsidyPolicies[1].sourceUrl, contentHash: 'old-hash-should-differ' },
      ],
    }
    await writeFile(baselinePath, JSON.stringify(baselineData), 'utf8')
    const baselineBeforeBytes = await readFile(baselinePath, 'utf8')

    // URL 映射：前 7 条政策分配不同路由，其余默认
    const urlMap = buildUrlMap({
      0: '/ok-unchanged',   // 200 unchanged
      1: '/ok-changed',     // 200 content-changed
      2: '/forbidden',      // 403 manual-review
      3: '/notfound',       // 404 source-unavailable
      4: '/ratelimit',      // 429 manual-review
      5: '/slow',           // 超时 manual-review
      6: '/huge',           // 超大响应截断
    })
    const fetchImpl = createLocalFetchRedirect(baseUrl, urlMap)

    const report = await buildOnlineReport({
      reset: false,
      fetchImpl,
      baselinePath,
      reportDir,
      timeoutMs: 500,  // 短超时让 /slow 真实触发 AbortController
    })

    assert.equal(report.total, subsidyPolicies.length)

    // 第 0 条：unchanged
    const first = report.entries.find((e) => e.sourceUrl === subsidyPolicies[0].sourceUrl)
    assert.equal(first.reviewStatus, 'unchanged')
    assert.equal(first.httpStatus, 200)

    // 第 1 条：content-changed
    const second = report.entries.find((e) => e.sourceUrl === subsidyPolicies[1].sourceUrl)
    assert.equal(second.reviewStatus, 'content-changed')
    assert.equal(second.httpStatus, 200)

    // 第 2 条：manual-review（403）
    const third = report.entries.find((e) => e.sourceUrl === subsidyPolicies[2].sourceUrl)
    assert.equal(third.reviewStatus, 'manual-review')
    assert.equal(third.httpStatus, 403)

    // 第 3 条：source-unavailable（404）
    const fourth = report.entries.find((e) => e.sourceUrl === subsidyPolicies[3].sourceUrl)
    assert.equal(fourth.reviewStatus, 'source-unavailable')
    assert.equal(fourth.httpStatus, 404)

    // 第 4 条：manual-review（429）
    const fifth = report.entries.find((e) => e.sourceUrl === subsidyPolicies[4].sourceUrl)
    assert.equal(fifth.reviewStatus, 'manual-review')
    assert.equal(fifth.httpStatus, 429)

    // 第 5 条：manual-review（超时，由 AbortController 真实触发）
    const sixth = report.entries.find((e) => e.sourceUrl === subsidyPolicies[5].sourceUrl)
    assert.equal(sixth.reviewStatus, 'manual-review')
    assert.equal(sixth.httpStatus, null)
    assert.ok(sixth.note.includes('超时'))

    // 第 6 条：超大响应截断
    const seventh = report.entries.find((e) => e.sourceUrl === subsidyPolicies[6].sourceUrl)
    assert.equal(seventh.httpStatus, 200)
    assert.equal(seventh.truncated, true)

    // 验证汇总数量
    assert.ok(report.counts.unchanged >= 1)
    assert.ok(report.counts['content-changed'] >= 1)
    assert.ok(report.counts['manual-review'] >= 3)
    assert.ok(report.counts['source-unavailable'] >= 1)

    // 关键：普通 --online 绝不覆盖基线，基线字节完全不变
    const baselineAfterBytes = await readFile(baselinePath, 'utf8')
    assert.equal(baselineAfterBytes, baselineBeforeBytes, '普通 --online 不应修改基线文件')
  } finally {
    server.close()
    await rm(tmpDir, { recursive: true, force: true })
  }
})

check('基线保护：普通检查发现 content-changed 后基线字节完全不变，再次检查仍为 content-changed', async () => {
  const tmpDir = await createTempDir()
  const baselinePath = path.join(tmpDir, 'baseline.json')
  const reportDir = path.join(tmpDir, 'reports')
  const port = await getAvailablePort()
  const server = await startMockServer(port)
  const baseUrl = `http://127.0.0.1:${port}`

  try {
    // 基线：第 0 条用旧哈希（与 contentA 不同 → content-changed）
    const baselineData = {
      generatedAt: '2026-01-01T00:00:00.000Z',
      entries: [
        { sourceUrl: subsidyPolicies[0].sourceUrl, contentHash: 'definitely-old-hash' },
      ],
    }
    await writeFile(baselinePath, JSON.stringify(baselineData), 'utf8')
    const baselineBefore = await readFile(baselinePath, 'utf8')
    const baselineStatBefore = baselineBefore.length

    const urlMap = buildUrlMap({ 0: '/ok-unchanged' })
    const fetchImpl = createLocalFetchRedirect(baseUrl, urlMap)

    // 第一次普通检查
    const report1 = await buildOnlineReport({
      reset: false,
      fetchImpl,
      baselinePath,
      reportDir,
    })
    const first = report1.entries.find((e) => e.sourceUrl === subsidyPolicies[0].sourceUrl)
    assert.equal(first.reviewStatus, 'content-changed', '第一次检查应为 content-changed')

    // 基线字节完全不变
    const baselineAfter1 = await readFile(baselinePath, 'utf8')
    assert.equal(baselineAfter1, baselineBefore, '第一次普通检查后基线应完全不变')
    assert.equal(baselineAfter1.length, baselineStatBefore)

    // 第二次普通检查仍为 content-changed
    const report2 = await buildOnlineReport({
      reset: false,
      fetchImpl,
      baselinePath,
      reportDir,
    })
    const second = report2.entries.find((e) => e.sourceUrl === subsidyPolicies[0].sourceUrl)
    assert.equal(second.reviewStatus, 'content-changed', '第二次检查应仍为 content-changed')

    // 基线仍然不变
    const baselineAfter2 = await readFile(baselinePath, 'utf8')
    assert.equal(baselineAfter2, baselineBefore, '第二次普通检查后基线仍应完全不变')
  } finally {
    server.close()
    await rm(tmpDir, { recursive: true, force: true })
  }
})

check('基线重建：--reset 后断言基线变成新 2xx 哈希', async () => {
  const tmpDir = await createTempDir()
  const baselinePath = path.join(tmpDir, 'baseline.json')
  const reportDir = path.join(tmpDir, 'reports')
  const port = await getAvailablePort()
  const server = await startMockServer(port)
  const baseUrl = `http://127.0.0.1:${port}`

  try {
    // 旧基线（哈希是错的）
    const oldBaseline = {
      generatedAt: '2026-01-01T00:00:00.000Z',
      entries: [{ sourceUrl: subsidyPolicies[0].sourceUrl, contentHash: 'old-wrong-hash' }],
    }
    await writeFile(baselinePath, JSON.stringify(oldBaseline), 'utf8')

    const urlMap = buildUrlMap({ 0: '/ok-unchanged' })
    const fetchImpl = createLocalFetchRedirect(baseUrl, urlMap)

    // --reset 重建基线
    const report = await buildOnlineReport({
      reset: true,
      fetchImpl,
      baselinePath,
      reportDir,
    })

    // reset 后第 0 条应为 no-baseline（不读旧基线）
    const first = report.entries.find((e) => e.sourceUrl === subsidyPolicies[0].sourceUrl)
    assert.equal(first.reviewStatus, 'no-baseline')
    assert.equal(first.baselineHash, null)

    // 基线文件应被更新为 contentA 的真实哈希
    const newBaseline = await loadBaseline({ baselinePath })
    assert.ok(newBaseline, '基线文件应存在')
    const newEntry = newBaseline.entries.find((e) => e.sourceUrl === subsidyPolicies[0].sourceUrl)
    assert.ok(newEntry, '新基线应包含第 0 条政策')
    assert.equal(newEntry.contentHash, sha256(TEST_CONTENT_A), '基线应更新为 contentA 的真实哈希')

    // 再次普通检查（不 reset），第 0 条应为 unchanged
    const report2 = await buildOnlineReport({
      reset: false,
      fetchImpl,
      baselinePath,
      reportDir,
    })
    const second = report2.entries.find((e) => e.sourceUrl === subsidyPolicies[0].sourceUrl)
    assert.equal(second.reviewStatus, 'unchanged', 'reset 后再次普通检查应为 unchanged')
    assert.equal(second.baselineHash, sha256(TEST_CONTENT_A))
  } finally {
    server.close()
    await rm(tmpDir, { recursive: true, force: true })
  }
})

check('基线保护：403/404 等错误页哈希不得进入基线', async () => {
  const tmpDir = await createTempDir()
  const baselinePath = path.join(tmpDir, 'baseline.json')
  const reportDir = path.join(tmpDir, 'reports')
  const port = await getAvailablePort()
  const server = await startMockServer(port)
  const baseUrl = `http://127.0.0.1:${port}`

  try {
    // 无旧基线
    const urlMap = buildUrlMap({
      0: '/forbidden',    // 403
      1: '/notfound',     // 404
      2: '/gone',         // 410
      3: '/ratelimit',    // 429
      4: '/server-error', // 500
      5: '/slow',         // 超时
    })
    const fetchImpl = createLocalFetchRedirect(baseUrl, urlMap)

    // --reset 重建基线
    await buildOnlineReport({
      reset: true,
      fetchImpl,
      baselinePath,
      reportDir,
      timeoutMs: 500,
    })

    // 基线文件应为空 entries（所有错误页都不应写入基线）
    const newBaseline = await loadBaseline({ baselinePath })
    assert.ok(newBaseline, '基线文件应存在')

    // 检查错误页的 sourceUrl 都不在基线中
    const errorUrls = [0, 1, 2, 3, 4, 5].map((i) => subsidyPolicies[i].sourceUrl)
    for (const errorUrl of errorUrls) {
      const found = newBaseline.entries.find((e) => e.sourceUrl === errorUrl)
      assert.ok(!found, `错误页 ${errorUrl} 不应进入基线`)
    }

    // 基线中应只有 2xx 成功页的哈希（其余 26 条政策走默认 /ok-default）
    assert.ok(newBaseline.entries.length > 0, '基线应包含成功页哈希')
    for (const entry of newBaseline.entries) {
      // 所有基线条目的 sourceUrl 不应在错误页列表中
      assert.ok(!errorUrls.includes(entry.sourceUrl), '基线不应包含错误页')
      assert.ok(entry.contentHash, '基线条目应有 contentHash')
    }
  } finally {
    server.close()
    await rm(tmpDir, { recursive: true, force: true })
  }
})

check('联网模式（真实 HTTP）：302 重定向经过真实 HTTP 跟随', async () => {
  const tmpDir = await createTempDir()
  const baselinePath = path.join(tmpDir, 'baseline.json')
  const reportDir = path.join(tmpDir, 'reports')
  const port = await getAvailablePort()
  const server = await startMockServer(port)
  const baseUrl = `http://127.0.0.1:${port}`

  try {
    const urlMap = buildUrlMap({ 0: '/redirect' })
    const fetchImpl = createLocalFetchRedirect(baseUrl, urlMap)

    // --reset 建立 baseline，验证重定向跟随后到达 /redirected
    const report = await buildOnlineReport({
      reset: true,
      fetchImpl,
      baselinePath,
      reportDir,
    })

    const first = report.entries.find((e) => e.sourceUrl === subsidyPolicies[0].sourceUrl)
    assert.equal(first.reviewStatus, 'no-baseline')
    assert.equal(first.httpStatus, 200)
    // fetch follow 后 finalUrl 应为重定向后的 URL
    assert.ok(first.finalUrl.includes('/redirected'), 'finalUrl 应为重定向后的路径')
    assert.equal(first.contentHash, sha256(TEST_CONTENT_REDIRECTED))
  } finally {
    server.close()
    await rm(tmpDir, { recursive: true, force: true })
  }
})

check('联网模式（真实 HTTP）：超大响应验证截断和最大读取限制', async () => {
  const tmpDir = await createTempDir()
  const baselinePath = path.join(tmpDir, 'baseline.json')
  const reportDir = path.join(tmpDir, 'reports')
  const port = await getAvailablePort()
  const server = await startMockServer(port)
  const baseUrl = `http://127.0.0.1:${port}`

  try {
    const urlMap = buildUrlMap({ 0: '/huge' })
    const fetchImpl = createLocalFetchRedirect(baseUrl, urlMap)

    // 使用较小的 maxBytes 以加快测试
    const customMaxBytes = 100 * 1024 // 100KB
    const report = await buildOnlineReport({
      reset: true,
      fetchImpl,
      baselinePath,
      reportDir,
      maxBytes: customMaxBytes,
    })

    const first = report.entries.find((e) => e.sourceUrl === subsidyPolicies[0].sourceUrl)
    assert.equal(first.httpStatus, 200)
    assert.equal(first.truncated, true, '超大响应应被截断')
    assert.ok(first.contentLength >= customMaxBytes, '读取字节数应达到 maxBytes')

    // 截断页面不应进入基线
    const newBaseline = await loadBaseline({ baselinePath })
    const found = newBaseline.entries.find((e) => e.sourceUrl === subsidyPolicies[0].sourceUrl)
    assert.ok(!found, '截断页面不应进入基线')
  } finally {
    server.close()
    await rm(tmpDir, { recursive: true, force: true })
  }
})

check('联网模式：单个页面失败不中断其他城市检查', async () => {
  const tmpDir = await createTempDir()
  const baselinePath = path.join(tmpDir, 'baseline.json')
  const reportDir = path.join(tmpDir, 'reports')
  const port = await getAvailablePort()
  const server = await startMockServer(port)
  const baseUrl = `http://127.0.0.1:${port}`

  try {
    // 所有页面都走 /notfound（404）
    const urlMap = {}
    for (const policy of subsidyPolicies) {
      urlMap[policy.sourceUrl] = '/notfound'
    }
    const fetchImpl = createLocalFetchRedirect(baseUrl, urlMap)

    const report = await buildOnlineReport({
      reset: true,
      fetchImpl,
      baselinePath,
      reportDir,
    })
    assert.equal(report.total, subsidyPolicies.length)
    for (const e of report.entries) {
      assert.equal(e.reviewStatus, 'source-unavailable')
    }
    assert.equal(report.counts['source-unavailable'], subsidyPolicies.length)
  } finally {
    server.close()
    await rm(tmpDir, { recursive: true, force: true })
  }
})

// ============================================================
// 报告输出测试
// ============================================================

check('报告输出：JSON 和 Markdown 文件真实生成', async () => {
  const tmpDir = await createTempDir()
  const reportDir = path.join(tmpDir, 'reports')

  const fakeReport = summarize([
    { index: 1, city: '测试城市A', policy: '测试政策', sourceName: '来源', sourceUrl: 'https://example.com', checkedAt: '2026-01-01', status: '官方政策', reviewStatus: 'unchanged', note: '未变化' },
    { index: 2, city: '测试城市B', policy: '测试政策', sourceName: '来源', sourceUrl: 'https://example.com', checkedAt: '2026-01-01', status: '官方政策', reviewStatus: 'content-changed', note: '变化' },
  ])

  const { jsonPath, mdPath } = await writeReports(fakeReport, { reportDir })

  // 验证文件真实存在
  assert.ok(existsSync(jsonPath), 'JSON 文件应真实生成')
  assert.ok(existsSync(mdPath), 'Markdown 文件应真实生成')

  // 验证 JSON 内容可解析
  const jsonContent = await readFile(jsonPath, 'utf8')
  const parsed = JSON.parse(jsonContent)
  assert.equal(parsed.total, 2)
  assert.equal(parsed.counts.unchanged, 1)
  assert.equal(parsed.counts['content-changed'], 1)

  // 验证 Markdown 包含关键内容
  const mdContent = await readFile(mdPath, 'utf8')
  assert.ok(mdContent.includes('补贴政策人工复核报告'))
  assert.ok(mdContent.includes('unchanged'))
  assert.ok(mdContent.includes('content-changed'))
  assert.ok(mdContent.includes('不代表政策失效'))
  assert.ok(mdContent.includes('测试城市A'))
  assert.ok(mdContent.includes('测试城市B'))
  // 按城市排序
  assert.ok(mdContent.indexOf('测试城市A') < mdContent.indexOf('测试城市B'))

  await rm(tmpDir, { recursive: true, force: true })
})

check('报告格式：Markdown 包含所有状态类别和重要说明', () => {
  const fakeReport = summarize([
    { index: 1, city: '城市A', policy: '测试政策', sourceName: '来源', sourceUrl: 'https://example.com', checkedAt: '2026-01-01', status: '官方政策', reviewStatus: 'unchanged', note: '未变化' },
    { index: 2, city: '城市B', policy: '测试政策', sourceName: '来源', sourceUrl: 'https://example.com', checkedAt: '2026-01-01', status: '官方政策', reviewStatus: 'content-changed', note: '变化' },
    { index: 3, city: '城市C', policy: '测试政策', sourceName: '来源', sourceUrl: 'https://example.com', checkedAt: '2026-01-01', status: '官方政策', reviewStatus: 'manual-review', note: '需人工' },
    { index: 4, city: '城市D', policy: '测试政策', sourceName: '来源', sourceUrl: 'https://example.com', checkedAt: '2026-01-01', status: '官方政策', reviewStatus: 'no-baseline', note: '无基线' },
    { index: 5, city: '城市E', policy: '测试政策', sourceName: '来源', sourceUrl: 'https://example.com', checkedAt: '2026-01-01', status: '官方政策', reviewStatus: 'source-unavailable', note: '不可用' },
  ])
  const md = renderMarkdown(fakeReport)
  assert.ok(md.includes('unchanged'))
  assert.ok(md.includes('content-changed'))
  assert.ok(md.includes('manual-review'))
  assert.ok(md.includes('no-baseline'))
  assert.ok(md.includes('source-unavailable'))
  assert.ok(md.includes('不代表政策失效'))
  assert.ok(md.includes('需人工打开'))
  assert.ok(md.includes('--online 只读基线'))
  assert.ok(md.includes('--reset 只写入'))
})

check('报告格式：汇总数量正确', () => {
  const report = summarize([
    { city: '城市A', reviewStatus: 'unchanged' },
    { city: '城市B', reviewStatus: 'unchanged' },
    { city: '城市C', reviewStatus: 'content-changed' },
    { city: '城市D', reviewStatus: 'manual-review' },
    { city: '城市E', reviewStatus: 'no-baseline' },
    { city: '城市F', reviewStatus: 'source-unavailable' },
  ])
  assert.equal(report.counts.unchanged, 2)
  assert.equal(report.counts['content-changed'], 1)
  assert.equal(report.counts['manual-review'], 1)
  assert.equal(report.counts['no-baseline'], 1)
  assert.equal(report.counts['source-unavailable'], 1)
  assert.equal(report.total, 6)
})

// ============================================================
// 源文件保护测试
// ============================================================

check('源文件保护：任何异常都不会修改政策源文件', async () => {
  const tmpDir = await createTempDir()
  const baselinePath = path.join(tmpDir, 'baseline.json')
  const reportDir = path.join(tmpDir, 'reports')
  const port = await getAvailablePort()
  const server = await startMockServer(port)
  const baseUrl = `http://127.0.0.1:${port}`

  try {
    // 所有页面都走 /notfound
    const urlMap = {}
    for (const policy of subsidyPolicies) {
      urlMap[policy.sourceUrl] = '/notfound'
    }
    const fetchImpl = createLocalFetchRedirect(baseUrl, urlMap)

    await buildOnlineReport({
      reset: true,
      fetchImpl,
      baselinePath,
      reportDir,
    })
    await buildOnlineReport({
      reset: false,
      fetchImpl,
      baselinePath,
      reportDir,
    })

    const sourceAfter = await readFile(sourcePath, 'utf8')
    const miniappAfter = await readFile(miniappPath, 'utf8')
    assert.equal(sourceAfter, originalSource, 'Web 政策源文件被意外修改')
    assert.equal(miniappAfter, originalMiniapp, '小程序政策源文件被意外修改')
  } finally {
    server.close()
    await rm(tmpDir, { recursive: true, force: true })
  }
})

// ============================================================
// 主流程
// ============================================================

async function main() {
  let passed = 0
  for (const [name, fn] of checks) {
    await fn()
    passed += 1
    console.log(`PASS ${name}`)
  }
  console.log(`Subsidy review test passed: ${passed}/${checks.length}`)
}

main().catch(async (error) => {
  console.error('Subsidy review test failed:', error)
  process.exit(1)
})
