// 小程序冒烟测试：静态校验页面入口、空/有数据分支、本地降级路径和备份/恢复入口。
//
// 说明：
// - 本机未安装微信开发者工具 CLI，无法做 IDE 自动化（miniprogram-automator）。
// - 本脚本只做源码静态断言：确认关键入口、空数据/有数据分支、
//   本地降级提示、备份/恢复按钮存在且与当前真实行为一致。
// - 不依赖 miniapp/dist 编译产物（dist 被 .gitignore 忽略），避免干净 clone 失败。
// - 真机专属能力（相机、相册、微信隐私授权、文件选择、支付）不在此处伪造，
//   详见 miniapp/docs/manual-smoke-checklist.md。
// - 失败时输出具体缺失项，便于定位。

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const miniappSrc = join(root, 'miniapp', 'src')

const checks = []
const check = (name, fn) => checks.push([name, fn])

function readSrc(relPath) {
  return readFileSync(join(miniappSrc, relPath), 'utf8')
}

function readPage(pageName) {
  return readSrc(join('pages', pageName, 'index.jsx'))
}

// ---------- 1. 首页首次进入：入口与空数据/有数据分支 ----------
check('首页：品牌、三步走、AI、补贴和报告导出入口齐全', () => {
  const home = readPage('index')
  assert.match(home, /租小审/, '首页应显示品牌名')
  assert.match(home, /租房三步走/, '首页应有三步走区域')
  assert.match(home, /问租房 AI/, '首页应有 AI 入口')
  assert.match(home, /住房补贴匹配/, '首页应有补贴入口')
  assert.match(home, /报告导出中心/, '首页应有报告导出中心')
})

check('首页：空数据首次进入显示"开始审查合同"', () => {
  const home = readPage('index')
  // getCurrentStep 在 review.hasData=false 时返回"开始审查合同"
  assert.match(home, /开始审查合同/, '空数据应引导开始审查合同')
  assert.match(home, /先把合同风险看懂/, '空数据应有引导文案')
})

check('首页：有数据时显示继续审查/继续验房/继续整理', () => {
  const home = readPage('index')
  assert.match(home, /继续审查/, '有合同草稿时应显示继续审查')
  assert.match(home, /继续入住验房|继续验房/, '有验房数据时应显示继续验房')
  assert.match(home, /继续整理退租证据|继续整理/, '有证据数据时应显示继续整理')
})

check('首页：业务 Word 报告与恢复用备份入口存在', () => {
  const home = readPage('index')
  assert.match(home, /报告导出中心/, '首页应有报告导出中心')
  assert.match(home, /导出所选 Word/, '首页应有所选报告导出按钮')
  assert.match(home, /一键导出全部/, '首页应有全量报告导出按钮')
  assert.match(home, /buildBusinessReportDocx/, '业务报告应调用统一 Word 生成器')
  assert.match(home, /生成恢复用备份/, '高级数据管理应保留备份按钮')
  assert.match(home, /导入恢复用备份/, '高级数据管理应保留恢复按钮')
  assert.match(home, /restoreLocalData/, '导入备份应调用 restoreLocalData')
})

// ---------- 2. 合同审查：空数据/已有数据 ----------
check('合同审查：空数据引导粘贴或导入，有演示合同', () => {
  const contract = readPage('contract')
  assert.match(contract, /粘贴正文，或导入 TXT、MD、DOCX、PDF/, '空数据应有粘贴/导入引导')
  assert.match(contract, /手机粘贴/, '应有手机粘贴入口')
  assert.match(contract, /载入演示合同/, '应有载入演示合同入口')
  assert.match(contract, /清空合同正文/, '有正文时应有清空入口')
  assert.match(contract, /拍照识别/, '合同页应有拍照 OCR 入口')
  assert.match(contract, /相册识别/, '合同页应有相册 OCR 入口')
  assert.match(contract, /请先粘贴或导入合同/, '空数据提交时应提示先粘贴')
})

check('合同审查：有数据时显示风险评分与审查记录', () => {
  const contract = readPage('contract')
  assert.match(contract, /风险评分/, '有审查结果时应显示风险评分')
  assert.match(contract, /审查记录/, '应有审查记录入口')
})

// ---------- 3. 入住验房：空数据/已有数据 ----------
check('入住验房：空数据引导按房间拍照，有数据时显示统计', () => {
  const checkin = readPage('checkin')
  assert.doesNotMatch(checkin, /导出报告 TXT|复制完整报告|让 AI 解读验房记录/, '验房页导出统一由首页报告中心处理')
})

// ---------- 4. 证据包：空数据/已有数据 ----------
check('证据包：空数据提示暂无附件，有数据时显示 AI 润色入口', () => {
  const evidence = readPage('evidence')
  assert.match(evidence, /该组暂无附件/, '空数据应提示暂无附件')
  assert.match(evidence, /用 AI 润色说明/, '应有当前页 AI 润色沟通说明入口')
  assert.match(evidence, /暂无证据资料可润色/, '空数据时 AI 润色应禁用并提示')
})

