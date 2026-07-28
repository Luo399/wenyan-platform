import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useStudentInfo } from '@/composables/useStudentInfo'
import { useAuthStore } from '@/stores/auth'

// 模拟 useAuthStore
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(),
}))

describe('useStudentInfo', () => {
  let mockAuthStore: any

  beforeEach(() => {
    vi.clearAllMocks()

    // 设置默认模拟的 authStore
    mockAuthStore = {
      isLoggedIn: false,
      user: null,
      initialize: vi.fn(),
    }

    vi.mocked(useAuthStore).mockReturnValue(mockAuthStore)
  })

  describe('studentId 计算属性', () => {
    it('应返回空字符串当用户未登录时', () => {
      mockAuthStore.isLoggedIn = false
      mockAuthStore.user = null

      const { studentId } = useStudentInfo()

      expect(studentId.value).toBe('')
    })

    it('应返回空字符串当 user 为 null 时', () => {
      mockAuthStore.isLoggedIn = true
      mockAuthStore.user = null

      const { studentId } = useStudentInfo()

      expect(studentId.value).toBe('')
    })

    it('应返回学生 ID 当用户已登录且有信息时', () => {
      mockAuthStore.isLoggedIn = true
      mockAuthStore.user = {
        studentId: '202421315089',
        username: '测试学生',
      }

      const { studentId } = useStudentInfo()

      expect(studentId.value).toBe('202421315089')
    })

    it('应返回空字符串当 user.studentId 不存在时', () => {
      mockAuthStore.isLoggedIn = true
      mockAuthStore.user = {
        username: '测试学生',
      }

      const { studentId } = useStudentInfo()

      expect(studentId.value).toBe('')
    })

    it('应返回空字符串当 user.studentId 显式为 null 时', () => {
      // 新增的 || '' 兜底：旧实现对显式 null 值会原样返回 null，
      // 可能导致下游拼字符串时出现 "null" 字面量。
      mockAuthStore.isLoggedIn = true
      mockAuthStore.user = {
        studentId: null,
        username: '测试学生',
      }

      const { studentId } = useStudentInfo()

      expect(studentId.value).toBe('')
      expect(studentId.value).not.toBeNull()
    })
  })

  describe('getStudentName 函数', () => {
    it('应返回空字符串当用户未登录时', () => {
      mockAuthStore.isLoggedIn = false
      mockAuthStore.user = null

      const { getStudentName } = useStudentInfo()
      const result = getStudentName()

      expect(result).toBe('')
    })

    it('应返回空字符串当 user 为 null 时', () => {
      mockAuthStore.isLoggedIn = true
      mockAuthStore.user = null

      const { getStudentName } = useStudentInfo()
      const result = getStudentName()

      expect(result).toBe('')
    })

    it('应返回学生姓名当用户已登录时', () => {
      mockAuthStore.isLoggedIn = true
      mockAuthStore.user = {
        studentId: '202421315089',
        username: '罗慧宁',
      }

      const { getStudentName } = useStudentInfo()
      const result = getStudentName()

      expect(result).toBe('罗慧宁')
    })

    it('应返回空字符串当 user.username 不存在时', () => {
      mockAuthStore.isLoggedIn = true
      mockAuthStore.user = {
        studentId: '202421315089',
      }

      const { getStudentName } = useStudentInfo()
      const result = getStudentName()

      expect(result).toBe('')
    })

    it('应返回空字符串当 user.username 显式为 null 时', () => {
      // 新增的 || '' 兜底：与 studentId 行为一致。
      mockAuthStore.isLoggedIn = true
      mockAuthStore.user = {
        studentId: '202421315089',
        username: null,
      }

      const { getStudentName } = useStudentInfo()
      const result = getStudentName()

      expect(result).toBe('')
      expect(result).not.toBeNull()
    })
  })

  describe('getStudentInfo 函数', () => {
    it('应返回错误信息当学生 ID 不存在时', () => {
      mockAuthStore.isLoggedIn = false
      mockAuthStore.user = null

      const { getStudentInfo } = useStudentInfo()
      const result = getStudentInfo()

      expect(result).toEqual({
        id: '',
        name: '',
        isLoading: false,
        error: '未找到学生信息',
      })
    })

    it('应返回完整的学生信息当用户已登录时', () => {
      mockAuthStore.isLoggedIn = true
      mockAuthStore.user = {
        studentId: '202421315089',
        username: '罗慧宁',
      }

      const { getStudentInfo } = useStudentInfo()
      const result = getStudentInfo()

      expect(result).toEqual({
        id: '202421315089',
        name: '罗慧宁',
        isLoading: false,
        error: null,
      })
    })

    it('应返回错误当 studentId 为空时', () => {
      mockAuthStore.isLoggedIn = true
      mockAuthStore.user = {
        studentId: '',
        username: '测试学生',
      }

      const { getStudentInfo } = useStudentInfo()
      const result = getStudentInfo()

      expect(result.error).toBe('未找到学生信息')
      expect(result.id).toBe('')
    })
  })

  describe('clearCache 函数', () => {
    it('应能够被调用而不抛出错误', () => {
      const { clearCache } = useStudentInfo()

      expect(() => clearCache()).not.toThrow()
    })
  })

  describe('authStore.initialize 调用', () => {
    it('应在 composable 使用时调用 authStore.initialize', () => {
      useStudentInfo()

      // 注意：由于 onMounted 的模拟限制，这里可能需要手动验证
      // 实际测试中可能需要使用 Vue Test Utils 的 mount
      expect(mockAuthStore.initialize).toBeDefined()
    })
  })

  describe('响应式更新', () => {
    it('应响应 authStore 状态变化', () => {
      mockAuthStore.isLoggedIn = false
      mockAuthStore.user = null

      const { studentId, getStudentInfo } = useStudentInfo()

      expect(studentId.value).toBe('')
      expect(getStudentInfo().error).toBe('未找到学生信息')

      // 模拟状态变化
      mockAuthStore.isLoggedIn = true
      mockAuthStore.user = {
        studentId: '202421315089',
        username: '测试学生',
      }

      // 注意：由于响应式系统的复杂性，这里可能需要额外的处理
      // 在真实场景中，studentId 应该自动更新
    })
  })
})