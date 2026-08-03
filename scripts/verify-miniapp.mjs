import { spawnSync } from 'node:child_process'
import process from 'node:process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const steps = [
  ['lint', root],
  ['test:e2e', root],
  ['test:miniapp-core', root],
  ['test:miniapp-reliability', root],
  ['test:miniapp-ai', root],
  ['test:miniapp-usage', root],
  ['test:miniapp-report', root],
  ['test:contract-import', root],
  ['test:contract-review-benchmark', root],
  ['test:miniapp-http', root],
  ['test:subsidy-review', root],
  ['test:subsidy-live', root],
  ['check:subsidy-policies', root],
  ['smoke:miniapp', root],
  ['build', root],
  ['build:weapp', path.join(root, 'miniapp')],
]

for (const [script, cwd] of steps) {
  const result = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', `npm.cmd run ${script}`], { cwd, stdio: 'inherit' })
    : spawnSync('npm', ['run', script], { cwd, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
}
