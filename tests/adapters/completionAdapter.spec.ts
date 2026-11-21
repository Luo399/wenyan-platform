import { describe, it, expect } from 'vitest'
import {
  adaptStudentCompletionRow,
  adaptTeacherCompletion,
} from '@/adapters/completionAdapter'

describe('completionAdapter', () => {
  describe('adaptStudentCompletionRow', () => {
    it('完整字段应原样保留', () => {
      const row = adaptStudentCompletionRow({
        student_id: '20250101',
        student_name: '张三',
        class_code: '202501',
        school_id: 1,
        total_questions: 10,
        answered_questions: 6,
        correct_count: 4,
        accuracy: 66.7,
        last_submitted_at: '2026-11-20T10:00:00.000Z',
      })
      expect(row).toEqual({
        student_id: '20250101',
        student_name: '张三',
        class_code: '202501',
        school_id: 1,
        total_questions: 10,
        answered_questions: 6,
        correct_count: 4,
        accuracy: 66.7,
        last_submitted_at: '2026-11-20T10:00:00.000Z',
      })
    })

    it('缺字段时应给安全默认值', () => {
      const row = adaptStudentCompletionRow({})
      expect(row.student_id).toBe('')
      expect(row.student_name).toBe('')
      expect(row.class_code).toBe('')
      expect(row.school_id).toBe(null)
      expect(row.total_questions).toBe(0)
      expect(row.answered_questions).toBe(0)
      expect(row.correct_count).toBe(0)
      expect(row.accuracy).toBe(0)
      expect(row.last_submitted_at).toBe(null)
    })

    it('字符串数字应转成 number，非法数字回落 0', () => {
      const row = adaptStudentCompletionRow({
        total_questions: '12',
        answered_questions: 'abc',
        accuracy: '88.5',
      })
      expect(row.total_questions).toBe(12)
      expect(row.answered_questions).toBe(0)
      expect(row.accuracy).toBe(88.5)
    })

    it('非对象入参不应抛错', () => {
      expect(adaptStudentCompletionRow(null).student_id).toBe('')
      expect(adaptStudentCompletionRow('bad').total_questions).toBe(0)
    })
  })

  describe('adaptTeacherCompletion', () => {
    it('学生数组与汇总应逐行归一化', () => {
      const result = adaptTeacherCompletion({
        metrics_ready: true,
        summary: { student_count: 2, avg_accuracy: 75 },
        class_codes: ['202501', '', '202502'],
        students: [
          { student_id: '20250101', student_name: '张三', accuracy: 80 },
          { student_id: '20250102', student_name: '李四', accuracy: 70 },
        ],
      })
      expect(result.metrics_ready).toBe(true)
      expect(result.summary).toEqual({ student_count: 2, avg_accuracy: 75 })
      expect(result.class_codes).toEqual(['202501', '202502'])
      expect(result.students).toHaveLength(2)
      expect(result.students[0]?.student_name).toBe('张三')
    })

    it('students 非数组时返回空数组', () => {
      expect(adaptTeacherCompletion({ students: 'bad' }).students).toEqual([])
      expect(adaptTeacherCompletion({}).students).toEqual([])
    })

    it('metrics_ready 只在明确为 true 时为真', () => {
      expect(adaptTeacherCompletion({ metrics_ready: true }).metrics_ready).toBe(true)
      expect(adaptTeacherCompletion({ metrics_ready: 'true' }).metrics_ready).toBe(false)
      expect(adaptTeacherCompletion({}).metrics_ready).toBe(false)
    })

    it('summary 缺失时汇总归零', () => {
      expect(adaptTeacherCompletion({}).summary).toEqual({ student_count: 0, avg_accuracy: 0 })
    })

    it('class_codes 非数组时不下发该字段', () => {
      expect('class_codes' in adaptTeacherCompletion({})).toBe(false)
    })
  })
})
