import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = path.join(rootDir, 'src/features/contractReview.js')
const targetPath = path.join(rootDir, 'miniapp/src/features/contractReview.js')

let code = readFileSync(sourcePath, 'utf8')

code = code
  .replace(/^import \{[^}]*\} from 'lucide-react'\r?\n/m, '')
  .replace(/^[ \t]*icon: [A-Za-z0-9]+,[ \t]*\r?\n/gm, '')
  .replace("from '../constants/reviewOptions.js'", "from '../../../src/constants/reviewOptions.js'")
  .replace("from '../data/knowledgeBase.js'", "from '../../../src/data/knowledgeBase.js'")

if (/lucide-react|icon:/.test(code)) {
  throw new Error('同步失败：仍残留图标引用')
}

const header = '// 由 scripts/sync-miniapp-review.mjs 从 Web 端自动生成，请勿手工修改。\n'
writeFileSync(targetPath, header + code)
console.log('已同步合同审查引擎到小程序端')
