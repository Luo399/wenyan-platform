/**
 * 用户认证状态管理
 *
 * 功能：
 * - 管理学生/教师/管理员登录状态
 * - 处理 JWT token 的存储和验证
 * - 提供登录、登出等方法
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { post, get } from '@/utils/api'

export interface StudentUser {
  id: number
  student_id: string
  name: string | null
  role: 'student'
  password_changed: boolean
}

export interface TeacherUser {
  id: number
  phone: string
  name: string
  school: string | null
  classes: string[]
  role: 'teacher' | 'admin'
  password_changed: boolean
}

export type User = StudentUser | TeacherUser

export const useAuthStore = defineStore('auth', () => {
  // 状态
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // 计算属性
  const isLoggedIn = computed(() => !!token.value && !!user.value)
  const isStudent = computed(() => user.value?.role === 'student')
  const isTeacher = computed(() => user.value?.role === 'teacher')
  const isAdmin = computed(() => user.value?.role === 'admin')

  /**
   * 初始化认证状态
   */
  function initialize() {
    const savedToken = localStorage.getItem('auth_token')
    const savedUser = localStorage.getItem('auth_user')

    if (savedToken && savedUser) {
      try {
        token.value = savedToken
        user.value = JSON.parse(savedUser)
        error.value = null
      } catch (e) {
        console.error('[AuthStore] 解析用户信息失败:', e)
        clearAuthData()
      }
    }
  }

  /**
   * 学生登录
   */
  async function studentLogin(studentId: string, password: string): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const response = await post('/api/auth/student/login', { student_id: studentId, password })

      if (!response.success) {
        throw new Error(response.message || '登录失败')
      }

      const result = response.data!
      token.value = result.token
      const userData = result.user as StudentUser
      user.value = { ...userData, role: 'student' }

      localStorage.setItem('auth_token', token.value!)
      localStorage.setItem('auth_user', JSON.stringify(user.value))
    } catch (err) {
      error.value = err instanceof Error ? err.message : '登录失败'
      clearAuthData()
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 教师登录
   */
  async function teacherLogin(phone: string, password: string): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const response = await post('/api/auth/teacher/login', { phone, password })

      if (!response.success) {
        throw new Error(response.message || '登录失败')
      }

      const result = response.data!
      token.value = result.token
      const userData = result.user as TeacherUser
      user.value = { ...userData, role: userData.role }

      localStorage.setItem('auth_token', token.value!)
      localStorage.setItem('auth_user', JSON.stringify(user.value))
    } catch (err) {
      error.value = err instanceof Error ? err.message : '登录失败'
      clearAuthData()
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 教师注册
   */
  async function teacherRegister(data: {
    name: string
    phone: string
    school: string
    classes: string[]
    password: string
  }): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const response = await post('/api/auth/teacher/register', {
        ...data,
        classes: JSON.stringify(data.classes),
      })

      if (!response.success) {
        throw new Error(response.message || '注册失败')
      }

      const result = response.data!
      token.value = result.token
      const userData = result.user as TeacherUser
      user.value = { ...userData, role: 'teacher' }

      localStorage.setItem('auth_token', token.value!)
      localStorage.setItem('auth_user', JSON.stringify(user.value))
    } catch (err) {
      error.value = err instanceof Error ? err.message : '注册失败'
      clearAuthData()
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 修改密码
   */
  async function changePassword(oldPassword: string, newPassword: string, confirmPassword: string): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const response = await post('/api/auth/change-password', {
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      })

      if (!response.success) {
        throw new Error(response.message || '修改密码失败')
      }

      // 更新密码已修改状态
      if (user.value) {
        user.value.password_changed = true
        localStorage.setItem('auth_user', JSON.stringify(user.value))
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '修改密码失败'
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

  return {
    user,
    token,
    isLoading,
    error,
    isLoggedIn,
    isStudent,
    isTeacher,
    isAdmin,
    initialize,
    studentLogin,
    teacherLogin,
    teacherRegister,
    changePassword,
    logout,
    clearError,
  }
})
