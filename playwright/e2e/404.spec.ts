import { test, expect } from '@playwright/test'
import { loginAsStudent } from './fixtures/auth'

/**
 * 404 路由兜底 E2E 测试（F1-F3）
 *
 * Vitest 覆盖：
 *   - NotFoundView.spec.ts 只 mount 组件检查 h1 文本 + goHome mock 被调
 *   - 不测试 :pathMatch(.*)* 路由表兜底是否真的触发
 *   - 不测试 Nginx/OSS 是否先返回了自己的 404
 *   - 不测试已登录态 pathMatch 不挂 requiresAuth 这一真实守卫链路
 *
 * E2E 增量：
 *   - F1 真实浏览器访问不存在路径 → 是 Vue Router 兜底还是 OSS/Nginx 先返回了 404
 *   - F2 真实跳转（地址栏变更 + NewHomeView 真 mount）
 *   - F3 已登录也能进 404（pathMatch 兜底无 requiresAuth）
 */

test('F1: 访问不存在路径 → 渲染 NotFoundView', async ({ page }) => {
  await page.context().clearCookies()
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/foo-bar-baz')

  await expect(page.locator('h1')).toHaveText('404')
  await expect(page.locator('.message')).toContainText('页面未找到')
})

test('F2: 404 页面点击「返回首页」→ 跳转 home', async ({ page }) => {
  await page.goto('/foo-bar-baz')
  await expect(page.locator('h1')).toHaveText('404')

  await page.getByRole('button', { name: /返回首页/ }).click()
  await page.waitForURL('/')

  // 404 消失 = 新页面渲染完成
  await expect(page.locator('h1')).not.toHaveText('404')
})

test('F3: 已登录状态访问不存在路径 → 仍走 404 兜底（不被守卫拦截）', async ({
  page,
}) => {
  await loginAsStudent(page)
  await page.goto('/foo-bar-baz')

  // pathMatch 兜底路由没有 meta.requiresAuth，已登录也能进 404
  await expect(page.locator('h1')).toHaveText('404')
})
