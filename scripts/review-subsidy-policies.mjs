// 补贴政策人工复核报告生成器
//
// 只辅助发现来源页面变化，绝不自动判断政策有效或失效。
// 不修改任何政策金额、条件、状态、checkedAt 或政策结论。
//
// 基线更新语义：
//   - 普通 --online 只读取基线并生成报告，绝不覆盖基线。
//   - content-changed 必须一直保持，直到用户明确执行基线重建。
//   - --reset 用本次成功获取的 2xx 页面哈希重建基线。
//   - 401/403/404/410/429/5xx/超时页面不得写入基线。
//   - 基线写入使用临时文件 + rename，避免写到一半损坏。
//
// 用法：
//   node scripts/review-subsidy-policies.mjs --offline           离线模式，不发网络请求（默认安全）
//   node scripts/review-subsidy-policies.mjs --online             联网检查模式（只读基线）
//   node scripts/review-subsidy-policies.mjs --online --reset     联网并重建基线（用户显式）
//
// 环境变量：
//   SUBSIDY_REVIEW_TIMEOUT_MS  单页面超时（默认 15000）
//   SUBSIDY_REVIEW_MAX_BYTES   响应正文最大字节（默认 2_000_000）

import crypto from 'node:crypto'
import { readFile, writeFile, mkdir, rename, unlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { subsidyPolicies } from '../src/data/subsidyPolicies.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPORT_DIR = path.join(__dirname, '..', 'generated-reports', 'subsidy-review')
const BASELINE_PATH = path.join(REPORT_DIR, 'baseline.json')

const TIMEOUT_MS = Number(process.env.SUBSIDY_REVIEW_TIMEOUT_MS) || 15_000
const MAX_BYTES = Number(process.env.SUBSIDY_REVIEW_MAX_BYTES) || 2_000_000

// 导出供测试使用
export {
  fetchWithLimits,
  classifyReviewStatus,
  buildOfflineReport,
  buildOnlineReport,
  loadBaseline,
  saveBaseline,
  summarize,
  renderMarkdown,
  writeReports,
  REPORT_DIR,
  BASELINE_PATH,
  TIMEOUT_MS,
  MAX_BYTES,
}
export { subsidyPolicies }

// ---------- 离线模式 ----------
function buildOfflineReport() {
  const entries = subsidyPolicies.map((policy, index) => ({
    index: index + 1,
    city: policy.city || '',
    policy: policy.policy || '',
    sourceName: policy.sourceName || '',
    sourceUrl: policy.sourceUrl || '',
    checkedAt: policy.checkedAt || '',
    status: policy.status || '',
    reviewStatus: 'no-baseline',
    note: '离线模式：未发起网络请求，仅列出当前政策元数据',
  }))
  return summarize(entries)
}

// ---------- 联网检查模式 ----------
async function fetchWithLimits(url, options = {}) {
  const timeoutMs = options.timeoutMs || TIMEOUT_MS
  const maxBytes = options.maxBytes || MAX_BYTES
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      redirect: options.redirect || 'follow',
      headers: {
        'User-Agent': 'zu-xiao-shen-subsidy-review/1.0 (manual review tool)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
    })
    // 限制响应正文大小，避免无限下载
    const reader = response.body?.getReader()
    let bodyBytes = 0
    const chunks = []
    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        bodyBytes += value.length
        if (bodyBytes > maxBytes) {
          await reader.cancel()
          break
        }
        chunks.push(value)
      }
    }
    const buffer = Buffer.concat(chunks)
    const contentHash = crypto.createHash('sha256').update(buffer).digest('hex')
    return {
      ok: true,
      httpStatus: response.status,
      finalUrl: response.url || url,
      contentHash,
      contentLength: bodyBytes,
      truncated: bodyBytes >= maxBytes,
    }
  } catch (error) {
    return {
      ok: false,
      errorName: error?.name || 'Unknown',
      errorMessage: error?.message || String(error),
    }
  } finally {
    clearTimeout(timer)
  }
}

