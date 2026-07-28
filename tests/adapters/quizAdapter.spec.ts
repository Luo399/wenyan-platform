import { describe, it, expect } from 'vitest'
import { adaptBlockQuizToQuizItem, isValidQuizItem } from '@/adapters/quizAdapter'
import type { BlockQuizData } from '@/adapters/quizAdapter'

describe('quizAdapter', () => {
  describe('adaptBlockQuizToQuizItem', () => {
    it('应正确转换完整的 Quiz 数据', () => {
      const blockData: BlockQuizData = {
        text_id: 'WEN_01',
        question_id: 'Q1',
        module: 'Level1',
        question_number: 1,
        question_text: '测试题目',
        option_a: '选项A',
        option_b: '选项B',
        option_c: '选项C',
        option_d: '选项D',
        audio_file: 'audio.mp3',
        difficulty: 'L1',
        correct_answer: 0,
        explanation: '解释说明',
        question_type: 'radio',
      }

      const result = adaptBlockQuizToQuizItem(blockData)

      expect(result.textId).toBe('WEN_01')
      expect(result.questionId).toBe('Q1')
      expect(result.module).toBe('Level1')
      expect(result.questionNumber).toBe(1)
      expect(result.questionText).toBe('测试题目')
      expect(result.options).toHaveLength(4)
      expect(result.options[0]).toEqual({ label: 'A', value: '选项A' })
      expect(result.audioFile).toBe('audio.mp3')
      expect(result.difficulty).toBe('L1')
      expect(result.correctAnswer).toBe(0)
      expect(result.explanation).toBe('解释说明')
      expect(result.questionType).toBe('radio')
    })

    it('应正确处理字符串类型的 question_number', () => {
      const blockData: BlockQuizData = {
        question_number: '5',
      }

      const result = adaptBlockQuizToQuizItem(blockData)

      expect(result.questionNumber).toBe(5)
    })

    it('应将无效的 question_number 转换为默认值 1', () => {
      const blockData: BlockQuizData = {
        question_number: 'invalid',
      }

      const result = adaptBlockQuizToQuizItem(blockData)

      expect(result.questionNumber).toBe(1)
    })

    it('应正确处理 null 和 undefined 的 correct_answer', () => {
      const blockData1: BlockQuizData = {
        correct_answer: null,
      }

      const blockData2: BlockQuizData = {
        correct_answer: undefined,
      }

      const result1 = adaptBlockQuizToQuizItem(blockData1)
      const result2 = adaptBlockQuizToQuizItem(blockData2)

      expect(result1.correctAnswer).toBeNull()
      expect(result2.correctAnswer).toBeNull()
    })

    it('应过滤掉空字符串的选项', () => {
      const blockData: BlockQuizData = {
        option_a: '选项A',
        option_b: '',
        option_c: '选项C',
        option_d: '   ', // 纯空格字符串
      }

      const result = adaptBlockQuizToQuizItem(blockData)

      expect(result.options).toHaveLength(2)
      expect(result.options[0]).toEqual({ label: 'A', value: '选项A' })
      expect(result.options[1]).toEqual({ label: 'C', value: '选项C' })
    })

    it('应使用提供的 textId 和 questionId 作为默认值', () => {
      const blockData: BlockQuizData = {}

      const result = adaptBlockQuizToQuizItem(blockData, 'WEN_CUSTOM', 'Q_CUSTOM')

      expect(result.textId).toBe('WEN_CUSTOM')
      expect(result.questionId).toBe('Q_CUSTOM')
    })

    it('应使用 blockData 中的 text_id 而非参数默认值', () => {
      const blockData: BlockQuizData = {
        text_id: 'WEN_DATA',
        question_id: 'Q_DATA',
      }

      const result = adaptBlockQuizToQuizItem(blockData, 'WEN_DEFAULT', 'Q_DEFAULT')

      expect(result.textId).toBe('WEN_DATA')
      expect(result.questionId).toBe('Q_DATA')
    })

    it('应正确处理空对象，使用所有默认值', () => {
      const blockData: BlockQuizData = {}

      const result = adaptBlockQuizToQuizItem(blockData)

      expect(result.textId).toBe('')
      expect(result.questionId).toBe('')
      expect(result.module).toBe('')
      expect(result.questionNumber).toBe(1)
      expect(result.questionText).toBe('')
      expect(result.options).toHaveLength(0)
      expect(result.audioFile).toBeNull()
      expect(result.difficulty).toBe('L2')
      expect(result.correctAnswer).toBeNull()
      expect(result.explanation).toBe('')
      expect(result.questionType).toBe('radio')
    })

    it('应正确处理数字类型的 correct_answer', () => {
      const blockData: BlockQuizData = {
        correct_answer: 2,
      }

      const result = adaptBlockQuizToQuizItem(blockData)

      expect(result.correctAnswer).toBe(2)
    })

    it('应正确处理字符串类型的 correct_answer', () => {
      const blockData: BlockQuizData = {
        correct_answer: 'A',
      }

      const result = adaptBlockQuizToQuizItem(blockData)

      expect(result.correctAnswer).toBe('A')
    })
  })

  describe('isValidQuizItem', () => {
    it('应返回 true 对于有效的 QuizItem', () => {
      const validItem = {
        questionText: '有效题目',
        options: [{ label: 'A', value: '选项A' }],
      }

      expect(isValidQuizItem(validItem as any)).toBe(true)
    })

    it('应返回 false 对于空题目文本', () => {
      const invalidItem = {
        questionText: '',
        options: [{ label: 'A', value: '选项A' }],
      }

      expect(isValidQuizItem(invalidItem as any)).toBe(false)
    })

    it('应返回 false 对于纯空格的题目文本', () => {
      const invalidItem = {
        questionText: '   ',
        options: [{ label: 'A', value: '选项A' }],
      }

      expect(isValidQuizItem(invalidItem as any)).toBe(false)
    })

    it('应返回 false 对于空选项数组', () => {
      const invalidItem = {
        questionText: '有效题目',
        options: [],
      }

      expect(isValidQuizItem(invalidItem as any)).toBe(false)
    })

    it('应返回 false 对于缺少 questionText 的对象', () => {
      const invalidItem = {
        options: [{ label: 'A', value: '选项A' }],
      }

      expect(isValidQuizItem(invalidItem as any)).toBe(false)
    })

    it('应返回 false 对于缺少 options 的对象', () => {
      const invalidItem = {
        questionText: '有效题目',
      }

      expect(isValidQuizItem(invalidItem as any)).toBe(false)
    })

    it('应安全处理 null 入参，不抛出错误', () => {
      // 新增的 item? 防御性校验：旧实现在入参为 null 时会抛出 TypeError
      expect(() => isValidQuizItem(null as any)).not.toThrow()
      expect(isValidQuizItem(null as any)).toBe(false)
    })

    it('应安全处理 undefined 入参，不抛出错误', () => {
      expect(() => isValidQuizItem(undefined as any)).not.toThrow()
      expect(isValidQuizItem(undefined as any)).toBe(false)
    })

    it('应拒绝非数组类型的 options', () => {
      // 新增的 Array.isArray 校验：旧实现对 options 为字符串/对象等类型会因 .length 检查返回意外结果
      expect(isValidQuizItem({ questionText: '题目', options: 'not-an-array' } as any)).toBe(false)
      expect(isValidQuizItem({ questionText: '题目', options: { length: 5 } } as any)).toBe(false)
      expect(isValidQuizItem({ questionText: '题目', options: null } as any)).toBe(false)
    })

    it('应拒绝 questionText 为 null 或 undefined', () => {
      expect(isValidQuizItem({ questionText: null, options: [{ label: 'A', value: '选项A' }] } as any)).toBe(false)
      expect(isValidQuizItem({ questionText: undefined, options: [{ label: 'A', value: '选项A' }] } as any)).toBe(false)
    })
  })
})