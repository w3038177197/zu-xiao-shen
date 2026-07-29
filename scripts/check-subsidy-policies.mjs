import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { subsidyPolicies } from '../src/data/subsidyPolicies.js'

const MAX_AGE_DAYS = 90
const now = new Date()
const errors = []

for (const [index, policy] of subsidyPolicies.entries()) {
  const name = `${policy.city || `第 ${index + 1} 条`} / ${policy.policy || '未命名政策'}`
  if (!String(policy.city || '').trim()) errors.push(`${name}: 缺少城市`)
  if (!String(policy.policy || '').trim()) errors.push(`${name}: 缺少政策名称`)
  if (!/^https:\/\//.test(policy.sourceUrl || '')) errors.push(`${name}: sourceUrl 必须是 HTTPS 官方来源`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(policy.checkedAt || '')) {
    errors.push(`${name}: checkedAt 格式必须为 YYYY-MM-DD`)
    continue
  }
  const checkedAt = new Date(`${policy.checkedAt}T00:00:00+08:00`)
  const ageDays = Math.floor((now - checkedAt) / 86_400_000)
  if (!Number.isFinite(ageDays) || ageDays < 0) errors.push(`${name}: checkedAt 日期无效或晚于今天`)
  else if (ageDays > MAX_AGE_DAYS) errors.push(`${name}: 已 ${ageDays} 天未核对，超过 ${MAX_AGE_DAYS} 天`)
}

const [webSource, miniappSource] = await Promise.all([
  readFile(new URL('../src/data/subsidyPolicies.js', import.meta.url), 'utf8'),
  readFile(new URL('../miniapp/src/shared/subsidyPolicies.js', import.meta.url), 'utf8'),
])
assert.equal(miniappSource, webSource, '小程序补贴政策副本与 Web 源文件不一致，请同步后再提交')

if (errors.length) {
  console.error(`补贴政策检查失败（${errors.length} 项）：`)
  errors.forEach((error) => console.error(`- ${error}`))
  process.exitCode = 1
} else {
  console.log(`补贴政策检查通过：${subsidyPolicies.length} 条，均在 ${MAX_AGE_DAYS} 天内核对`)
}
