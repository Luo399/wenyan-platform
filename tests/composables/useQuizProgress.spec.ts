import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useQuizProgress } from '@/composables/useQuizProgress'

describe('useQuizProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 清除 sessionStorage
    vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {})
    vi.spyOn(sessionStorage, 'getItem').mockImplementation(() => null)
  })

  describe('初始化测试', () => {
    it('应该正确初始化进度状态', () => {
      const totalQuestions = ref(5)
      const progress = useQuizProgress(totalQuestions)

      expect(progress.currentIndex.value).toBe(0)
      expect(progress.completedCount.value).toBe(0)
      expect(progress.totalQuestions.value).toBe(5)
      expect(progress.isCompleted.value).toBe(false)
    })

    it('应该返回所有必要的属性和方法', () => {
      const totalQuestions = ref(3)
      const progress = useQuizProgress(totalQuestions)

      expect(progress).toHaveProperty('currentIndex')
      expect(progress).toHaveProperty('completedCount')
      expect(progress).toHaveProperty('totalQuestions')
      expect(progress).toHaveProperty('isCompleted')
      expect(progress).toHaveProperty('handleSubmit')
      expect(progress).toHaveProperty('resetProgress')
    })
  })

  describe('答题进度测试', () => {
    it('提交答案应该增加完成计数', () => {
      const totalQuestions = ref(5)
      const progress = useQuizProgress(totalQuestions)

      progress.handleSubmit(0)

      expect(progress.completedCount.value).toBe(1)
    })

    it('提交答案应该更新当前题目索引', () => {
      const totalQuestions = ref(5)
      const progress = useQuizProgress(totalQuestions)

      progress.handleSubmit(0)

      expect(progress.currentIndex.value).toBe(1)
    })

    it('连续提交应该正确更新进度', () => {
      const totalQuestions = ref(5)
      const progress = useQuizProgress(totalQuestions)

      progress.handleSubmit(0)
      progress.handleSubmit(1)
      progress.handleSubmit(2)

      expect(progress.completedCount.value).toBe(3)
      expect(progress.currentIndex.value).toBe(3)
    })

    it('所有题目完成后应该标记为已完成', () => {
      const totalQuestions = ref(3)
      const progress = useQuizProgress(totalQuestions)

      progress.handleSubmit(0)
      progress.handleSubmit(1)
      progress.handleSubmit(2)

      expect(progress.isCompleted.value).toBe(true)
    })
  })

  describe('进度重置测试', () => {
    it('重置进度应该恢复初始状态', () => {
      const totalQuestions = ref(5)
      const progress = useQuizProgress(totalQuestions)

      progress.handleSubmit(0)
      progress.handleSubmit(1)
      progress.resetProgress()

      expect(progress.currentIndex.value).toBe(0)
      expect(progress.completedCount.value).toBe(0)
      expect(progress.isCompleted.value).toBe(false)
    })
  })

  describe('题目总数变化测试', () => {
    it('题目总数变化时应该更新总题数', () => {
      const totalQuestions = ref(5)
      const progress = useQuizProgress(totalQuestions)

      totalQuestions.value = 10

      expect(progress.totalQuestions.value).toBe(10)
    })

    it('题目总数变化时应该重置进度', () => {
      const totalQuestions = ref(5)
      const progress = useQuizProgress(totalQuestions)

      progress.handleSubmit(0)
      totalQuestions.value = 10

      expect(progress.currentIndex.value).toBe(0)
      expect(progress.completedCount.value).toBe(0)
    })
  })

  describe('答案记录测试', () => {
    it('应该记录用户的答案', () => {
      const totalQuestions = ref(3)
      const progress = useQuizProgress(totalQuestions)

      progress.handleSubmit(0)
      progress.handleSubmit(1)

      expect(progress.answers.value[0]).toBe(0)
      expect(progress.answers.value[1]).toBe(1)
    })
  })

  describe('完成百分比测试', () => {
    it('应该正确计算完成百分比', () => {
      const totalQuestions = ref(10)
      const progress = useQuizProgress(totalQuestions)

      progress.handleSubmit(0)
      progress.handleSubmit(1)
      progress.handleSubmit(2)

      expect(progress.completionPercentage.value).toBe(30)
    })
  })
})
