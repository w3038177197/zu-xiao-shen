import { aiEvalCases } from './data/ai-eval-cases.mjs'
import { legalKnowledgeItems, productFlowItems } from './data/legal-knowledge.mjs'
import { evaluateKnowledgeRetrieval } from './rag-engine.mjs'

const ids = [...legalKnowledgeItems, ...productFlowItems].map((item) => item.id)
if (new Set(ids).size !== ids.length) throw new Error('知识库 id 必须唯一')
legalKnowledgeItems.forEach((item) => {
  if (!item.id || !item.title || !item.source || !item.scope || !item.text || !item.updatedAt || !item.keywords?.length) {
    throw new Error(`知识条目字段不完整：${item.id || item.title || 'unknown'}`)
  }
  if (!item.sourceUrl || !/^https:\/\//i.test(item.sourceUrl)) throw new Error(`官方法律知识来源必须为非空 HTTPS：${item.id}`)
})
productFlowItems.forEach((item) => {
  if (!item.id || !item.title || !item.source || !item.scope || !item.text || !item.updatedAt || !item.keywords?.length) {
    throw new Error(`产品流程条目字段不完整：${item.id || item.title || 'unknown'}`)
  }
  if (item.sourceUrl && !/^https:\/\//i.test(item.sourceUrl)) throw new Error(`产品流程来源若提供则必须为 HTTPS：${item.id}`)
})

const results = evaluateKnowledgeRetrieval(aiEvalCases, 5)
const passed = results.filter((item) => item.passed).length
const failed = results.length - passed

console.log(`AI RAG evaluation: ${passed}/${results.length} passed; ${legalKnowledgeItems.length} legal + ${productFlowItems.length} product-flow items validated`)

results.forEach((item) => {
  const status = item.passed ? 'PASS' : 'FAIL'
  console.log(`${status} ${item.id} [${item.category}]`)
  console.log(`  query: ${item.query}`)
  console.log(`  expected: ${item.expectedIds.join(', ')}`)
  if (item.topExpectedId) console.log(`  expected top: ${item.topExpectedId}`)
  console.log(`  returned: ${item.returnedIds.join(', ')}`)
  console.log(`  top: ${item.topTitle} (${item.topScore})`)
})

if (failed > 0) {
  process.exitCode = 1
}
