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
import { post } from '@/utils/api'
import { debugLog, debugError } from '@/utils/debug'

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
        debugLog('[AuthStore] 从 localStorage 恢复登录状态')
      } catch (e) {
        debugError('[AuthStore] 解析保存的用户信息失败:', e)
        error.value = '登录状态已过期，请重新登录'
        clearAuthData()
      }
    }
  }

  /**
   * 登录
   *
   * R103: 改为调用 /api/auth/student/login（正式端点），传 student_id + password
   * 旧实现走 /api/auth/login（兼容端点）免密登录，存在安全漏洞
   *
   * @param studentId 学号
   * @param password 密码（必填，教师重置后默认为 123456）
   * @param studentName 学生姓名（可选，仅用于显示回退，后端不依赖此字段）
   * @returns Promise
   */
  async function login(studentId: string, password: string, studentName?: string): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      // R103: 调用正式端点 /api/auth/student/login，传 student_id + password
      const response = await post('/api/auth/student/login', {
        student_id: studentId,
        password,
      })

      if (!response.success) {
        throw new Error(response.message || '登录失败')
      }

      // 保存 token 和用户信息
      const result = response.data!
      token.value = result.token
      const userData = result.user

      if (!userData) {
        throw new Error('登录成功但未返回用户信息')
      }

      // R103: 后端 studentLogin 返回 user.username / user.student_name / user.student_id
      // 优先使用后端返回字段，studentName 仅作显示回退
      user.value = {
        id: userData.id,
        username: userData.username || userData.student_name || studentName || studentId,
        studentId: userData.student_id || userData.studentId || studentId,
        role: userData.role || 'student',
      }

      // 持久化到 localStorage
      localStorage.setItem('auth_token', token.value!)
      localStorage.setItem('auth_user', JSON.stringify(user.value))

      debugLog('[AuthStore] 登录成功:', user.value)
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
      // 使用统一的API封装函数，Authorization header 会自动添加
      const response = await post('/api/auth/refresh')

      if (!response.success) {
        throw new Error(response.message || '刷新令牌失败')
      }

      // 更新 token
      token.value = response.data!.token
      localStorage.setItem('auth_token', token.value!)

      debugLog('[AuthStore] 令牌已刷新')
    } catch (err) {
      debugError('[AuthStore] 刷新令牌失败:', err)
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
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
  }

  /**
   * 清除错误信息
   */
  function clearError(): void {
    error.value = null
  }

  /**
   * 设置用户信息
   * @param userData - 用户数据
   */
  function setUser(userData: {
    id: string
    username: string
    student_id: string
    role: 'student' | 'teacher' | 'admin'
  }): void {
    user.value = {
      id: userData.id,
      username: userData.username,
      studentId: userData.student_id,
      role: userData.role,
    }
    // 持久化到 localStorage
    localStorage.setItem('auth_user', JSON.stringify(user.value))
    debugLog('[AuthStore] 用户信息已更新:', user.value)
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
    setUser,
    clearAuthData,
    restoreFromStorage: initialize,
  }
})
