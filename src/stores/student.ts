/**
 * 学生信息 Store
 *
 * 功能说明：
 * - 管理当前登录学生的学号信息
 * - 支持学号的设置、获取和清除
 * - 使用 localStorage 持久化学号
 *
 * R34: 持久化统一走 utils/localStorage.ts 封装（getStudentId/setStudentId/clearStudentId）
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  getStudentId as loadStudentIdFromStorage,
  setStudentId as saveStudentIdToStorage,
  clearStudentId as removeStudentIdFromStorage,
} from '@/utils/localStorage'
import { debugWarn } from '@/utils/debug'

export const useStudentStore = defineStore('student', () => {
  // ============================================================
  // State - 状态定义
  // ============================================================

  /** 学号 */
  const studentId = ref<string>('')

  // ============================================================
  // Getters - 计算属性
  // ============================================================

  /** 是否已登录（有学号即可，长度不限，与 LoginModal/StudentDisplay 任意位数字学号一致） */
  const isLoggedIn = computed(() => studentId.value.length > 0)

  /** 格式化显示的学号（如：1234 -> 学号: 1234） */
  const displayId = computed(() => (studentId.value ? `学号: ${studentId.value}` : ''))

  // ============================================================
  // Actions - 操作方法
  // ============================================================

  /**
   * 设置学号
   * R78: 校验输入为非空字符串，避免空串/非字符串写入 store 与 localStorage
   * @param id - 学号（纯数字，长度不限，与 LoginModal 测试账号 1-5 及正式学号 2024001 均兼容）
   */
  function setStudentId(id: string) {
    if (typeof id !== 'string' || !id.trim()) {
      debugWarn('[studentStore] setStudentId 忽略非法输入:', id)
      return
    }
    studentId.value = id.trim()
    saveStudentIdToStorage(studentId.value)
  }

  /**
   * 清除学号（退出登录）
   */
  function clearStudentId() {
    studentId.value = ''
    removeStudentIdFromStorage()
  }

  /**
   * 从 localStorage 恢复学号
   * 应用初始化时调用
   */
  function restoreFromStorage() {
    // R34: 格式校验（^\d+$）封装在 getStudentId 里，这里只需非空赋值
    const saved = loadStudentIdFromStorage()
    if (saved) {
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
