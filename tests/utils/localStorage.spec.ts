import { describe, it, expect, beforeEach } from 'vitest'
import {
  getQuizRecords,
  setQuizRecords,
  appendQuizRecord,
  clearQuizRecords,
} from '@/utils/localStorage'

/** 测试用单题记录类型（模拟 AdaptQuiz 的 record） */
interface SingleRecord {
  questionId: string
  isCorrect: boolean
  score: number
}

/** 测试用整份报告类型（模拟 Level1Quiz 的 report） */
interface QuizReport {
  studentId: string
  totalQuestions: number
  correctCount: number
}

describe('utils/localStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('getQuizRecords', () => {
    it('无记录时返回空数组', () => {
      expect(getQuizRecords<SingleRecord>('S001')).toEqual([])
    })

    it('空 studentId 时返回空数组', () => {
      expect(getQuizRecords<SingleRecord>('')).toEqual([])
    })

    it('正常读取已有记录', () => {
      const records: SingleRecord[] = [
        { questionId: 'Q1', isCorrect: true, score: 100 },
        { questionId: 'Q2', isCorrect: false, score: 0 },
      ]
      localStorage.setItem('quiz_records_S001', JSON.stringify(records))

      expect(getQuizRecords<SingleRecord>('S001')).toEqual(records)
    })

    it('JSON 解析失败时容错返回空数组', () => {
      localStorage.setItem('quiz_records_S001', '{invalid json')
      expect(getQuizRecords<SingleRecord>('S001')).toEqual([])
    })

    it('解析结果非数组时容错返回空数组', () => {
      localStorage.setItem('quiz_records_S001', JSON.stringify({ not: 'array' }))
      expect(getQuizRecords<SingleRecord>('S001')).toEqual([])
    })

    it('不同 studentId 数据相互隔离', () => {
      const recordsA: SingleRecord[] = [
        { questionId: 'Q1', isCorrect: true, score: 100 },
      ]
      const recordsB: QuizReport[] = [
        { studentId: 'S002', totalQuestions: 5, correctCount: 3 },
      ]
      localStorage.setItem('quiz_records_S001', JSON.stringify(recordsA))
      localStorage.setItem('quiz_records_S002', JSON.stringify(recordsB))

      expect(getQuizRecords<SingleRecord>('S001')).toEqual(recordsA)
      expect(getQuizRecords<QuizReport>('S002')).toEqual(recordsB)
    })
  })

  describe('setQuizRecords', () => {
    it('写入空数组', () => {
      setQuizRecords('S001', [])
      expect(localStorage.getItem('quiz_records_S001')).toBe('[]')
    })

    it('正常写入记录数组', () => {
      const records: SingleRecord[] = [
        { questionId: 'Q1', isCorrect: true, score: 100 },
      ]
      setQuizRecords('S001', records)
      expect(localStorage.getItem('quiz_records_S001')).toBe(JSON.stringify(records))
    })

    it('空 studentId 时不写入', () => {
      setQuizRecords('', [{ questionId: 'Q1', isCorrect: true, score: 100 }])
      expect(localStorage.getItem('quiz_records_')).toBeNull()
    })

    it('null 记录降级为空数组写入', () => {
      // 模拟意外传入 null/undefined 的情况
      setQuizRecords<SingleRecord>('S001', null as unknown as SingleRecord[])
      expect(localStorage.getItem('quiz_records_S001')).toBe('[]')
    })

    it('覆盖式更新已有记录', () => {
      const oldRecords: SingleRecord[] = [
        { questionId: 'Q1', isCorrect: true, score: 100 },
      ]
      const newRecords: SingleRecord[] = [
        { questionId: 'Q2', isCorrect: false, score: 0 },
        { questionId: 'Q3', isCorrect: true, score: 100 },
      ]
      setQuizRecords('S001', oldRecords)
      setQuizRecords('S001', newRecords)

      expect(getQuizRecords<SingleRecord>('S001')).toEqual(newRecords)
    })
  })

  describe('appendQuizRecord', () => {
    it('空列表追加返回包含单条记录的数组', () => {
      const record: SingleRecord = { questionId: 'Q1', isCorrect: true, score: 100 }
      const result = appendQuizRecord('S001', record)

      expect(result).toEqual([record])
      expect(getQuizRecords<SingleRecord>('S001')).toEqual([record])
    })

    it('已有列表追加返回追加后的新数组', () => {
      const existing: SingleRecord[] = [
        { questionId: 'Q1', isCorrect: true, score: 100 },
      ]
      localStorage.setItem('quiz_records_S001', JSON.stringify(existing))

      const newRecord: SingleRecord = { questionId: 'Q2', isCorrect: false, score: 0 }
      const result = appendQuizRecord('S001', newRecord)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(existing[0])
      expect(result[1]).toEqual(newRecord)
    })

    it('支持不同类型记录追加（模拟 AdaptQuiz 单题 record）', () => {
      const singleRecord: SingleRecord = {
        questionId: 'WEN_01_level1_q1',
        isCorrect: true,
        score: 100,
      }
      const result = appendQuizRecord('S001', singleRecord)

      expect(result).toEqual([singleRecord])
      expect(getQuizRecords<SingleRecord>('S001')).toEqual([singleRecord])
    })

    it('支持不同类型记录追加（模拟 Level1Quiz 整份 report）', () => {
      const report: QuizReport = {
        studentId: 'S001',
        totalQuestions: 5,
        correctCount: 3,
      }
      const result = appendQuizRecord('S001', report)

      expect(result).toEqual([report])
      expect(getQuizRecords<QuizReport>('S001')).toEqual([report])
    })

    it('脏数据（非数组 JSON）下追加时自动重置为干净数组', () => {
      localStorage.setItem('quiz_records_S001', '{invalid json')
      const record: SingleRecord = { questionId: 'Q1', isCorrect: true, score: 100 }
      const result = appendQuizRecord('S001', record)

      expect(result).toEqual([record])
      expect(getQuizRecords<SingleRecord>('S001')).toEqual([record])
    })

    it('连续追加按顺序保留', () => {
      const r1: SingleRecord = { questionId: 'Q1', isCorrect: true, score: 100 }
      const r2: SingleRecord = { questionId: 'Q2', isCorrect: false, score: 0 }
      const r3: SingleRecord = { questionId: 'Q3', isCorrect: true, score: 100 }

      appendQuizRecord('S001', r1)
      appendQuizRecord('S001', r2)
      const result = appendQuizRecord('S001', r3)

      expect(result).toEqual([r1, r2, r3])
    })
  })

  describe('clearQuizRecords', () => {
    it('清空已有记录', () => {
      const records: SingleRecord[] = [
        { questionId: 'Q1', isCorrect: true, score: 100 },
      ]
      localStorage.setItem('quiz_records_S001', JSON.stringify(records))

      clearQuizRecords('S001')
      expect(localStorage.getItem('quiz_records_S001')).toBeNull()
      expect(getQuizRecords<SingleRecord>('S001')).toEqual([])
    })

    it('清空不存在的记录不报错', () => {
      expect(() => clearQuizRecords('S999')).not.toThrow()
    })

    it('空 studentId 时不操作', () => {
      const records: SingleRecord[] = [
        { questionId: 'Q1', isCorrect: true, score: 100 },
      ]
      // 直接写入空 key（模拟异常情况），验证不会误清
      localStorage.setItem('quiz_records_', JSON.stringify(records))

      clearQuizRecords('')
      expect(localStorage.getItem('quiz_records_')).toEqual(JSON.stringify(records))
    })
  })

  describe('key 命名规范', () => {
    it('使用 quiz_records_<studentId> 前缀', () => {
      setQuizRecords('S001', [{ questionId: 'Q1', isCorrect: true, score: 100 }])
      expect(localStorage.getItem('quiz_records_S001')).not.toBeNull()
      // 确认没有其他多余 key
      const keys = Object.keys(localStorage)
      expect(keys).toEqual(['quiz_records_S001'])
    })
  })
})
