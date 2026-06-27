import { aiEvalCases } from './data/ai-eval-cases.mjs'
import { evaluateKnowledgeRetrieval } from './rag-engine.mjs'

const results = evaluateKnowledgeRetrieval(aiEvalCases, 5)
const passed = results.filter((item) => item.passed).length
const failed = results.length - passed

console.log(`AI RAG evaluation: ${passed}/${results.length} passed`)

results.forEach((item) => {
  const status = item.passed ? 'PASS' : 'FAIL'
  console.log(`${status} ${item.id} [${item.category}]`)
  console.log(`  query: ${item.query}`)
  console.log(`  expected: ${item.expectedIds.join(', ')}`)
  console.log(`  returned: ${item.returnedIds.join(', ')}`)
  console.log(`  top: ${item.topTitle} (${item.topScore})`)
})

if (failed > 0) {
  process.exitCode = 1
}
