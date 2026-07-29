import assert from 'node:assert/strict'

Object.assign(globalThis, {
  ENABLE_INNER_HTML: false,
  ENABLE_ADJACENT_HTML: false,
  ENABLE_CLONE_NODE: false,
  ENABLE_CONTAINS: false,
  ENABLE_SIZE_APIS: false,
  ENABLE_TEMPLATE_CONTENT: false,
  ENABLE_MUTATION_OBSERVER: false,
})

const [{ demoContracts }, contractReview, aiAssistant] = await Promise.all([
  import('../src/data/demoContracts.js'),
  import('../miniapp/src/features/contractReview.js'),
  import('../miniapp/src/features/aiAssistant.js'),
])
const { analyzeContract, cleanContractTextForReview, getRiskSummary } = contractReview
const { buildLocalReply, formatMessageBlocks } = aiAssistant

const contractText = demoContracts[0].text
const findings = analyzeContract(cleanContractTextForReview(contractText))
const summary = getRiskSummary(findings)
const reply = buildLocalReply({ prompt: '押金不退怎么办？', contractText, findings, summary })

assert.ok(findings.length > 0, '演示合同应命中风险')
assert.ok(Number.isFinite(summary.score), '风险评分应为数字')
assert.match(reply, /结论：/)
assert.match(reply, /当前合同评分/)
assert.ok(formatMessageBlocks(reply).length >= 4, 'AI 回复应按栏目拆分')

console.log(`Miniapp core check passed: ${findings.length} findings, score ${summary.score}`)
