import { expect, test } from '@playwright/test'

test('proposal module cards enter target module from its top', async ({ page }) => {
  await page.goto('/')

  await page.locator('.proposal-focus-item').filter({ hasText: '补贴匹配' }).click()

  await expect(page.getByRole('button', { name: '补贴匹配', exact: true })).toHaveClass(/active/)
  const topbarHeading = page.getByRole('heading', { name: '毕业生租房补贴，先把线索筛出来' })
  await expect(topbarHeading).toBeInViewport()
  await expect(page.getByRole('heading', { name: '毕业生租房补贴线索匹配' })).toBeInViewport()

  const headingTop = await topbarHeading.evaluate((element) => element.getBoundingClientRect().top)
  const stickyBottom = await page.evaluate(() => {
    const stickySelectors = ['.sidebar', '.announcement-strip']
    return stickySelectors.reduce((bottom, selector) => {
      const element = document.querySelector(selector)
      if (!element) return bottom

      const style = window.getComputedStyle(element)
      if (style.display === 'none' || style.visibility === 'hidden') return bottom

      const rect = element.getBoundingClientRect()
      return Math.max(bottom, rect.bottom)
    }, 0)
  })

  expect(headingTop).toBeGreaterThanOrEqual(stickyBottom)
})
