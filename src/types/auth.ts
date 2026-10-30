/**
 * 账号与登录态的类型契约
 *
 * 放在 types 层而不是 stores/auth.ts 里的原因：
 * `utils/localStorage.ts` 需要按 `User` 的形状读写持久化登录态，
 * 而 `stores/auth.ts` 又必须用 localStorage 封装来恢复登录态——
 * 类型定义留在 store 里，utils → stores 就有一条（虽然是 type-only 的）反向边。
 * 契约下沉到叶子模块后，两个方向都只指向 types。
 */

/**
 * 平台角色
 *
 * 取值与后端三张账号表的 role 列对齐：students 恒为 'student'，
 * teachers 恒为 'teacher'，admins 可能是 'admin' 或 'super_admin'
 * （见 backend/scripts/migrate_auth.js 与 database.js 的种子数据）。
 * super_admin 早先被漏掉，导致超管登录后过不了角色判断。
 */
export type Role = 'student' | 'teacher' | 'admin' | 'super_admin'

/**
 * 用户信息接口
 */
export interface User {
  id: string
  username: string
  studentId: string
  role: Role
}
