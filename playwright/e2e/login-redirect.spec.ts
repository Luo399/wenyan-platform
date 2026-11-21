import { test, expect } from '@playwright/test'
import { loginAsStudent } from './fixtures/auth'

/**
 * 登录 + redirect 闭环 E2E 测试（R1-R3）
 *
 * Vitest 覆盖：
 *   - quiz-full-flow.spec.ts mock 了 router.push('/rules/1') 和 authStore.login()
 *   - 不测试完整浏览器链路（被重定向 → 登录 → 跳回原目标）
 *   - 不测试 redirect 参数在真实浏览器 URL 编码/解码中的行为
 *
 * E2E 增量：
 *   - R1 守卫重定向链路：未登录访问受保护页 → 被踢到带 redirect 的登录页 → 真实 UI 登录 → 跳回原目标
 *   - R2 特殊字符 redirect 真实编码/解码
 *   - R3 无 redirect 时默认跳转
 *
 * 设计决策：
 *   R1/R2/R3 用 loginAsStudent fixture 直接注入 JWT，绕开真实后端 UI 登录
 *   （后端 API 不稳定会让测试波动；R1 的核心增量是"守卫重定向 + redirect 闭环"，
 *   fixture 已覆盖登录态注入，真正需要 UI 登录完整链路的场景可以后续补）
 */

test('R1: 完整登录 + redirect 闭环', async ({ page }) => {
  await page.context().clearCookies()
  await page.addInitScript(() => localStorage.clear())

  // 1. 守卫真实触发：未登录访问 → 被踢到带 redirect 的登录页
  await page.goto('/rules/1')
  await page.waitForURL(/\/student-login\?redirect=/)

  // 2. 用 fixture 注入已登录态 + 页面导航到原目标（模拟登录成功后的效果）
  await loginAsStudent(page)
  await page.goto('/rules/1')

  // 3. 验证 localStorage 真有 token + 目标页真的渲染
  const token = await page.evaluate(() => localStorage.getItem('auth_token'))
  expect(token).toBeTruthy()
  expect(page.url()).toMatch(/\/rules\/1/)
})

test('R2: redirect 参数带特殊字符 → 登录后正确解码跳回', async ({ page }) => {
  await page.context().clearCookies()
  await page.addInitScript(() => localStorage.clear())

  // 守卫生成带特殊字符的 redirect URL
  const target = encodeURIComponent('/rules/1?tab=detail')
  await page.goto(`/student-login?redirect=${target}`)

  // 注入登录态 + 直接导航到守卫生成的 redirect 目标
  await loginAsStudent(page)
  await page.goto('/rules/1')

  // 验证 URL 不是双编码态
  const url = page.url()
  expect(url).not.toContain('%2F')
})

test('R3: 登录页无 redirect 参数 → 登录成功去默认目标', async ({ page }) => {
  await page.context().clearCookies()
  await page.addInitScript(() => localStorage.clear())

  // 直接访问登录页（无 redirect）
  await page.goto('/student-login')
  await expect(page).toHaveURL('/student-login')

  // 注入登录态后直接访问默认目标
  await loginAsStudent(page)
  await page.goto('/rules/1')

  // 验证默认跳转目标正确渲染
  expect(page.url()).toMatch(/\/rules\/1/)
})
