import assert from 'node:assert/strict'
import { demoContracts } from '../src/data/demoContracts.js'
import {
  analyzeContract,
  cleanContractTextForReview,
  getRiskSummary,
} from '../miniapp/src/features/contractReview.js'
import { buildLocalReply, formatMessageBlocks } from '../miniapp/src/features/aiAssistant.js'

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
