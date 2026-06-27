import { expect, test } from '@playwright/test'
import { Buffer } from 'node:buffer'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
} from 'docx'
import mammoth from 'mammoth'

async function createDocxBuffer(lines) {
  const document = new Document({
    sections: [
      {
        children: lines.map((line) =>
          new Paragraph({
            children: [new TextRun(line)],
          }),
        ),
      },
    ],
  })

  return Buffer.from(await Packer.toBuffer(document))
}

function escapeTestHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

async function createPdfBuffer(page, lines) {
  await page.setContent(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            font-family: Arial, sans-serif;
            font-size: 18px;
            line-height: 1.6;
            padding: 48px;
          }
        </style>
      </head>
      <body>
        ${lines.map((line) => `<p>${escapeTestHtml(line)}</p>`).join('')}
      </body>
    </html>
  `)

  return Buffer.from(await page.pdf({ format: 'A4', printBackground: true }))
}

test('home shows the current product overview and guide modal', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: '租小审使用总览' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '租小审：租房全流程风控助手' })).toBeVisible()

  const moduleEntries = page.locator('.proposal-focus-item')
  await expect(moduleEntries).toHaveCount(4)
  await expect(moduleEntries).toContainText(['补贴匹配', '租房审查', '入住验房', '退租证据包'])

  await expect(page.locator('.nav-list').getByRole('button', { name: '首页', exact: true })).toHaveClass(/active/)
  await expect(page.locator('.nav-list').getByRole('button', { name: '补贴匹配', exact: true })).toBeVisible()
  await expect(page.locator('.nav-list').getByRole('button', { name: '租房审查', exact: true })).toBeVisible()
  await expect(page.locator('.nav-list').getByRole('button', { name: '入住验房', exact: true })).toBeVisible()
  await expect(page.locator('.nav-list').getByRole('button', { name: '退租证据包', exact: true })).toBeVisible()

  await page.getByRole('button', { name: /查看避坑流程/ }).click()
  const guide = page.getByRole('dialog', { name: '租小审避坑流程' })
  await expect(guide).toBeVisible()
  await expect(guide).toContainText('给正在使用租小审的你')
  await expect(guide).toContainText('从首页先判断问题类型')
  await expect(guide.getByRole('button', { name: /租房审查/ })).toBeVisible()

  await page.getByRole('button', { name: '关闭避坑流程教程' }).click()
  await expect(guide).toHaveCount(0)
})

test('system ai assistant reads app context and falls back cleanly', async ({ page }) => {
  await page.route('**/api/ai/chat', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'force local ai fallback' }),
    })
  })

  await page.goto('/')
  await page.getByRole('button', { name: '系统 AI 助手' }).click()

  await expect(page.getByRole('heading', { name: '租小审系统 AI' })).toBeVisible()
  await expect(page.getByText('后端代理：/api/ai/chat')).toBeVisible()
  await expect(page.getByText(/回复技能：\d+ 个/)).toBeVisible()
  await expect(page.getByText('我是租小审系统 AI')).toBeVisible()

  await page.getByPlaceholder(/直接问系统 AI/).fill('结合当前页面，我下一步应该先处理什么？')
  await page.getByRole('button', { name: '发送', exact: true }).click()

  await expect(page.getByText(/模型暂时不可用，已切换本地知识库兜底/)).toBeVisible()
  await expect(page.locator('.ai-chat-bubble.assistant').last()).toContainText('结论')
  await expect(page.locator('.ai-chat-bubble.assistant').last()).toContainText('依据')
})

test('rental review can run with local fallback and accept suggestions', async ({ page }) => {
  await page.route('**/api/ai/chat', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'force local review fallback' }),
    })
  })

  await page.goto('/')
  await page.locator('.nav-list').getByRole('button', { name: '租房审查', exact: true }).click()

  await expect(page.getByRole('heading', { name: /租房签字前/ })).toBeVisible()
  await expect(page.getByRole('textbox', { name: /在这里粘贴租房合同正文/ })).toContainText('自动续期12个月')
  await expect(page.locator('.finding')).not.toHaveCount(0)

  await page.getByRole('button', { name: '开始审查' }).click()
  await expect(page.getByRole('button', { name: '开始审查' })).toBeEnabled({ timeout: 20_000 })
  await expect(page.getByText('AI 审查失败，已自动切换为本地规则结果')).toBeVisible()

  await page.getByRole('button', { name: '全部采纳' }).click()
  await expect(page.locator('.status-toast')).toContainText(/已采纳 \d+ 条/)
  await expect(page.getByText('修订版合同草案')).toBeVisible()
  await expect(page.locator('.finding')).toHaveCount(0)
})

test('dirty shared-rental clauses surface pet sublet decoration and deposit risks', async ({ page }) => {
  await page.route('**/api/ai/chat', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'force local review fallback' }),
    })
  })

  await page.goto('/')
  await page.locator('.nav-list').getByRole('button', { name: '租房审查', exact: true }).click()

  const editor = page.getByRole('textbox', { name: /在这里粘贴租房合同正文/ })
  await editor.fill(`房屋租赁合同
甲方将次卧出租给乙方居住，月租金2600元，押金2600元。
退还时甲方可扣除以下费用：房屋维修费、全屋保洁费、墙面修补粉刷费、家具家电折旧补偿，以上费用从押金中扣除。
乙方不得饲养宠物，如有违反甲方有权立即解除合同并没收押金。
乙方不得以任何形式转租、转借或与他人合住，否则视为严重违约。
乙方不得对房屋进行任何形式的装修改造，包括但不限于墙面打孔、贴墙纸、更换家具位置。`)

  await expect(page.locator('.finding').filter({ hasText: '保洁维修扣款缺少凭证边界' })).toBeVisible()
  await expect(page.locator('.finding').filter({ hasText: '家具家电折旧转嫁给租客' })).toBeVisible()
  await expect(page.locator('.finding').filter({ hasText: '宠物违约直接没收押金' })).toBeVisible()
  await expect(page.locator('.finding').filter({ hasText: '转租合住限制过宽' })).toBeVisible()
  await expect(page.locator('.finding').filter({ hasText: '装修改造限制过细' })).toBeVisible()

  await page.getByRole('button', { name: '开始审查' }).click()
  await expect(page.getByRole('button', { name: '开始审查' })).toBeEnabled({ timeout: 20_000 })
  await expect(page.getByText('AI 审查失败，已自动切换为本地规则结果')).toBeVisible()
})

test('contract upload imports txt docx and image ocr into review editor', async ({ page }) => {
  const pdfBuffer = await createPdfBuffer(page, [
    'PDF imported rental contract',
    'Deposit 4000 CNY, landlord may keep the full deposit without proof.',
  ])

  await page.route('**/api/ai/chat', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'force local review fallback' }),
    })
  })

  await page.route('**/api/ocr/image', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        mode: 'offline-tesseract',
        confidence: 62,
        text: '图片识别租房合同\n月租金2500元，押金2500元，退租时甲方可自行认定扣款。',
      }),
    })
  })

  await page.goto('/')
  await page.locator('.nav-list').getByRole('button', { name: '租房审查', exact: true }).click()
  const editor = page.getByRole('textbox', { name: /在这里粘贴租房合同正文/ })
  const upload = page.getByLabel('上传合同')

  await upload.setInputFiles({
    name: 'sample-rental-contract.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('TXT导入租房合同\n月租金2000元，押金2000元。', 'utf8'),
  })
  await expect(page.locator('.status-toast')).toContainText('已导入文本文件：sample-rental-contract.txt')
  await expect(page.getByLabel('已导入合同状态')).toContainText('已导入：sample-rental-contract.txt')
  await expect(page.getByLabel('已导入合同状态')).toContainText('来源TXT / MD')
  await expect(page.getByRole('button', { name: '开始审查这份合同' })).toBeVisible()
  await expect(editor).toHaveValue(/TXT导入租房合同/)

  const docxBuffer = await createDocxBuffer(['DOCX导入租房合同', '押金3000元，甲方应提供扣款票据。'])
  await upload.setInputFiles({
    name: 'sample-rental-contract.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: docxBuffer,
  })
  await expect(page.locator('.status-toast')).toContainText('已导入Word 合同：sample-rental-contract.docx')
  await expect(editor).toHaveValue(/DOCX导入租房合同/)

  await upload.setInputFiles({
    name: 'sample-rental-contract.pdf',
    mimeType: 'application/pdf',
    buffer: pdfBuffer,
  })
  await expect(page.locator('.status-toast')).toContainText('已导入PDF 合同：sample-rental-contract.pdf')
  await expect(page.getByLabel('已导入合同状态')).toContainText('来源PDF')
  await expect(editor).toHaveValue(/PDF imported rental contract/)

  await upload.setInputFiles({
    name: 'sample-rental-contract.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lwB5mwAAAABJRU5ErkJggg==', 'base64'),
  })
  await expect(page.locator('.status-toast')).toContainText('已导入图片 OCR 合同')
  await expect(page.getByLabel('已导入合同状态')).toContainText('OCR 置信度62%')
  await expect(page.getByText('OCR 识别结果需要人工核对')).toBeVisible()
  await expect(page.getByText('请先对照原图检查金额、日期、押金和解除条款')).toBeVisible()
  await expect(editor).toHaveValue(/图片识别租房合同/)

  await page.getByRole('button', { name: '开始审查这份合同' }).click()
  await expect(page.getByRole('button', { name: '开始审查这份合同' })).toBeEnabled({ timeout: 20_000 })
  await expect(page.getByText('AI 审查失败，已自动切换为本地规则结果')).toBeVisible()
})

test('checkin inspection generates a targeted move-in report with photos', async ({ page }) => {
  await page.goto('/')

  await page.locator('.nav-list').getByRole('button', { name: '入住验房', exact: true }).click()
  await expect(page.locator('.checkin-inspection').getByRole('heading', { name: /入住当天先验房/ })).toBeVisible()

  await page.locator('.checkin-room-tabs').getByRole('button', { name: /水电燃气/ }).click()
  const meterItem = page.locator('.checkin-item').filter({ hasText: '水电燃气' })
  await meterItem.getByRole('button', { name: '有瑕疵' }).click()
  await expect(meterItem.getByPlaceholder(/水表读数、电表读数/)).toBeVisible()
  await expect(meterItem.getByText('拍清表盘读数')).toBeVisible()
  await expect(meterItem.getByText('拍阀门/插座状态')).toBeVisible()

  await meterItem.getByPlaceholder(/补充备注/).fill('燃气表读数123，灶台点火不稳定')
  await meterItem.locator('input[type="file"]').setInputFiles({
    name: 'meter-photo.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lwB5mwAAAABJRU5ErkJggg==', 'base64'),
  })
  await expect(page.getByText(/已上传 1 张水电燃气-水电燃气照片/)).toBeVisible()
  await expect(meterItem.locator('.checkin-inline-photos figure')).toHaveCount(1)

  await page.getByRole('button', { name: /生成验房报告/ }).first().click()

  await expect(page.getByText(/入住验房报告已生成/)).toBeVisible()
  await expect(page.locator('.checkin-report-summary').getByText('1 处', { exact: true })).toBeVisible()
  await expect(page.locator('.checkin-report-summary')).toContainText('疑似瑕疵已记录')
  await expect(page.locator('.checkin-report-summary')).toContainText('已上传 1 张照片')
  await expect(page.locator('.checkin-defect-list')).toContainText('照片 1 张')
})

test('report exports download as word docx files', async ({ page }) => {
  await page.goto('/')

  await page.locator('.nav-list').getByRole('button', { name: '入住验房', exact: true }).click()
  await page.getByRole('button', { name: /生成验房报告/ }).first().click()
  const checkinDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出 Word 报告' }).click()
  const checkinDownload = await checkinDownloadPromise
  expect(checkinDownload.suggestedFilename()).toMatch(/入住验房报告.*\.docx$/)
  const checkinPath = await checkinDownload.path()
  const { value: checkinText } = await mammoth.extractRawText({ path: checkinPath })
  expect(checkinText).toContain('租小审入住验房报告')

  await page.locator('.nav-list').getByRole('button', { name: '退租证据包', exact: true }).click()
  const evidenceDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出 Word 证据包' }).click()
  const evidenceDownload = await evidenceDownloadPromise
  expect(evidenceDownload.suggestedFilename()).toMatch(/退租证据包.*\.docx$/)
  const evidencePath = await evidenceDownload.path()
  const { value: evidenceText } = await mammoth.extractRawText({ path: evidencePath })
  expect(evidenceText).toContain('租小审 退租证据包摘要')

  await page.locator('.nav-list').getByRole('button', { name: '租房审查', exact: true }).click()
  const reviewDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出 Word 报告' }).click()
  const reviewDownload = await reviewDownloadPromise
  expect(reviewDownload.suggestedFilename()).toMatch(/解读报告.*\.docx$/)
  const reviewPath = await reviewDownload.path()
  const { value: reviewText } = await mammoth.extractRawText({ path: reviewPath })
  expect(reviewText).toContain('租小审 AI 租房合同解读报告')
})

test('subsidy matcher ranks selected city policy clues only', async ({ page }) => {
  await page.goto('/')

  await page.locator('.nav-list').getByRole('button', { name: '补贴匹配', exact: true }).click()
  await expect(page.locator('.nav-list').getByRole('button', { name: '补贴匹配', exact: true })).toHaveClass(/active/, { timeout: 10_000 })
  await expect(page.getByText('毕业生租房补贴线索匹配')).toBeVisible({ timeout: 10_000 })

  await page.getByLabel('城市').selectOption('北京')
  await page.getByRole('button', { name: /匹配补贴线索/ }).click()
  await expect(page.getByText(/已匹配北京\d+条官方补贴\/安居线索/)).toBeVisible()
  await expect(page.locator('.subsidy-result-grid')).toContainText('北京')

  await page.getByLabel('城市').selectOption('杭州')
  await page.getByRole('button', { name: /匹配补贴线索/ }).click()
  await expect(page.getByText(/已匹配杭州\d+条官方补贴\/安居线索/)).toBeVisible()
  await expect(page.locator('.subsidy-result-grid .subsidy-policy-card')).toHaveCount(1)
  await expect(page.locator('.subsidy-result-grid')).toContainText('杭州')
  await expect(page.locator('.subsidy-result-grid')).not.toContainText('北京')
  await expect(page.locator('.subsidy-result-grid')).not.toContainText('广州')
})
