import { legalKnowledgeItems } from './data/legal-knowledge.mjs'

const fallbackTokens = ['租赁合同', '押金', '维修', '租金', '格式条款']

function normalizeText(value) {
  return String(value || '').toLowerCase()
}

function tokenizeText(text) {
  const value = normalizeText(text)
  const rawTokens = value.match(/[\p{Script=Han}]{2,}|[a-z0-9-]{2,}/gu) || []
  const gramTokens = rawTokens.flatMap((token) => {
    if (!/^[\p{Script=Han}]+$/u.test(token)) return [token]
    const grams = []
    for (let size = 2; size <= Math.min(4, token.length); size += 1) {
      for (let index = 0; index <= token.length - size; index += 1) {
        grams.push(token.slice(index, index + size))
      }
    }
    return grams
  })
  const keywordTokens = legalKnowledgeItems
    .flatMap((item) => [item.title, item.tag, item.scope, ...(item.keywords || [])])
    .filter(Boolean)
    .filter((keyword) => value.includes(normalizeText(keyword)))

  return Array.from(new Set([...rawTokens, ...gramTokens, ...keywordTokens].map(normalizeText).filter(Boolean)))
}

function toSearchText(item) {
  return normalizeText(
    [
      item.title,
      item.tag,
      item.source,
      item.scope,
      item.riskLevel,
      item.text,
      ...(item.keywords || []),
    ].join(' '),
  )
}

function scoreKnowledgeItem(queryTokens, item) {
  const haystack = toSearchText(item)
  const keywordSet = new Set([item.title, item.tag, item.scope, ...(item.keywords || [])].filter(Boolean).map(normalizeText))
  const matchedKeywords = []

  const score = queryTokens.reduce((total, token) => {
    if (!token) return total
    let nextScore = total

    if (keywordSet.has(token)) {
      matchedKeywords.push(token)
      nextScore += 18
    } else if ([...keywordSet].some((keyword) => keyword.includes(token) || token.includes(keyword))) {
      matchedKeywords.push(token)
      nextScore += 10
    } else if (haystack.includes(token)) {
      matchedKeywords.push(token)
      nextScore += token.length >= 4 ? 5 : 2
    }

    return nextScore
  }, 0)

  const coverage = matchedKeywords.length / Math.max(queryTokens.length, 1)
  const riskBoost = item.riskLevel === 'high' && score > 0 ? 2 : 0

  return {
    score: Math.round(score + coverage * 10 + riskBoost),
    matchedKeywords: Array.from(new Set(matchedKeywords)).slice(0, 8),
  }
}

export function searchKnowledge(query, limit = 5) {
  const tokens = tokenizeText(query)
  const queryTokens = tokens.length ? tokens : fallbackTokens.map(normalizeText)
  const cappedLimit = Math.max(1, Math.min(Number(limit) || 5, 12))

  return legalKnowledgeItems
    .map((item) => {
      const result = scoreKnowledgeItem(queryTokens, item)
      return {
        ...item,
        score: result.score,
        matchedKeywords: result.matchedKeywords,
      }
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, cappedLimit)
}

export function evaluateKnowledgeRetrieval(cases, limit = 5) {
  return cases.map((testCase) => {
    const items = searchKnowledge(testCase.query, limit)
    const ids = items.map((item) => item.id)
    const expectedIds = testCase.expectedIds || []
    const matchedIds = expectedIds.filter((id) => ids.includes(id))

    return {
      ...testCase,
      passed: matchedIds.length === expectedIds.length,
      matchedIds,
      returnedIds: ids,
      topTitle: items[0]?.title || '',
      topScore: items[0]?.score || 0,
    }
  })
}
