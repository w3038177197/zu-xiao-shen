import assert from 'node:assert/strict'
import { checkOfficialPolicySource, getSubsidyPolicyFeed } from '../server/subsidy-policy-service.mjs'

const policy = { sourceUrl: 'https://example.gov.cn/policy', checkedAt: '2026-06-25' }
const headers = new Headers({ 'last-modified': 'Wed, 01 Jul 2026 00:00:00 GMT' })
const fetchImpl = async () => ({ status: 200, url: policy.sourceUrl, headers, body: { cancel: async () => {} } })

const review = await checkOfficialPolicySource(policy, { fetchImpl, now: Date.parse('2026-08-02T00:00:00Z') })
assert.equal(review.status, 'available')
assert.equal(review.mayHaveChanged, true)

const feed = await getSubsidyPolicyFeed('杭州', { fetchImpl, now: Date.parse('2026-08-02T00:00:00Z') })
assert.equal(feed.policies.length > 0, true)
assert.equal(feed.policies[0].liveReview.status, 'available')

const empty = await getSubsidyPolicyFeed('不存在的城市', { fetchImpl })
assert.deepEqual(empty.policies, [])
console.log('补贴政策实时数据测试通过')
