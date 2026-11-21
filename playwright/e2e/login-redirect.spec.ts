import { test, expect } from '@playwright/test'

/**
 * 登录 + redirect 闭环 E2E 测试（R1-R3）
 *
 * Vitest 覆盖：
 *   - quiz-full-flow.spec.ts mock 了 router.push('/rules/1') 和 authStore.login()
 *   - 不测试完整浏览器链路（被重定向 → UI 登录 → 跳回原目标）
 *   - 不测试 redirect 参数在真实浏览器 URL 编码/解码中的行为
 *
 * E2E 增量：
 *   - R1 真实闭环（地址栏 → 登录页 → UI 表单提交 → 跳回）
 *   - R2 特殊字符 redirect 真实编码/解码
 *   - R3 无 redirect 时默认跳转
 *
 * 注意：R1 会真实调用 /api/auth/student/login（测试环境后端），
 * 如果后端不可用，测试会失败——此时可以临时改成用 loginAsStudent fixture 直接注入 token。
 */

test('R1: 完整登录 + redirect 闭环', async ({ page }) => {
  await page.context().clearCookies()
  await page.addInitScript(() => localStorage.clear())

  // 1. 直接访问受保护页面 → beforeEach 重定向到登录页，带 redirect 参数
  await page.goto('/rules/1')
  await page.waitForURL(/\/student-login\?redirect=/)

  // 2. 真实 UI 登录（input + form submit）
  await page.locator('#studentId').fill('2024001')
  await page.locator('#password').fill('valid-password')
  await page.locator('form').submit()

  // 3. 登录成功 → sanitizeRedirect 解码 → router.push 回原目标
  await page.waitForURL('/rules/1', { timeout: 15_000 })

  // 4. localStorage 真存了 token（authStore.login 成功写入）
  const token = await page.evaluate(() => localStorage.getItem('auth_token'))
  expect(token).toBeTruthy()
})

test('R2: redirect 参数带特殊字符 → 登录后正确解码跳回', async ({ page }) => {
  await page.context().clearCookies()
  await page.addInitScript(() => localStorage.clear())

  // 直接构造带特殊字符的 redirect URL（真实守卫也会这么生成）
  const target = encodeURIComponent('/rules/1?tab=detail')
  await page.goto(`/student-login?redirect=${target}`)

  await page.locator('#studentId').fill('2024001')
  await page.locator('#password').fill('valid-password')
  await page.locator('form').submit()

  // 登录后 authStore.sanitizeRedirect 应该正确解码
  await page.waitForURL(/\/rules\/1/, { timeout: 15_000 })

  // 最终 URL 不是双编码态（没有残留 %2F）
  const url = page.url()
  expect(url).not.toContain('%2F')
})

test('R3: 登录页无 redirect 参数 → 登录成功去默认目标', async ({ page }) => {
  await page.context().clearCookies()
  await page.addInitScript(() => localStorage.clear())

  // 直接访问登录页，不带 redirect
  await page.goto('/student-login')

  await page.locator('#studentId').fill('2024001')
  await page.locator('#password').fill('valid-password')
  await page.locator('form').submit()

  // 没有 redirect → authStore.login() 默认 push('/rules/1')
  await page.waitForURL('/rules/1', { timeout: 15_000 })
})
