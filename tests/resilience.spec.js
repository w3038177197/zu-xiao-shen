import { expect, test } from '@playwright/test'

test('shared module URL restores the intended workspace', async ({ page }) => {
  await page.goto('/?module=checkin')
  await expect(page.getByRole('heading', { name: '入住当天先验房，退租时才有对比基准' })).toBeVisible()
  await expect(page.locator('.nav-list').getByRole('button', { name: '入住验房', exact: true })).toHaveClass(/active/)
})

test('local-only review does not call remote AI endpoints', async ({ page }) => {
  let aiCalls = 0
  await page.route('**/api/**', async (route) => {
    if (route.request().url().includes('/api/ai/chat')) aiCalls += 1
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'remote disabled' }) })
  })
  await page.goto('/?module=review')
  await page.getByRole('checkbox', { name: '仅本地分析' }).check()
  await page.getByRole('button', { name: '开始审查', exact: true }).click()
  await expect(page.locator('.status-toast')).toContainText('本地规则审查完成')
  expect(aiCalls).toBe(0)
})

test.describe('iOS Safari and Android Chrome narrow viewport regression', () => {
  for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }]) {
    test(`keeps check-in UI within ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto('/?module=checkin')
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
    })
  }
})

test('weak-network AI request can be cancelled and retried', async ({ page }) => {
  await page.route('**/api/ai/chat', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700))
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '网络恢复后的回复' } }] }) })
  })
  await page.goto('/?module=ai')
  await page.getByPlaceholder(/直接问系统 AI/).fill('弱网下怎么处理？')
  await page.getByRole('button', { name: '发送', exact: true }).click()
  await expect(page.getByRole('button', { name: '取消请求' })).toBeVisible()
  await page.getByRole('button', { name: '取消请求' }).click()
  await expect(page.locator('.status-toast')).toContainText('AI 对话已取消')
  await page.getByRole('button', { name: '重试上一条' }).click()
  await expect(page.locator('.ai-chat-bubble.assistant').last()).toContainText('网络恢复后的回复')
})
