// ============================================================
// 教师查看学生完成情况 Service（框架版）
// 统一封装 /api/teacher/completion/* 的调用，避免视图层散落 URL。
// 当前后端返回框架数据（metrics_ready=false 表示统计逻辑尚未接入）。
// ============================================================

import { get } from '@/utils/api'

/** 单个学生的完成情况行（框架字段） */
export interface StudentCompletionRow {
  student_id: string
  student_name: string
  class_code: string
  school_id: number | null
  total_questions: number
  answered_questions: number
  correct_count: number
  accuracy: number
  last_submitted_at: string | null
}

/** 完成情况汇总 */
export interface CompletionSummary {
  student_count: number
  avg_accuracy: number
}

/** 教师完成情况响应体 */
export interface TeacherCompletionResult {
  metrics_ready: boolean
  summary: CompletionSummary
  class_codes?: string[]
  students: StudentCompletionRow[]
}

/**
 * 查询所教班级学生的完成情况
 * @param classCode - 可选，按班级编码过滤（仅能为教师所教班级）
 */
export async function getStudentsCompletion(
  classCode?: string,
): Promise<TeacherCompletionResult> {
  const params = classCode ? { class_code: classCode } : undefined
  const res = await get<TeacherCompletionResult>('/api/teacher/completion/students', params)
  return (
    res.data || {
      metrics_ready: false,
      summary: { student_count: 0, avg_accuracy: 0 },
      students: [],
    }
  )
}