// ---------- 5. 补贴匹配 ----------
check('补贴匹配：城市选择、个人情况输入、匹配结果、本地降级', () => {
  const subsidy = readPage('subsidy')
  assert.match(subsidy, /搜索城市/, '应有城市关键词搜索框')
  assert.match(subsidy, /city-result/, '应有可点击的城市搜索结果')
  assert.match(subsidy, /个人情况/, '应有个人情况输入')
  assert.match(subsidy, /政策线索/, '应有政策线索结果区')
  assert.match(subsidy, /本地降级/, '联网失败时应显示本地降级')
  assert.match(subsidy, /重试联网/, '应有重试联网入口')
  assert.match(subsidy, /请填写真实情况后再查看匹配判断/, '空数据应提示填写真实情况')
  assert.match(subsidy, /识别到城市不一致/, '城市冲突应前置提示')
  assert.match(subsidy, /生成申请建议/, 'AI 入口应贴近申请决策')
})

// ---------- 6. AI 本地降级 ----------
check('AI 页面：默认优先联网、首次授权、拒绝/未授权/不可用时本地降级', () => {
  const ai = readPage('ai')
  assert.match(ai, /优先联网 AI/, '应提示默认优先联网 AI')
  assert.match(ai, /失败自动本地回答/, '应提示失败自动本地回答')
  assert.match(ai, /本地降级/, '应有本地降级标记')
  assert.match(ai, /已使用本地回答/, '失败时应提示已使用本地回答')
  assert.match(ai, /重试联网/, '应有重试联网入口')
  assert.match(ai, /联网授权未完成，本次已使用本地回答/, '未授权时应本地降级')
  assert.match(ai, /已撤销联网授权，下次发送前会再次询问/, '撤销授权应有提示')
  assert.match(ai, /今日额度已用完/, '额度耗尽应有提示')
})

// ---------- 7. 数据备份导出/导入入口 ----------
check('数据管理：主区只放 Word 报告，高级区保留恢复、清理和清除入口', () => {
  const home = readPage('index')
  assert.match(home, /合同分析报告/, '应有合同报告选项')
  assert.match(home, /入住验房报告/, '应有验房报告选项')
  assert.match(home, /证据包汇总/, '应有证据包选项')
  assert.doesNotMatch(home, /导出数据 TXT/, '首页主区不应再导出原始 TXT 数据')
  assert.doesNotMatch(home, /复制数据/, '首页主区不应再复制原始数据')
  assert.match(home, /高级数据管理/, '应有高级数据管理入口')
  assert.match(home, /清理无用文件/, '应有清理无用文件按钮')
  assert.match(home, /清除全部数据/, '应有清除全部数据按钮')
})

check('数据管理：备份导入前展示摘要并请求用户确认', () => {
  const home = readPage('index')
  assert.match(home, /parseBackupSummary/, '导入前应解析摘要')
  assert.match(home, /确认恢复备份/, '导入前应弹窗确认')
  assert.match(home, /恢复将写回当前本机资料/, '确认弹窗应说明写回范围')
})

// ---------- 8. 双源知识库一致 ----------
check('知识库：Web 与小程序双源一致且无错误来源域名', async () => {
  const [{ knowledgeBaseItems: webItems }, { knowledgeBaseItems: miniappItems }] = await Promise.all([
    import('../src/data/knowledgeBase.js'),
    import('../miniapp/src/shared/knowledgeBase.js'),
  ])
  assert.deepEqual(miniappItems, webItems, 'Web 与小程序知识库应一致')
  assert.ok(webItems.length >= 39, '知识库应至少 39 条')
  // 住房租赁条例来源不得指向生态环境部（mee.gov.cn）等无关站点
  const forbidden = ['mee.gov.cn']
  for (const item of webItems) {
    for (const domain of forbidden) {
      if (item.sourceUrl && item.sourceUrl.includes(domain)) {
        assert.fail(`知识条目 ${item.title} 来源不得指向 ${domain}`)
      }
    }
  }
})

// ---------- 9. 本地 AI 兜底可用 ----------
check('AI 本地兜底：buildLocalReply 可用且简短', async () => {
  Object.assign(globalThis, {
    ENABLE_INNER_HTML: false,
    ENABLE_ADJACENT_HTML: false,
    ENABLE_CLONE_NODE: false,
    ENABLE_CONTAINS: false,
    ENABLE_SIZE_APIS: false,
    ENABLE_TEMPLATE_CONTENT: false,
    ENABLE_MUTATION_OBSERVER: false,
  })
  const { buildLocalReply } = await import('../miniapp/src/features/aiAssistant.js')
  const reply = buildLocalReply({ prompt: '押金不退怎么办？' })
  assert.match(reply, /现在先做/, '本地回复应包含首要行动')
  assert.ok(reply.length <= 500, '本地回复应简短')
})

// ---------- 执行 ----------
let failed = 0
for (const [name, fn] of checks) {
  try {
    const result = fn()
    if (result instanceof Promise) await result
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    console.error(`     ${error.message}`)
    failed += 1
  }
}

console.log(`\n小程序冒烟测试：${checks.length - failed}/${checks.length} 通过`)
if (failed > 0) {
  process.exit(1)
}
