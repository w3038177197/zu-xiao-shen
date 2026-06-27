import { expect, test } from '@playwright/test'
import mammoth from 'mammoth'

test('apply all rewrites the contract before the next review', async ({ page }) => {
  await page.route('**/api/ai/chat', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'force local review fallback' }),
    })
  })

  await page.goto('/')
  await page.getByRole('button', { name: '租房审查', exact: true }).click()

  const editor = page.getByRole('textbox', { name: /在这里粘贴租房合同正文/ })
  await expect(editor).toContainText('自动续期12个月')

  await page.getByRole('button', { name: '全部采纳' }).click()

  const optimizedText = await editor.inputValue()
  const oldRiskTerms = [
    '自动续期12个月',
    '上调8%',
    '月租金5%作为滞纳金',
    '换锁收回房屋',
    '已收租金及押金不予退还',
    '45个工作日内退还押金',
    '甲方户籍所在地人民法院',
    '不得以"未注意"或"不理解"',
    '本合同解释权归甲方',
  ]

  oldRiskTerms.forEach((term) => {
    expect(optimizedText).not.toContain(term)
  })
  await expect(page.locator('.diff-item')).not.toHaveCount(0)

  await page.getByRole('button', { name: '开始审查' }).click()
  await expect(page.getByRole('button', { name: '开始审查' })).toBeEnabled({ timeout: 20_000 })
  await expect(page.locator('.finding')).toHaveCount(0)
})

test('downloaded optimized docx does not keep accepted risk clauses', async ({ page }) => {
  await page.route('**/api/ai/chat', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'force local review fallback' }),
    })
  })

  await page.goto('/')
  await page.getByRole('button', { name: '租房审查', exact: true }).click()
  await page.getByRole('button', { name: '全部采纳' }).click()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '下载优化合同 DOCX' }).click()
  const download = await downloadPromise
  const downloadPath = await download.path()
  const { value: docxText } = await mammoth.extractRawText({ path: downloadPath })

  expect(docxText).toContain('对合同条款理解发生争议的')
  expect(docxText).not.toContain('不得以"未注意"或"不理解"')
  expect(docxText).not.toContain('本合同解释权归甲方')
  expect(docxText).not.toContain('甲方户籍所在地人民法院')
})
