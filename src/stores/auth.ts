/**
 * 用户认证状态管理
 *
 * 功能：
 * - 管理用户登录状态
 * - 处理 JWT token 的存储和验证
 * - 提供登录、登出、刷新令牌等方法
 * - 支持从 localStorage 恢复登录状态
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/**
 * 用户信息接口
 */
export interface User {
  id: string
  username: string
  studentId: string
  role: 'student' | 'teacher' | 'admin'
}

/**
 * 认证状态接口
 */
export interface AuthState {
  user: User | null
  token: string | null
  isLoggedIn: boolean
  isLoading: boolean
  error: string | null
}

export const useAuthStore = defineStore('auth', () => {
  // 状态定义
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // 计算属性
  const isLoggedIn = computed(() => !!token.value && !!user.value)

  /**
   * 初始化认证状态
   * 从 localStorage 恢复用户信息和 token
   */
  function initialize() {
    const savedToken = localStorage.getItem('auth_token')
    const savedUser = localStorage.getItem('auth_user')

    if (savedToken && savedUser) {
      try {
        token.value = savedToken
        user.value = JSON.parse(savedUser)
        error.value = null
        console.log('[AuthStore] 从 localStorage 恢复登录状态')
      } catch (e) {
        console.error('[AuthStore] 解析保存的用户信息失败:', e)
        error.value = '登录状态已过期，请重新登录'
        clearAuthData()
      }
    }
  }

  /**
   * 登录
   * @param studentId 学号
   * @param studentName 学生姓名（可选，用于显示）
   * @returns Promise
   */
  async function login(studentId: string, studentName?: string): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      // 调用登录接口
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ student_id: studentId, student_name: studentName }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || '登录失败')
      }

      // 保存 token 和用户信息
      const result = data.data || data
      token.value = result.token
      const userData = result.user

      if (!userData) {
        throw new Error('登录成功但未返回用户信息')
      }

      user.value = {
        id: userData.id,
        username: userData.username || userData.name || studentName || studentId,
        studentId: userData.student_id || userData.studentId || studentId,
        role: userData.role || 'student',
      }

      // 持久化到 localStorage
      localStorage.setItem('auth_token', token.value!)
      localStorage.setItem('auth_user', JSON.stringify(user.value))

      console.log('[AuthStore] 登录成功:', user.value)
    } catch (err) {
      error.value = err instanceof Error ? err.message : '登录失败，请重试'
      clearAuthData()
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 登出
   */
  function logout(): void {
    clearAuthData()
    console.log('[AuthStore] 已登出')
  }

  /**
   * 刷新令牌
   */
  async function refreshToken(): Promise<void> {
    if (!token.value) {
      throw new Error('没有可用的令牌')
    }

    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.value}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || '刷新令牌失败')
      }

      // 更新 token
      token.value = data.token
      localStorage.setItem('auth_token', token.value!)

      console.log('[AuthStore] 令牌已刷新')
    } catch (err) {
      console.error('[AuthStore] 刷新令牌失败:', err)
      logout()
      throw err
    }
  }

  /**
   * 验证 token 是否过期
   */
  function isTokenExpired(): boolean {
    if (!token.value) return true

    try {
      // 解码 JWT payload
      const tokenParts = token.value!.split('.')
      if (tokenParts.length < 2) return true
      const payload = JSON.parse(atob(tokenParts[1] as string))
      const expiry = payload.exp * 1000 // 转换为毫秒
      return Date.now() > expiry
    } catch {
      return true
    }
  }

  /**
   * 清除认证数据
   */
  function clearAuthData(): void {
    user.value = null
    token.value = null
    error.value = null
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
  }

  /**
   * 清除错误信息
   */
  function clearError(): void {
    error.value = null
  }

  return {
    // 状态
    user,
    token,
    isLoading,
    error,
    isLoggedIn,

    // 方法
    initialize,
    login,
    logout,
    refreshToken,
    isTokenExpired,
    clearError,
  }
})
