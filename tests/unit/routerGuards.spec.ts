import { describe, it, expect } from 'vitest'
import {
  ADMIN_ROLES,
  STAFF_ROLES,
  normalizeRequiredRoles,
  isRoleAllowed,
  isAdminRole,
  isTeacherRole,
  isStaffRole,
} from '@/utils/roles'
import router from '@/router'

/**
 * 路由角色门禁（P1 越权入口修复的回归）
 *
 * 修复前：/resource-upload 无 role 限制、/answer-query 只判登录，
 * 学生可直接打开管理页；super_admin 又因为只比字符串而进不了 admin 页。
 *
 * 判定逻辑住在 utils/roles（叶子模块），guards 与 services/views 共用它，
 * 所以这里测的是 utils/roles 本身 + 路由表是否真的用上了同一组常量。
 */
describe('角色集合常量', () => {
  it('ADMIN_ROLES 是 super_admin 含 admin 的两个管理身份', () => {
    expect([...ADMIN_ROLES]).toEqual(['admin', 'super_admin'])
  })

  it('STAFF_ROLES 由 ADMIN_ROLES 加 teacher 组成，不是另写一遍', () => {
    expect([...STAFF_ROLES]).toEqual(['teacher', 'admin', 'super_admin'])
    for (const role of ADMIN_ROLES) expect(STAFF_ROLES).toContain(role)
  })
})

describe('isAdminRole / isTeacherRole / isStaffRole', () => {
  it('教师专属判定不含管理员（后端 requireRole("teacher") 就是这个口径）', () => {
    expect(isTeacherRole('teacher')).toBe(true)
    expect(isTeacherRole('admin')).toBe(false)
    expect(isTeacherRole('super_admin')).toBe(false)
    expect(isTeacherRole('student')).toBe(false)
  })

  it('管理侧判定接受 null/undefined 且不放行', () => {
    expect(isAdminRole('admin')).toBe(true)
    expect(isAdminRole('super_admin')).toBe(true)
    expect(isAdminRole('teacher')).toBe(false)
    expect(isAdminRole(undefined)).toBe(false)
    expect(isAdminRole(null)).toBe(false)
  })

  it('教职侧 = teacher + 管理侧，学生不在内', () => {
    expect(isStaffRole('teacher')).toBe(true)
    expect(isStaffRole('admin')).toBe(true)
    expect(isStaffRole('super_admin')).toBe(true)
    expect(isStaffRole('student')).toBe(false)
    expect(isStaffRole(undefined)).toBe(false)
  })
})

describe('normalizeRequiredRoles', () => {
  it('undefined → 空数组（不限制角色）', () => {
    expect(normalizeRequiredRoles(undefined)).toEqual([])
  })

  it('单值统一成数组', () => {
    expect(normalizeRequiredRoles('teacher')).toEqual(['teacher'])
  })

  it('数组按内容返回（副本，不是原引用，避免调用方改到共享常量）', () => {
    expect(normalizeRequiredRoles(['admin', 'super_admin'])).toEqual(['admin', 'super_admin'])
    const shared = ['admin', 'super_admin'] as const
    expect(normalizeRequiredRoles(shared)).not.toBe(shared)
  })
})

describe('isRoleAllowed', () => {
  it('未声明 role 的路由一律放行', () => {
    expect(isRoleAllowed(undefined, 'student')).toBe(true)
    expect(isRoleAllowed([], undefined)).toBe(true)
  })

  it('角色命中集合才放行', () => {
    const adminOnly = ['admin', 'super_admin'] as const
    expect(isRoleAllowed(adminOnly, 'super_admin')).toBe(true)
    expect(isRoleAllowed(adminOnly, 'admin')).toBe(true)
    expect(isRoleAllowed(adminOnly, 'teacher')).toBe(false)
    expect(isRoleAllowed(adminOnly, 'student')).toBe(false)
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

  it('受限路由引用 utils/roles 的集合本身，不在路由表里重打角色名', () => {
    // 用 toBe（同一引用）而不是 toEqual：这才证明路由门禁和页面内授权
    // 读的是同一份常量，而不是两份恰好相等的数组。
    expect(routeByPath('/admin-console')?.meta.role).toBe(ADMIN_ROLES)
    expect(routeByPath('/admin-dashboard')?.meta.role).toBe(ADMIN_ROLES)
    expect(routeByPath('/resource-upload')?.meta.role).toBe(STAFF_ROLES)
    expect(routeByPath('/answer-query')?.meta.role).toBe(STAFF_ROLES)
  })

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
