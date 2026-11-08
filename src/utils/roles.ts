/**
 * 角色集合与角色判定
 *
 * 叶子模块：只依赖 `@/types/auth` 的类型，不引入 store、router、vue-router。
 * 因此 router/index.ts（路由表）、router/guards.ts（导航守卫）、
 * services/*（接口分派）、views/*（页面内授权）都能共用同一份口径。
 *
 * 为什么要有这个文件：「哪些角色算管理侧」原本是后端契约的一部分
 * （adminAuth 同时放 admin 与 super_admin），此前在四个地方各写一遍，
 * 靠注释提醒「两侧口径一致」。后端加一个角色时，改一处不够，
 * 得先 grep 全仓。收敛到这里后，路由 meta 与页面内判定读同一组常量。
 */

import type { Role } from '@/types/auth'

/**
 * 管理侧角色
 *
 * 后端 adminAuth 同时接受 admin 与 super_admin，
 * super_admin 的权限包含 admin，所以判定必须按集合而非字符串相等。
 */
export const ADMIN_ROLES: readonly Role[] = ['admin', 'super_admin']

/**
 * 教职侧角色（非学生）
 *
 * 对应后端 requireRole(['teacher', 'admin', 'super_admin']) 的接口，
 * 如 /api/answers/*、/api/upload/resource。
 */
export const STAFF_ROLES: readonly Role[] = ['teacher', ...ADMIN_ROLES]

/**
 * 把 role 归一化成数组（单值写起来更顺手，判定时统一按集合看）
 */
export function normalizeRequiredRoles(role: Role | readonly Role[] | undefined): Role[] {
  if (role === undefined) return []
  // 用 typeof 而不是 Array.isArray 分流：Role 是字符串联合，
  // Array.isArray 对 readonly Role[] 收窄不干净，会把数组分支留在联合里。
  if (typeof role === 'string') return [role]
  return [...role]
}

/**
 * 当前角色是否命中要求的角色集合
 *
 * 未声明 role 一律放行；未登录（current 为空）访问受限目标一律拒绝。
 * 这是路由 meta.role 与页面内授权共用的唯一判定入口。
 */
export function isRoleAllowed(
  required: Role | readonly Role[] | undefined,
  current?: Role,
): boolean {
  const roles = normalizeRequiredRoles(required)
  if (roles.length === 0) return true
  return current !== undefined && roles.includes(current)
}

/** 是否管理侧角色（admin / super_admin） */
export function isAdminRole(role?: Role | null): boolean {
  return role != null && isRoleAllowed(ADMIN_ROLES, role)
}

/** 是否教师角色（后端教师专属接口只认 teacher，管理员不算） */
export function isTeacherRole(role?: Role | null): boolean {
  return role === 'teacher'
}

/** 是否教职侧角色（teacher / admin / super_admin，即非学生） */
export function isStaffRole(role?: Role | null): boolean {
  return role != null && isRoleAllowed(STAFF_ROLES, role)
}
