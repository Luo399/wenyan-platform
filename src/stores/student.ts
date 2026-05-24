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
  const isLoggedIn = computed(() => studentId.value.length === 4)

  /** 格式化显示的学号（如：1234 -> 学号: 1234） */
  const displayId = computed(() => (studentId.value ? `学号: ${studentId.value}` : ''))

  // ============================================================
  // Actions - 操作方法
  // ============================================================

  /**
   * 设置学号
   * @param id - 4位学号
   */
  function setStudentId(id: string) {
    studentId.value = id
    // 持久化到 localStorage
    localStorage.setItem('studentId', id)
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
    // 验证格式：必须为4位数字
    if (saved && /^\d{4}$/.test(saved)) {
      studentId.value = saved
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