function classifyReviewStatus(fetchResult, baselineHash, options = {}) {
  const timeoutMs = options.timeoutMs || TIMEOUT_MS
  // 网络异常分类
  if (!fetchResult.ok) {
    const name = fetchResult.errorName
    if (name === 'AbortError') return { reviewStatus: 'manual-review', note: `超时（${timeoutMs}ms），需人工打开` }
    if (name === 'TypeError') return { reviewStatus: 'manual-review', note: `TLS/DNS/连接失败：${fetchResult.errorMessage}` }
    return { reviewStatus: 'manual-review', note: `网络异常：${name}` }
  }
  const status = fetchResult.httpStatus
  // 401/403/429/验证码/反爬统一标记 manual-review
  if (status === 401 || status === 403 || status === 429) {
    return { reviewStatus: 'manual-review', note: `HTTP ${status}：可能需要授权或被反爬，需人工打开` }
  }
  // 404/410 只能标记 source-unavailable，不能写"政策失效"
  if (status === 404 || status === 410) {
    return { reviewStatus: 'source-unavailable', note: `HTTP ${status}：来源页面不可用，需人工核对` }
  }
  // 5xx 服务端错误
  if (status >= 500) {
    return { reviewStatus: 'manual-review', note: `HTTP ${status}：服务端错误，需稍后重试或人工打开` }
  }
  // 2xx 成功，比较哈希
  if (status >= 200 && status < 300) {
    if (!baselineHash) {
      return { reviewStatus: 'no-baseline', note: '首次检查，无旧基线可比较' }
    }
    if (fetchResult.contentHash === baselineHash) {
      return { reviewStatus: 'unchanged', note: '内容摘要与基线一致' }
    }
    return { reviewStatus: 'content-changed', note: '内容摘要发生变化，需人工复核' }
  }
  // 3xx 未跟随（理论上 fetch follow 后不会到这里）
  if (status >= 300 && status < 400) {
    return { reviewStatus: 'manual-review', note: `HTTP ${status}：重定向未自动跟随，需人工打开` }
  }
  // 其他状态码
  return { reviewStatus: 'manual-review', note: `HTTP ${status}：非预期状态，需人工打开` }
}

