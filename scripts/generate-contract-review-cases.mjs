import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateSyntheticRentalContracts } from './contract-review-benchmark-data.mjs'

function readNumberArg(name, fallback) {
  const prefix = `--${name}=`
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
  const value = Number(raw)
  return Number.isFinite(value) ? value : fallback
}

const count = readNumberArg('count', 10)
const risksPerContract = readNumberArg('risks', 12)
const seed = readNumberArg('seed', Date.now())
const cases = generateSyntheticRentalContracts({ count, risksPerContract, seed })
const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = path.join(rootDir, 'generated-reports', 'contract-review', String(seed))

mkdirSync(outputDir, { recursive: true })
writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  fictional: true,
  seed,
  count: cases.length,
  risksPerContract: cases[0]?.expectedRiskIds.length || 0,
  cases: cases.map(({ id, title, expectedRiskIds }) => ({ id, title, expectedRiskIds })),
}, null, 2)}\n`, 'utf8')

cases.forEach((testCase) => {
  writeFileSync(path.join(outputDir, `${testCase.id}.txt`), `${testCase.text}\n`, 'utf8')
})

console.log(`已生成 ${cases.length} 份虚构合同：${outputDir}`)
console.log(`seed=${seed}，每份 ${cases[0]?.expectedRiskIds.length || 0} 个已标注风险`)
