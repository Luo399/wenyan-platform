import { describe, it, expect } from 'vitest'
import { normalizeRequiredRoles, isRoleAllowed } from '@/router/guards'
import router from '@/router'

/**
 * 路由角色门禁（P1 越权入口修复的回归）
 *
 * 修复前：/resource-upload 无 role 限制、/answer-query 只判登录，
 * 学生可直接打开管理页；super_admin 又因为只比字符串而进不了 admin 页。
 */
describe('normalizeRequiredRoles', () => {
  it('undefined → 空数组（不限制角色）', () => {
    expect(normalizeRequiredRoles(undefined)).toEqual([])
  })

  it('单值统一成数组', () => {
    expect(normalizeRequiredRoles('teacher')).toEqual(['teacher'])
  })

  it('数组原样返回', () => {
    expect(normalizeRequiredRoles(['admin', 'super_admin'])).toEqual(['admin', 'super_admin'])
  })
})

describe('isRoleAllowed', () => {
  it('未声明 role 的路由一律放行', () => {
    expect(isRoleAllowed(undefined, 'student')).toBe(true)
    expect(isRoleAllowed([], undefined)).toBe(true)
  })

  it('角色命中集合才放行', () => {
    const adminOnly = ['admin', 'super_admin'] as const
    expect(isRoleAllowed([...adminOnly], 'super_admin')).toBe(true)
    expect(isRoleAllowed([...adminOnly], 'admin')).toBe(true)
    expect(isRoleAllowed([...adminOnly], 'teacher')).toBe(false)
    expect(isRoleAllowed([...adminOnly], 'student')).toBe(false)
  })

  it('单值 role 也按集合判定', () => {
    expect(isRoleAllowed('teacher', 'teacher')).toBe(true)
    expect(isRoleAllowed('teacher', 'admin')).toBe(false)
  })

  it('未登录（current 为空）访问受限路由 → 拒绝', () => {
    expect(isRoleAllowed('teacher', undefined)).toBe(false)
  })
})

describe('路由表 meta.role 配置', () => {
  const routeByPath = (path: string) => router.getRoutes().find((r) => r.path === path)

  it('/resource-upload 只允许教师/管理员（此前学生可进入上传工具）', () => {
    const role = routeByPath('/resource-upload')?.meta.role
    expect(normalizeRequiredRoles(role as never)).toEqual(
      expect.arrayContaining(['teacher', 'admin', 'super_admin']),
    )
    expect(isRoleAllowed(role as never, 'student')).toBe(false)
  })

  it('/answer-query 拒绝学生', () => {
    const role = routeByPath('/answer-query')?.meta.role
    expect(isRoleAllowed(role as never, 'student')).toBe(false)
    expect(isRoleAllowed(role as never, 'teacher')).toBe(true)
  })

  it('/admin-console 与 /admin-dashboard 只给管理员，且 super_admin 不被误伤', () => {
    for (const path of ['/admin-console', '/admin-dashboard']) {
      const role = routeByPath(path)?.meta.role
      expect(isRoleAllowed(role as never, 'admin')).toBe(true)
      expect(isRoleAllowed(role as never, 'super_admin')).toBe(true)
      expect(isRoleAllowed(role as never, 'teacher')).toBe(false)
    }
  })

  it('教师页面不接受管理员身份（避免跨角色看到不适用页面）', () => {
    const role = routeByPath('/teacher-dashboard')?.meta.role
    expect(isRoleAllowed(role as never, 'teacher')).toBe(true)
    expect(isRoleAllowed(role as never, 'admin')).toBe(false)
  })

  it('学习流程页面只要求登录，不额外限制角色', () => {
    const role = routeByPath('/detail/:id')?.meta.role
    expect(role).toBeUndefined()
    expect(isRoleAllowed(role as never, 'student')).toBe(true)
  })
})