async function loadBaseline(options = {}) {
  const basePath = options.baselinePath || BASELINE_PATH
  try {
    const content = await readFile(basePath, 'utf8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

// 判断 fetchResult 是否为可写入基线的 2xx 成功响应
function isBaselineWritable(entry) {
  // 只有 2xx 成功获取且非截断的页面哈希才可写入基线
  // 截断页面内容不完整，哈希不稳定，不写入
  return (
    entry.httpStatus !== null &&
    entry.httpStatus !== undefined &&
    entry.httpStatus >= 200 &&
    entry.httpStatus < 300 &&
    !!entry.contentHash &&
    !entry.truncated
  )
}

// 重建基线：只写入本次成功获取的 2xx 页面哈希
// 使用临时文件 + rename，避免写到一半损坏
async function saveBaseline(entries, options = {}) {
  const basePath = options.baselinePath || BASELINE_PATH
  const dir = path.dirname(basePath)
  const baseline = {
    generatedAt: new Date().toISOString(),
    entries: entries
      .filter(isBaselineWritable)
      .map((e) => ({ sourceUrl: e.sourceUrl, contentHash: e.contentHash })),
  }
  await mkdir(dir, { recursive: true })
  // 临时文件 + rename，原子性保证
  const tmpPath = `${basePath}.tmp-${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
  await writeFile(tmpPath, JSON.stringify(baseline, null, 2), 'utf8')
  try {
    await rename(tmpPath, basePath)
  } catch (error) {
    // rename 失败时清理临时文件
    try {
      await unlink(tmpPath)
    } catch {}
    throw error
  }
}

// 联网检查模式
// - reset=false（普通 --online）：只读基线，绝不覆盖
// - reset=true（--reset）：用本次 2xx 成功哈希重建基线
async function buildOnlineReport({ reset = false, fetchImpl, baselinePath, reportDir, timeoutMs, maxBytes } = {}) {
  // 普通 --online 只读取基线并生成报告，绝不覆盖基线
  // --reset 时不读取旧基线，用本次 2xx 哈希重建
  const baseline = reset ? null : await loadBaseline({ baselinePath })
  const baselineMap = new Map()
  if (baseline?.entries) {
    for (const entry of baseline.entries) baselineMap.set(entry.sourceUrl, entry.contentHash)
  }

  const entries = []
  for (const [index, policy] of subsidyPolicies.entries()) {
    const sourceUrl = policy.sourceUrl || ''
    const baselineHash = baselineMap.get(sourceUrl) || null
    const fetchResult = await fetchWithLimits(sourceUrl, { fetchImpl, timeoutMs, maxBytes })
    const classification = classifyReviewStatus(fetchResult, baselineHash, { timeoutMs })

    entries.push({
      index: index + 1,
      city: policy.city || '',
      policy: policy.policy || '',
      sourceName: policy.sourceName || '',
      sourceUrl,
      checkedAt: policy.checkedAt || '',
      status: policy.status || '',
      reviewStatus: classification.reviewStatus,
      note: classification.note,
      httpStatus: fetchResult.ok ? fetchResult.httpStatus : null,
      finalUrl: fetchResult.ok ? fetchResult.finalUrl : null,
      contentHash: fetchResult.ok ? fetchResult.contentHash : null,
      contentLength: fetchResult.ok ? fetchResult.contentLength : null,
      truncated: fetchResult.ok ? fetchResult.truncated : false,
      checkedAtReview: new Date().toISOString(),
      baselineHash,
    })
    // 单个页面失败不能中断其他城市检查
  }

  // 只在 --reset 模式下重建基线，且只写入 2xx 成功的哈希
  // 普通 --online 绝不写入基线，content-changed 持续保持
  if (reset) {
    await saveBaseline(entries, { baselinePath })
  }

  return summarize(entries)
}

// ---------- 报告汇总 ----------
function summarize(entries) {
  const counts = { unchanged: 0, 'content-changed': 0, 'manual-review': 0, 'no-baseline': 0, 'source-unavailable': 0 }
  for (const e of entries) {
    if (counts[e.reviewStatus] !== undefined) counts[e.reviewStatus] += 1
  }
  // 按城市排序
  const sorted = [...entries].sort((a, b) => (a.city || '').localeCompare(b.city || '', 'zh-CN'))
  return { generatedAt: new Date().toISOString(), total: entries.length, counts, entries: sorted }
}

// ---------- 输出 ----------
async function writeReports(report, options = {}) {
  const dir = options.reportDir || REPORT_DIR
  await mkdir(dir, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const jsonPath = path.join(dir, `report-${timestamp}.json`)
  const mdPath = path.join(dir, `report-${timestamp}.md`)

  await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8')

  const md = renderMarkdown(report)
  await writeFile(mdPath, md, 'utf8')

  return { jsonPath, mdPath }
}

function renderMarkdown(report) {
  const lines = []
  lines.push('# 补贴政策人工复核报告')
  lines.push('')
  lines.push(`> 生成时间：${report.generatedAt}`)
  lines.push(`> 政策总数：${report.total}`)
  lines.push(`> 说明：本报告仅辅助发现来源页面变化，不自动判断政策有效或失效。`)
  lines.push('')
  lines.push('## 汇总')
  lines.push('')
  lines.push('| 状态 | 数量 |')
  lines.push('|---|---|')
  lines.push(`| unchanged（内容未变化） | ${report.counts.unchanged} |`)
  lines.push(`| content-changed（内容变化，需人工复核） | ${report.counts['content-changed']} |`)
  lines.push(`| manual-review（需人工打开） | ${report.counts['manual-review']} |`)
  lines.push(`| no-baseline（无旧基线） | ${report.counts['no-baseline']} |`)
  lines.push(`| source-unavailable（来源不可用） | ${report.counts['source-unavailable']} |`)
  lines.push('')
  lines.push('## 明细（按城市排序）')
  lines.push('')

  for (const e of report.entries) {
    lines.push(`### ${e.city} · ${e.policy}`)
    lines.push('')
    lines.push(`- 序号：${e.index}`)
    lines.push(`- 来源名称：${e.sourceName}`)
    lines.push(`- 来源 URL：${e.sourceUrl}`)
    lines.push(`- 上次核对：${e.checkedAt}`)
    lines.push(`- 当前状态：${e.status}`)
    lines.push(`- 复核状态：**${e.reviewStatus}**`)
    lines.push(`- 备注：${e.note}`)
    if (e.httpStatus !== null && e.httpStatus !== undefined) {
      lines.push(`- HTTP 状态：${e.httpStatus}`)
    }
    if (e.finalUrl) {
      lines.push(`- 最终 URL：${e.finalUrl}`)
    }
    if (e.contentHash) {
      lines.push(`- 内容摘要 SHA-256：\`${e.contentHash}\``)
    }
    if (e.truncated) {
      lines.push(`- ⚠️ 响应正文超过 ${MAX_BYTES} 字节，已被截断`)
    }
    lines.push('')
  }

  lines.push('---')
  lines.push('## 重要说明')
  lines.push('')
  lines.push('1. 本报告不修改任何政策金额、条件、状态、checkedAt 或政策结论。')
  lines.push('2. 404/410 仅表示来源页面当前不可用，**不代表政策失效**，需人工核对。')
  lines.push('3. 401/403/429/验证码/反爬/超时/TLS/DNS 失败统一标记为 manual-review。')
  lines.push('4. 单个页面失败不会中断其他城市检查。')
  lines.push('5. 政府网站拒绝自动访问时标记为"需人工打开"，不能直接判政策失效。')
  lines.push('6. 普通 --online 只读基线，content-changed 持续保持，直到用户显式执行 --reset 重建基线。')
  lines.push('7. --reset 只写入本次成功获取的 2xx 页面哈希，401/403/404/410/429/5xx/超时不进入基线。')
  lines.push('')

  return lines.join('\n')
}

// ---------- 主流程（仅直接运行时执行）----------
async function main() {
  // ---------- 参数解析 ----------
  const args = new Set(process.argv.slice(2))
  const modeOffline = args.has('--offline')
  const modeOnline = args.has('--online')
  const resetBaseline = args.has('--reset')

  if (!modeOffline && !modeOnline) {
    console.error('用法: node scripts/review-subsidy-policies.mjs --offline | --online [--reset]')
    process.exit(2)
  }

  let report
  if (modeOffline) {
    report = buildOfflineReport()
  } else {
    report = await buildOnlineReport({ reset: resetBaseline })
  }

  const { jsonPath, mdPath } = await writeReports(report)

  console.log(`补贴政策人工复核报告已生成：`)
  console.log(`  JSON: ${jsonPath}`)
  console.log(`  Markdown: ${mdPath}`)
  console.log(``)
  console.log(`汇总：共 ${report.total} 条`)
  console.log(`  unchanged: ${report.counts.unchanged}`)
  console.log(`  content-changed: ${report.counts['content-changed']}`)
  console.log(`  manual-review: ${report.counts['manual-review']}`)
  console.log(`  no-baseline: ${report.counts['no-baseline']}`)
  console.log(`  source-unavailable: ${report.counts['source-unavailable']}`)

  // 不修改政策源文件，只读验证
  const sourceAfter = await readFile(new URL('../src/data/subsidyPolicies.js', import.meta.url), 'utf8')
  const miniappAfter = await readFile(new URL('../miniapp/src/shared/subsidyPolicies.js', import.meta.url), 'utf8')
  if (sourceAfter.includes('__review_marker__') || miniappAfter.includes('__review_marker__')) {
    console.error('严重错误：政策源文件被意外修改')
    process.exitCode = 1
  }
}

// 仅在直接运行时执行主流程（被 import 时不执行）
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main().catch((error) => {
    console.error('补贴政策人工复核报告生成失败：', error)
    process.exit(1)
  })
}
