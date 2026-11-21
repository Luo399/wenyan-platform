// ============================================================
// 教师查看学生完成情况 Service
// 统一封装 /api/teacher/completion/* 的调用，避免视图层散落 URL；
// 响应先经 adapters/completionAdapter 归一化，视图只消费稳定结构。
// ============================================================

import { get, ApiError } from '@/utils/api'
import {
  adaptTeacherCompletion,
  type TeacherCompletionResult,
} from '@/adapters/completionAdapter'

export type {
  StudentCompletionRow,
  CompletionSummary,
  TeacherCompletionResult,
} from '@/adapters/completionAdapter'

/**
 * 查询所教班级学生的完成情况
 * @param classCode - 可选，按班级编码过滤（仅能为教师所教班级）
 */
export async function getStudentsCompletion(
  classCode?: string,
): Promise<TeacherCompletionResult> {
  const params = classCode ? { class_code: classCode } : undefined
  const res = await get<unknown>('/api/teacher/completion/students', params)
  if (!res.success || !res.data) {
    throw new ApiError(500, 'COMPLETION_UNAVAILABLE', res.message || '完成情况加载失败，请重试')
  }
  return adaptTeacherCompletion(res.data)
}
