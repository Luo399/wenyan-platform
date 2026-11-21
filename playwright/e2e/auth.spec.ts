import { test, expect } from '@playwright/test'
import { loginAsStudent, setExpiredToken } from './fixtures/auth'

/**
 * 路由守卫 + 鉴权流 E2E 测试（A1-A4）
 *
 * Vitest 覆盖：
 *   - routerGuards.spec.ts 测 utils/roles 纯函数 + 路由表 meta.role 配置
 *   - 不测试 beforeEach 真实触发、redirect 参数传递、token 过期 auto-logout
 *
 * E2E 增量：
 *   - A1 真实地址栏 URL 变更 + redirect 参数进入 URL
 *   - A2 beforeEnter 守卫真的触发 + 真实 DOM 渲染
 *   - A3 localStorage token 真被清掉（authStore.logout 副作用）
 *   - A4 角色门禁真实 beforeEnter 链路
 */

test('A1: 未登录访问 /rules/1 → 重定向到 /student-login?redirect=/rules/1', async ({
  page,
}) => {
  // 确保未登录态
  await page.context().clearCookies()
  await page.addInitScript(() => {
    localStorage.clear()
  })

  await page.goto('/rules/1')
  // 等守卫执行完跳转（beforeEach → next({ name: 'student-login', query: { redirect } })）
  await page.waitForURL(/\/student-login\?redirect=/)

  const url = page.url()
  expect(url).toContain('/student-login')
  expect(new URL(url).searchParams.get('redirect')).toBe('/rules/1')
})

test('A2: 已登录访问 /rules/1 → 正常渲染（video 元素存在）', async ({ page }) => {
  await loginAsStudent(page)
  await page.goto('/rules/1')

  // RuleVideoView 渲染后有 <video> 元素（10s timeout 等数据加载）
  await expect(page.locator('video')).toBeVisible({ timeout: 10_000 })

  // 地址栏不变——没有被守卫踢走
  expect(page.url()).toMatch(/\/rules\/1/)
})

test('A3: token 过期访问 /rules/1 → 自动登出 + 重定向登录页', async ({ page }) => {
  await page.context().clearCookies()
  await setExpiredToken(page)

  await page.goto('/rules/1')
  // 等 beforeEach 检测到 isTokenExpired → authStore.logout() → 重定向
  await page.waitForURL(/\/student-login/)

  // 真实副作用：localStorage token 被清掉
  const tokenAfter = await page.evaluate(() => localStorage.getItem('auth_token'))
  expect(tokenAfter).toBeNull()
})

test('A4: 学生访问 /admin-console → 回首页（角色门禁）', async ({ page }) => {
  await loginAsStudent(page)
  await page.goto('/admin-console')

  // requiresAuth 通过 → role 检查 student 不在 ADMIN_ROLES → beforeEach next({ path: '/' })
  await page.waitForURL('/')

  // 首页渲染完成的标识（NewHomeView 有篇目列表）
  const homeIndicators = page.locator(
    '.article-list, .poem-list, [class*="article"], [class*="home"]',
  )
  await expect(homeIndicators.first()).toBeVisible({ timeout: 10_000 })
})
