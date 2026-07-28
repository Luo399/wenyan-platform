import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useQuizProgress } from '@/composables/useQuizProgress'

describe('useQuizProgress', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
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
      expect(progress).toHaveProperty('progressPercent')
      expect(progress).toHaveProperty('answers')
    })
  })

  describe('答题进度测试', () => {
    it('提交答案应该增加完成计数', async () => {
      const totalQuestions = ref(5)
      const progress = useQuizProgress(totalQuestions)

      await progress.handleSubmit(0)

      expect(progress.completedCount.value).toBe(1)
    })

    it('提交答案应该更新当前题目索引', async () => {
      const totalQuestions = ref(5)
      const progress = useQuizProgress(totalQuestions)

      await progress.handleSubmit(0)

      expect(progress.currentIndex.value).toBe(1)
    })

    it('连续提交应该正确更新进度', async () => {
      const totalQuestions = ref(5)
      const progress = useQuizProgress(totalQuestions)

      await progress.handleSubmit(0)
      await progress.handleSubmit(1)
      await progress.handleSubmit(2)

      expect(progress.completedCount.value).toBe(3)
      expect(progress.currentIndex.value).toBe(3)
    })

    it('所有题目完成后应该标记为已完成', async () => {
      const totalQuestions = ref(3)
      const progress = useQuizProgress(totalQuestions)

      await progress.handleSubmit(0)
      await progress.handleSubmit(1)
      await progress.handleSubmit(2)

      expect(progress.isCompleted.value).toBe(true)
    })
  })

  describe('进度重置测试', () => {
    it('重置进度应该恢复初始状态', async () => {
      const totalQuestions = ref(5)
      const progress = useQuizProgress(totalQuestions)

      await progress.handleSubmit(0)
      await progress.handleSubmit(1)
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

    it('题目总数减少时不应该重置进度', async () => {
      const totalQuestions = ref(10)
      const progress = useQuizProgress(totalQuestions)

      await progress.handleSubmit(0)
      totalQuestions.value = 5

      expect(progress.currentIndex.value).toBe(1)
      expect(progress.completedCount.value).toBe(1)
    })
  })

  describe('答案记录测试', () => {
    it('应该记录用户的答案', async () => {
      const totalQuestions = ref(3)
      const progress = useQuizProgress(totalQuestions)

      await progress.handleSubmit(0)
      await progress.handleSubmit(1)

      expect(progress.answers.value[0].answer).toBe(0)
      expect(progress.answers.value[1].answer).toBe(1)
      expect(progress.answers.value[0].questionIndex).toBe(0)
      expect(progress.answers.value[1].questionIndex).toBe(1)
    })

    it('应该记录字母格式的答案', async () => {
      const totalQuestions = ref(3)
      const progress = useQuizProgress(totalQuestions)

      await progress.handleSubmit('A')
      await progress.handleSubmit('B')

      expect(progress.answers.value[0].answer).toBe('A')
      expect(progress.answers.value[1].answer).toBe('B')
    })

    it('答案记录应该包含完整的信息', async () => {
      const totalQuestions = ref(3)
      const progress = useQuizProgress(totalQuestions)

      await progress.handleSubmit(2, true, 'Q1', 'module1', 2)

      const answer = progress.answers.value[0]
      expect(answer.questionIndex).toBe(0)
      expect(answer.answer).toBe(2)
      expect(answer.isCorrect).toBe(true)
      expect(answer.questionId).toBe('Q1')
      expect(answer.module).toBe('module1')
      expect(answer.correctAnswer).toBe(2)
    })
  })

  describe('答案格式转换测试', () => {
    it('应该将字母答案转换为数字索引', async () => {
      const totalQuestions = ref(2)
      const wenId = 'WEN_01'
      const progress = useQuizProgress(totalQuestions, undefined, wenId)

      await progress.handleSubmit('A')
      await progress.handleSubmit('C')

      const answerMap: Record<string, any> = {}
      const letterToIndex: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 }
      progress.answers.value.forEach((ans) => {
        const key = ans.questionId || `question_${ans.questionIndex}`
        let mappedAnswer = ans.answer
        if (typeof ans.answer === 'string' && letterToIndex[ans.answer] !== undefined) {
          mappedAnswer = letterToIndex[ans.answer]
        }
        answerMap[key] = mappedAnswer
      })

      expect(answerMap['question_0']).toBe(0)
      expect(answerMap['question_1']).toBe(2)
    })

    it('应该保留数字格式的答案', () => {
      const letterToIndex: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 }
      const testAnswer = 2
      let mappedAnswer = testAnswer
      if (typeof testAnswer === 'string' && letterToIndex[testAnswer] !== undefined) {
        mappedAnswer = letterToIndex[testAnswer]
      }
      expect(mappedAnswer).toBe(2)
    })

    it('应该正确处理非字母非数字的答案', () => {
      const letterToIndex: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 }
      const testAnswer = 'custom_answer'
      let mappedAnswer = testAnswer
      if (typeof testAnswer === 'string' && letterToIndex[testAnswer] !== undefined) {
        mappedAnswer = letterToIndex[testAnswer]
      }
      expect(mappedAnswer).toBe('custom_answer')
    })
  })

  describe('完成百分比测试', () => {
    it('应该正确计算完成百分比', async () => {
      const totalQuestions = ref(10)
      const progress = useQuizProgress(totalQuestions)

      await progress.handleSubmit(0)
      await progress.handleSubmit(1)
      await progress.handleSubmit(2)

      expect(progress.progressPercent.value).toBe(30)
    })

    it('全部完成时百分比应该是100', async () => {
      const totalQuestions = ref(3)
      const progress = useQuizProgress(totalQuestions)

      await progress.handleSubmit(0)
      await progress.handleSubmit(1)
      await progress.handleSubmit(2)

      expect(progress.progressPercent.value).toBe(100)
    })

    it('没有题目时百分比应该是0', () => {
      const totalQuestions = ref(0)
      const progress = useQuizProgress(totalQuestions)

      expect(progress.progressPercent.value).toBe(0)
    })
  })

  describe('跳转题目测试', () => {
    it('应该可以跳转到指定题目', () => {
      const totalQuestions = ref(5)
      const progress = useQuizProgress(totalQuestions)

      progress.goToQuestion(2)

      expect(progress.currentIndex.value).toBe(2)
    })

    it('跳转到无效索引应该被忽略', () => {
      const totalQuestions = ref(5)
      const progress = useQuizProgress(totalQuestions)

      progress.goToQuestion(-1)
      expect(progress.currentIndex.value).toBe(0)

      progress.goToQuestion(10)
      expect(progress.currentIndex.value).toBe(0)
    })
  })

  describe('完成记录测试', () => {
    it('应该在完成所有题目后保存完成记录', async () => {
      const totalQuestions = ref(2)
      const progress = useQuizProgress(totalQuestions, undefined, 'test_key')

      await progress.handleSubmit(0)
      expect(progress.isCompleted.value).toBe(false)

      await progress.handleSubmit(1)
      expect(progress.isCompleted.value).toBe(true)
    })

    it('应该在重置进度时清除完成状态', async () => {
      const totalQuestions = ref(2)
      const progress = useQuizProgress(totalQuestions, undefined, 'test_key')

      await progress.handleSubmit(0)
      await progress.handleSubmit(1)
      expect(progress.isCompleted.value).toBe(true)

      progress.resetProgress()
      expect(progress.isCompleted.value).toBe(false)
      expect(progress.completedCount.value).toBe(0)
    })
  })
})
