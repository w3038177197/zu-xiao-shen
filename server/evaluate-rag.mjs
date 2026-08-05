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

// 域名语义匹配校验：sourceUrl 必须与 source/title 所引法律法规的发布机关匹配
// 生态环境部（mee.gov.cn）不是住房租赁/住建领域法规的发布机关，不得作为来源
const FORBIDDEN_DOMAINS = ['mee.gov.cn']
// 已知法规 → 允许的权威域名（source/title 含关键词时，sourceUrl 域名须命中其一）
const AUTHORITY_DOMAIN_MAP = [
  { keywords: ['住房租赁条例'], allowedDomains: ['gov.cn', 'mohurd.gov.cn'] },
]
;[...legalKnowledgeItems, ...productFlowItems].forEach((item) => {
  const haystack = `${item.source || ''} ${item.title || ''}`
  // 1. 禁止域名：任何条目不得指向生态环境部等无关站点
  FORBIDDEN_DOMAINS.forEach((domain) => {
    if (item.sourceUrl && item.sourceUrl.includes(domain)) {
      throw new Error(`来源域名 ${domain} 与条目 ${item.id} 的法律法规发布机关不符（生态环境部不发布住房租赁法规）`)
    }
  })
  // 2. 语义匹配：source/title 含特定法规关键词时，sourceUrl 域名须命中允许列表
  AUTHORITY_DOMAIN_MAP.forEach(({ keywords, allowedDomains }) => {
    const matched = keywords.some((kw) => haystack.includes(kw))
    if (matched && item.sourceUrl) {
      const ok = allowedDomains.some((d) => item.sourceUrl.includes(d))
      if (!ok) {
        throw new Error(`条目 ${item.id} 引用 ${keywords.join('/')}，sourceUrl 须为 ${allowedDomains.join(' 或 ')}，实际：${item.sourceUrl}`)
      }
    }
  })
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
