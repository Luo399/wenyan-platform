import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAnswerSubmitter, convertFromQuizProgress, convertFromQuestions } from '@/composables/useAnswerSubmitter'

describe('useAnswerSubmitter', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('初始化测试', () => {
    it('应该正确初始化状态', () => {
      const { answers, isSubmitting, submitError } = useAnswerSubmitter()

      expect(answers.value).toEqual([])
      expect(isSubmitting.value).toBe(false)
      expect(submitError.value).toBe(null)
    })

    it('应该返回所有必要的方法', () => {
      const submitter = useAnswerSubmitter()

      expect(submitter).toHaveProperty('addAnswer')
      expect(submitter).toHaveProperty('updateAnswer')
      expect(submitter).toHaveProperty('removeAnswer')
      expect(submitter).toHaveProperty('clearAnswers')
      expect(submitter).toHaveProperty('validateAnswers')
      expect(submitter).toHaveProperty('buildSubmitPayload')
      expect(submitter).toHaveProperty('submitAnswers')
    })
  })

  describe('答案管理测试', () => {
    it('添加答案应该正确存储', () => {
      const { addAnswer, answers } = useAnswerSubmitter()

      addAnswer({ questionId: 'Q1', userAnswer: 'A' })

      expect(answers.value.length).toBe(1)
      expect(answers.value[0].questionId).toBe('Q1')
      expect(answers.value[0].userAnswer).toBe('A')
    })

    it('添加重复questionId应该更新而不是追加', () => {
      const { addAnswer, answers } = useAnswerSubmitter()

      addAnswer({ questionId: 'Q1', userAnswer: 'A' })
      addAnswer({ questionId: 'Q1', userAnswer: 'B' })

      expect(answers.value.length).toBe(1)
      expect(answers.value[0].userAnswer).toBe('B')
    })

    it('更新答案应该正确修改现有记录', () => {
      const { addAnswer, updateAnswer, answers } = useAnswerSubmitter()

      addAnswer({ questionId: 'Q1', userAnswer: 'A' })
      updateAnswer('Q1', { userAnswer: 'B', isCorrect: true })

      expect(answers.value[0].userAnswer).toBe('B')
      expect(answers.value[0].isCorrect).toBe(true)
    })

    it('删除答案应该正确移除记录', () => {
      const { addAnswer, removeAnswer, answers } = useAnswerSubmitter()

      addAnswer({ questionId: 'Q1', userAnswer: 'A' })
      addAnswer({ questionId: 'Q2', userAnswer: 'B' })
      removeAnswer('Q1')

      expect(answers.value.length).toBe(1)
      expect(answers.value[0].questionId).toBe('Q2')
    })

    it('清空答案应该移除所有记录', () => {
      const { addAnswer, clearAnswers, answers } = useAnswerSubmitter()

      addAnswer({ questionId: 'Q1', userAnswer: 'A' })
      addAnswer({ questionId: 'Q2', userAnswer: 'B' })
      clearAnswers()

      expect(answers.value.length).toBe(0)
    })
  })

  describe('答案验证测试', () => {
    it('验证应该通过有效答案', () => {
      const { addAnswer, validateAnswers } = useAnswerSubmitter()

      addAnswer({ questionId: 'Q1', userAnswer: 'A' })
      addAnswer({ questionId: 'Q2', userAnswer: 1 })

      const result = validateAnswers()

      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
      expect(result.missing).toEqual([])
    })

    it('验证应该拒绝缺少questionId的答案', () => {
      const { addAnswer, validateAnswers } = useAnswerSubmitter()

      addAnswer({ questionId: '', userAnswer: 'A' })

      const result = validateAnswers()

      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('questionId')
    })

    it('验证应该拒绝缺少userAnswer的答案', () => {
      const { addAnswer, validateAnswers } = useAnswerSubmitter()

      addAnswer({ questionId: 'Q1', userAnswer: undefined as any })

      const result = validateAnswers()

      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('用户答案')
    })

    it('验证应该检测重复的questionId', () => {
      const { answers, validateAnswers } = useAnswerSubmitter()

      answers.value = [
        { questionId: 'Q1', userAnswer: 'A' },
        { questionId: 'Q1', userAnswer: 'B' },
      ]

      const result = validateAnswers()

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('重复'))).toBe(true)
    })

    it('验证应该拒绝无效类型的答案', () => {
      const { addAnswer, validateAnswers } = useAnswerSubmitter()

      addAnswer({ questionId: 'Q1', userAnswer: {} as any })

      const result = validateAnswers()

      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('类型不正确')
    })

    it('验证应该接受数组类型的答案', () => {
      const { addAnswer, validateAnswers } = useAnswerSubmitter()

      addAnswer({ questionId: 'Q1', userAnswer: ['A', 'B'] })

      const result = validateAnswers()

      expect(result.valid).toBe(true)
    })
  })

  describe('数据类型转换测试', () => {
    it('应该将字符串数字转换为数字类型', () => {
      const { addAnswer, answers } = useAnswerSubmitter()

      addAnswer({ questionId: 'Q1', userAnswer: '123' })

      expect(typeof answers.value[0].userAnswer).toBe('number')
      expect(answers.value[0].userAnswer).toBe(123)
    })

    it('应该保留非数字字符串', () => {
      const { addAnswer, answers } = useAnswerSubmitter()

      addAnswer({ questionId: 'Q1', userAnswer: 'ABC' })

      expect(typeof answers.value[0].userAnswer).toBe('string')
      expect(answers.value[0].userAnswer).toBe('ABC')
    })

    it('应该转换数组中的字符串数字', () => {
      const { addAnswer, answers } = useAnswerSubmitter()

      addAnswer({ questionId: 'Q1', userAnswer: ['1', '2'] })

      expect(Array.isArray(answers.value[0].userAnswer)).toBe(true)
      const arr = answers.value[0].userAnswer as number[]
      expect(typeof arr[0]).toBe('number')
      expect(arr[0]).toBe(1)
    })
  })

  describe('提交载荷构建测试', () => {
    it('验证失败时应该返回null', () => {
      const { addAnswer, buildSubmitPayload } = useAnswerSubmitter()

      addAnswer({ questionId: '', userAnswer: 'A' })

      const payload = buildSubmitPayload('WEN_01')

      expect(payload).toBe(null)
    })
  })

  describe('格式转换函数测试', () => {
    it('convertFromQuizProgress应该正确转换格式', () => {
      const quizAnswers = [
        { questionIndex: 0, answer: 'A', isCorrect: true, questionId: 'Q1' },
        { questionIndex: 1, answer: 'B', isCorrect: false },
      ]
      const questionIds = ['Q1', 'Q2']

      const result = convertFromQuizProgress(quizAnswers, questionIds)

      expect(result.length).toBe(2)
      expect(result[0].questionId).toBe('Q1')
      expect(result[0].userAnswer).toBe('A')
      expect(result[1].questionId).toBe('Q2')
      expect(result[1].userAnswer).toBe('B')
    })

    it('convertFromQuestions应该正确转换格式', () => {
      const questions = [
        { questionId: 'Q1', correctAnswer: 'A', module: 'module1' },
        { questionId: 'Q2', correctAnswer: 1 },
      ]
      const userAnswers = { Q1: 'A', Q2: 1 }

      const result = convertFromQuestions(questions, userAnswers)

      expect(result.length).toBe(2)
      expect(result[0].questionId).toBe('Q1')
      expect(result[0].userAnswer).toBe('A')
      expect(result[0].correctAnswer).toBe('A')
      expect(result[1].questionId).toBe('Q2')
      expect(result[1].userAnswer).toBe(1)
    })

    it('convertFromQuestions应该处理缺失的用户答案', () => {
      const questions = [{ questionId: 'Q1', correctAnswer: 'A' }]
      const userAnswers: Record<string, any> = {}

      const result = convertFromQuestions(questions, userAnswers)

      expect(result[0].userAnswer).toBe('')
    })
  })
})