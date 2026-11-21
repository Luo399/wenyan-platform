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

  // RuleVideoView 渲染：检查 <video> 元素存在且 src 指向正确的 OSS 资源
  // （video 元素带 hidden 属性但 src 正确 → 说明组件 mount + 数据加载成功，
  //  不用 toBeVisible()——playwright 会把 hidden 视为不可见）
  await expect(page.locator('video')).toBeAttached({ timeout: 10_000 })
  const videoSrc = await page.locator('video').getAttribute('src')
  expect(videoSrc).toContain('video/WEN_01')

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
  // 守卫角色检查会 next({ path: '/' })，直接等 URL 变化（不等 load 事件，那个要 30s）
  await Promise.all([
    page.waitForURL('/'),
    page.goto('/admin-console', { waitUntil: 'domcontentloaded' }),
  ])

  // 首页渲染完成的标识（NewHomeView 的根元素）
  await expect(page.locator('.new-home')).toBeVisible({ timeout: 10_000 })
})
