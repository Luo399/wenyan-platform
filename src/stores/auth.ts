/**
 * 用户认证状态管理
 *
 * 功能：
 * - 管理用户登录状态
 * - 处理 JWT token 的存储和验证
 * - 提供登录、登出、刷新令牌等方法
 * - 支持从 localStorage 恢复登录状态
 *
 * R34: 持久化统一走 utils/localStorage.ts（getAuthData/setAuthData/clearAuthData）
 * R35: isTokenExpired 解码 JWT 时全路径 try/catch，payload.exp 不存在视为已过期
 * R36: 移除 response.data! 非空断言，改用 ?. + 显式 null 检查
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { post } from '@/utils/api'
import { debugLog, debugError } from '@/utils/debug'
import { getAuthData, setAuthData, clearAuthData } from '@/utils/localStorage'

/**
 * 用户信息接口
 */
export interface User {
  id: string
  username: string
  studentId: string
  role: 'student' | 'teacher' | 'admin'
}

/** R35: 后端返回 user 的原始字段（下划线命名） */
interface RawBackendUser {
  id: string
  username?: string
  student_name?: string
  student_id?: string
  studentId?: string
  role?: 'student' | 'teacher' | 'admin'
}

/** R91: 登录/刷新令牌响应的数据结构（替代 unknown 默认推断，恢复类型安全） */
interface AuthTokenResponse {
  token: string
  user?: RawBackendUser
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const isLoggedIn = computed(() => !!token.value && !!user.value)

  /**
   * 初始化认证状态
   * 从 localStorage 恢复用户信息和 token
   */
  function initialize() {
    // R34: 改用 getAuthData 封装
    const saved = getAuthData()
    if (saved.token && saved.user) {
      token.value = saved.token
      user.value = saved.user
      error.value = null
      debugLog('[AuthStore] 从 localStorage 恢复登录状态')
      return
    }

    if (saved.token || saved.user) {
      // token 或 user 其中一个缺失 → 登录态不完整，清理
      error.value = '登录状态已过期，请重新登录'
      clearAuthDataInternal()
    }
  }

  /**
   * 登录（正式端点 /api/auth/student/login）
   * R77: 拆分为 requestLogin + applyLoginResult，保持单一职责
   */
  async function login(studentId: string, password: string, studentName?: string): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const response = await post<AuthTokenResponse>('/api/auth/student/login', {
        student_id: studentId,
        password,
      })

      if (!response.success) {
        throw new Error(response.message || '登录失败')
      }

      applyLoginResult(response.data, studentId, studentName)
      debugLog('[AuthStore] 登录成功:', user.value)
    } catch (err) {
      error.value = err instanceof Error ? err.message : '登录失败，请重试'
      clearAuthDataInternal()
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * R77: 校验登录响应并写入 store + 持久化
   */
  function applyLoginResult(
    result: AuthTokenResponse | undefined,
    studentId: string,
    studentName?: string,
  ): void {
    if (!result?.token) {
      throw new Error('登录响应缺少 token')
    }

    const rawUser = result.user as RawBackendUser | undefined
    if (!rawUser) {
      throw new Error('登录成功但未返回用户信息')
    }

    token.value = result.token as string
    user.value = {
      id: rawUser.id,
      username: rawUser.username || rawUser.student_name || studentName || studentId,
      studentId: rawUser.student_id || rawUser.studentId || studentId,
      role: rawUser.role || 'student',
    }
    setAuthData(token.value, user.value)
  }

  /**
   * 登出
   */
  function logout(): void {
    clearAuthDataInternal()
    debugLog('[AuthStore] 已登出')
  }

  /**
   * 刷新令牌
   */
  async function refreshToken(): Promise<void> {
    if (!token.value) {
      throw new Error('没有可用的令牌')
    }

    try {
      const response = await post<AuthTokenResponse>('/api/auth/refresh')

      if (!response.success) {
        throw new Error(response.message || '刷新令牌失败')
      }

      // R36: 去除 ! 非空断言，显式检查（R91: 有了 AuthTokenResponse 类型，不再需要 as unknown）
      const result = response.data
      if (!result?.token) {
        throw new Error('刷新令牌响应缺少 token')
      }

      token.value = result.token
      setAuthData(token.value, user.value)

      debugLog('[AuthStore] 令牌已刷新')
    } catch (err) {
      debugError('[AuthStore] 刷新令牌失败:', err)
      logout()
      throw err
    }
  }

  /**
   * 验证 token 是否过期
   * R35: 全路径 try/catch，payload.exp 缺失时视为已过期
   */
  function isTokenExpired(): boolean {
    if (!token.value) return true

    try {
      const tokenParts = token.value.split('.')
      if (tokenParts.length < 2) return true

      let payloadStr = tokenParts[1] || ''
      // URL-safe base64 → 标准 base64
      payloadStr = payloadStr.replace(/-/g, '+').replace(/_/g, '/')
      // base64 padding
      const padLength = (4 - (payloadStr.length % 4)) % 4
      payloadStr += '='.repeat(padLength)

      const decoded = atob(payloadStr)
      const payload = JSON.parse(decoded) as { exp?: number }
      if (typeof payload.exp !== 'number') return true

      const expiry = payload.exp * 1000
      return Date.now() > expiry
    } catch {
      // 任一环节失败 → 保守认为已过期
      return true
    }
  }

  /**
   * 清除认证数据（同时清理 store + localStorage）
   * R34: 统一调 utils 封装，避免与 clearAuthData export 重名，内部函数命名加 Internal
   */
  function clearAuthDataInternal(): void {
    user.value = null
    token.value = null
    // 持久化侧的清理由封装统一处理（R34）
    clearAuthData()
  }

  function clearError(): void {
    error.value = null
  }

  /**
   * 设置用户信息（setUser 仅更新 user 字段，保持 token 不变）
   */
  function setUser(userData: RawBackendUser): void {
    if (!user.value || !token.value) {
      debugError('[AuthStore] setUser 调用时登录态为空，忽略')
      return
    }
    user.value = {
      id: userData.id,
      username: userData.username ?? userData.student_name ?? user.value.username,
      studentId: userData.student_id ?? userData.studentId ?? user.value.studentId,
      role: userData.role ?? user.value.role,
    }
    setAuthData(token.value, user.value)
    debugLog('[AuthStore] 用户信息已更新:', user.value)
  }

  return {
    user,
    token,
    isLoading,
    error,
    isLoggedIn,
    initialize,
    login,
    logout,
    refreshToken,
    isTokenExpired,
    clearError,
    setUser,
    // 对外暴露：内部实现是同一个，但 export 名字与之前保持兼容（不叫 clearAuthDataInternal）
    clearAuthData: clearAuthDataInternal,
    restoreFromStorage: initialize,
  }
})
