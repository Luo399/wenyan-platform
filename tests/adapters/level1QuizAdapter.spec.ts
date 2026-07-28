import { describe, it, expect } from 'vitest'
import {
  adaptLevel1Quiz,
  getLevel1QuizByQuestionNumber,
  getAllLevel1Quizzes,
  type RawLevel1QuizItem,
  type ProcessedLevel1QuizItem,
} from '@/adapters/level1QuizAdapter'

describe('level1QuizAdapter', () => {
  describe('adaptLevel1Quiz', () => {
    it('应该正确转换原始数据', () => {
      const rawData: RawLevel1QuizItem[] = [
        {
          text_id: 'WEN_01',
          question_number: 1,
          question_text: '这是第一道题？',
          option_a: '选项A',
          option_b: '选项B',
          option_c: '选项C',
          option_d: '选项D',
          audio_file: 'audio.mp3',
          difficulty: 'L1',
          correct_answer: 'A',
          explanation: '解析内容',
          question_type: 'radio',
        },
      ]

      const result = adaptLevel1Quiz(rawData)

      expect(result.length).toBe(1)
      expect(result[0].textId).toBe('WEN_01')
      expect(result[0].questionId).toBe('WEN_01_A1')
      expect(result[0].module).toBe('A')
      expect(result[0].questionNumber).toBe(1)
      expect(result[0].questionText).toBe('这是第一道题？')
      expect(result[0].options.length).toBe(4)
      expect(result[0].options[0]).toEqual({ label: 'A', value: '选项A' })
      expect(result[0].options[1]).toEqual({ label: 'B', value: '选项B' })
      expect(result[0].audioFile).toBe('audio.mp3')
      expect(result[0].difficulty).toBe('L1')
      expect(result[0].correctAnswer).toBe('A')
      expect(result[0].explanation).toBe('解析内容')
      expect(result[0].questionType).toBe('radio')
    })

    it('应该处理空数据', () => {
      const result = adaptLevel1Quiz(null)

      expect(result).toEqual([])
    })

    it('应该处理空数组', () => {
      const result = adaptLevel1Quiz([])

      expect(result).toEqual([])
    })

    it('应该过滤缺少text_id的项', () => {
      const rawData: RawLevel1QuizItem[] = [
        {
          text_id: null,
          question_number: 1,
          question_text: '无效题目',
          option_a: 'A',
          option_b: 'B',
          option_c: 'C',
          option_d: 'D',
          audio_file: null,
          difficulty: null,
          correct_answer: null,
          explanation: null,
          question_type: null,
        },
        {
          text_id: 'WEN_01',
          question_number: 1,
          question_text: '有效题目',
          option_a: 'A',
          option_b: 'B',
          option_c: 'C',
          option_d: 'D',
          audio_file: null,
          difficulty: null,
          correct_answer: null,
          explanation: null,
          question_type: null,
        },
      ]

      const result = adaptLevel1Quiz(rawData)

      expect(result.length).toBe(1)
      expect(result[0].questionText).toBe('有效题目')
    })

    it('应该过滤缺少question_text的项', () => {
      const rawData: RawLevel1QuizItem[] = [
        {
          text_id: 'WEN_01',
          question_number: 1,
          question_text: '',
          option_a: 'A',
          option_b: 'B',
          option_c: 'C',
          option_d: 'D',
          audio_file: null,
          difficulty: null,
          correct_answer: null,
          explanation: null,
          question_type: null,
        },
        {
          text_id: 'WEN_01',
          question_number: 2,
          question_text: '有效题目',
          option_a: 'A',
          option_b: 'B',
          option_c: 'C',
          option_d: 'D',
          audio_file: null,
          difficulty: null,
          correct_answer: null,
          explanation: null,
          question_type: null,
        },
      ]

      const result = adaptLevel1Quiz(rawData)

      expect(result.length).toBe(1)
      expect(result[0].questionText).toBe('有效题目')
    })

    it('应该为缺失字段提供默认值', () => {
      const rawData: RawLevel1QuizItem[] = [
        {
          text_id: 'WEN_01',
          question_number: null,
          question_text: '测试题',
          option_a: null,
          option_b: null,
          option_c: null,
          option_d: null,
          audio_file: null,
          difficulty: null,
          correct_answer: null,
          explanation: null,
          question_type: null,
        },
      ]

      const result = adaptLevel1Quiz(rawData)

      expect(result[0].questionNumber).toBe(0)
      expect(result[0].options[0].value).toBe('')
      expect(result[0].audioFile).toBe(null)
      expect(result[0].difficulty).toBe('L1')
      expect(result[0].correctAnswer).toBe(null)
      expect(result[0].explanation).toBe('')
      expect(result[0].questionType).toBe('radio')
    })

    it('应该正确生成questionId', () => {
      const rawData: RawLevel1QuizItem[] = [
        {
          text_id: 'WEN_01',
          question_number: 1,
          question_text: '第1题',
          option_a: 'A',
          option_b: 'B',
          option_c: 'C',
          option_d: 'D',
          audio_file: null,
          difficulty: null,
          correct_answer: null,
          explanation: null,
          question_type: null,
        },
        {
          text_id: 'WEN_01',
          question_number: 2,
          question_text: '第2题',
          option_a: 'A',
          option_b: 'B',
          option_c: 'C',
          option_d: 'D',
          audio_file: null,
          difficulty: null,
          correct_answer: null,
          explanation: null,
          question_type: null,
        },
      ]

      const result = adaptLevel1Quiz(rawData)

      expect(result[0].questionId).toBe('WEN_01_A1')
      expect(result[1].questionId).toBe('WEN_01_A2')
    })

    it('应该正确处理多个题目', () => {
      const rawData: RawLevel1QuizItem[] = [
        {
          text_id: 'WEN_01',
          question_number: 1,
          question_text: '第1题',
          option_a: 'A',
          option_b: 'B',
          option_c: 'C',
          option_d: 'D',
          audio_file: null,
          difficulty: 'L1',
          correct_answer: 'A',
          explanation: '解析1',
          question_type: 'radio',
        },
        {
          text_id: 'WEN_01',
          question_number: 2,
          question_text: '第2题',
          option_a: 'A',
          option_b: 'B',
          option_c: 'C',
          option_d: 'D',
          audio_file: null,
          difficulty: 'L2',
          correct_answer: 'B',
          explanation: '解析2',
          question_type: 'radio',
        },
        {
          text_id: 'WEN_01',
          question_number: 3,
          question_text: '第3题',
          option_a: 'A',
          option_b: 'B',
          option_c: 'C',
          option_d: 'D',
          audio_file: null,
          difficulty: 'L3',
          correct_answer: 'C',
          explanation: '解析3',
          question_type: 'radio',
        },
      ]

      const result = adaptLevel1Quiz(rawData)

      expect(result.length).toBe(3)
      expect(result[0].difficulty).toBe('L1')
      expect(result[1].difficulty).toBe('L2')
      expect(result[2].difficulty).toBe('L3')
    })
  })

  describe('getLevel1QuizByQuestionNumber', () => {
    it('应该根据题号找到题目', () => {
      const data: ProcessedLevel1QuizItem[] = [
        {
          textId: 'WEN_01',
          questionId: 'Q1',
          module: 'A',
          questionNumber: 1,
          questionText: '第1题',
          options: [{ label: 'A', value: 'A' }],
          audioFile: null,
          difficulty: 'L1',
          correctAnswer: 'A',
          explanation: '',
          questionType: 'radio',
        },
        {
          textId: 'WEN_01',
          questionId: 'Q2',
          module: 'A',
          questionNumber: 2,
          questionText: '第2题',
          options: [{ label: 'A', value: 'A' }],
          audioFile: null,
          difficulty: 'L1',
          correctAnswer: 'B',
          explanation: '',
          questionType: 'radio',
        },
      ]

      const result = getLevel1QuizByQuestionNumber(data, 2)

      expect(result).not.toBeNull()
      expect(result?.questionText).toBe('第2题')
      expect(result?.correctAnswer).toBe('B')
    })

    it('找不到时应该返回null', () => {
      const data: ProcessedLevel1QuizItem[] = [
        {
          textId: 'WEN_01',
          questionId: 'Q1',
          module: 'A',
          questionNumber: 1,
          questionText: '第1题',
          options: [{ label: 'A', value: 'A' }],
          audioFile: null,
          difficulty: 'L1',
          correctAnswer: 'A',
          explanation: '',
          questionType: 'radio',
        },
      ]

      const result = getLevel1QuizByQuestionNumber(data, 99)

      expect(result).toBe(null)
    })

    it('应该处理空数组', () => {
      const result = getLevel1QuizByQuestionNumber([], 1)

      expect(result).toBe(null)
    })
  })

  describe('getAllLevel1Quizzes', () => {
    it('应该返回所有题目', () => {
      const data: ProcessedLevel1QuizItem[] = [
        {
          textId: 'WEN_01',
          questionId: 'Q1',
          module: 'A',
          questionNumber: 1,
          questionText: '第1题',
          options: [{ label: 'A', value: 'A' }],
          audioFile: null,
          difficulty: 'L1',
          correctAnswer: 'A',
          explanation: '',
          questionType: 'radio',
        },
        {
          textId: 'WEN_01',
          questionId: 'Q2',
          module: 'A',
          questionNumber: 2,
          questionText: '第2题',
          options: [{ label: 'A', value: 'A' }],
          audioFile: null,
          difficulty: 'L1',
          correctAnswer: 'B',
          explanation: '',
          questionType: 'radio',
        },
      ]

      const result = getAllLevel1Quizzes(data)

      expect(result.length).toBe(2)
      expect(result[0].questionId).toBe('Q1')
      expect(result[1].questionId).toBe('Q2')
    })

    it('应该返回新数组而不是原数组引用', () => {
      const data: ProcessedLevel1QuizItem[] = [
        {
          textId: 'WEN_01',
          questionId: 'Q1',
          module: 'A',
          questionNumber: 1,
          questionText: '第1题',
          options: [{ label: 'A', value: 'A' }],
          audioFile: null,
          difficulty: 'L1',
          correctAnswer: 'A',
          explanation: '',
          questionType: 'radio',
        },
      ]

      const result = getAllLevel1Quizzes(data)

      expect(result).not.toBe(data)
      expect(result[0]).toBe(data[0])
    })

    it('应该处理空数组', () => {
      const result = getAllLevel1Quizzes([])

      expect(result).toEqual([])
    })
  })
})