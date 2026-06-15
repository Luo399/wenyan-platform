/**
 * 学生信息 Store
 *
 * 功能说明：
 * - 管理当前登录学生的学号信息
 * - 支持学号的设置、获取和清除
 * - 使用 localStorage 持久化学号
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useStudentStore = defineStore('student', () => {
  // ============================================================
  // State - 状态定义
  // ============================================================

  /** 学号 */
  const studentId = ref<string>('')

  // ============================================================
  // Getters - 计算属性
  // ============================================================

  /** 是否已登录（有学号） */
  const isLoggedIn = computed(() => studentId.value.length > 0)

  /** 格式化显示的学号（如：1234 -> 学号: 1234） */
  const displayId = computed(() => (studentId.value ? `学号: ${studentId.value}` : ''))

  // ============================================================
  // Actions - 操作方法
  // ============================================================

  /**
   * 验证学号格式（新逻辑）
   *
   * 旧逻辑（已废弃）：
   * - 要求4位数字：return id && /^\d{4}$/.test(id)
   *
   * 新逻辑：
   * - 只要非空即可，支持任意格式的学号（数字、字母等）
   * @param id - 学号
   * @returns 是否有效
   */
  function isValidStudentId(id: string | null): boolean {
    return !!id && id.trim().length > 0
  }

  /**
   * 设置学号（新逻辑）
   *
   * 旧逻辑（已废弃）：
   * - 只接受4位数字学号
   *
   * 新逻辑：
   * - 接受任意非空学号，与Excel导入的students表数据匹配
   * @param id - 学号（支持任意格式）
   */
  function setStudentId(id: string) {
    const trimmedId = id.trim()
    if (!isValidStudentId(trimmedId)) {
      console.warn(`[StudentStore] 无效的学号格式: ${id}`)
      return
    }
    studentId.value = trimmedId
    localStorage.setItem('studentId', trimmedId)
  }

  /**
   * 清除学号（退出登录）
   */
  function clearStudentId() {
    studentId.value = ''
    localStorage.removeItem('studentId')
  }

  /**
   * 从 localStorage 恢复学号
   * 应用初始化时调用
   */
  function restoreFromStorage() {
    const saved = localStorage.getItem('studentId')
    if (isValidStudentId(saved)) {
      studentId.value = saved!
    }
  }

  return {
    studentId,
    isLoggedIn,
    displayId,
    setStudentId,
    clearStudentId,
    restoreFromStorage,
  }
})
