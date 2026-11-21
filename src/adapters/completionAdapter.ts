/**
 * 教师「学生完成情况」数据适配层
 *
 * 职责边界：把后端 GET /api/teacher/completion/students 的原始 JSON
 * 归一化为视图可直接消费的结构。后端字段缺失或类型不符时给出安全默认值，
 * 避免视图层出现 NaN / undefined；视图组件不直接消费原始响应。
 *
 * 说明：本模块是纯函数，不发起请求，也不依赖 Vue / Pinia，便于单测。
 */

/** 单个学生的完成情况行 */
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

/** 取出对象形态的原始值，非对象一律按空对象处理 */
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

/** 数值兜底：非有限数一律回落到 fallback */
function toFiniteNumber(value: unknown, fallback = 0): number {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : fallback
}

/** 字符串兜底：非字符串一律空串 */
function toSafeText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** 可空字符串：空串 / 非字符串一律 null，避免前端渲染出 unknown */
function toNullableText(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

/** 单行归一化 */
export function adaptStudentCompletionRow(raw: unknown): StudentCompletionRow {
  const row = asRecord(raw)
  const schoolId = row.school_id
  return {
    student_id: toSafeText(row.student_id),
    student_name: toSafeText(row.student_name),
    class_code: toSafeText(row.class_code),
    school_id: schoolId === null || schoolId === undefined ? null : toFiniteNumber(schoolId),
    total_questions: toFiniteNumber(row.total_questions),
    answered_questions: toFiniteNumber(row.answered_questions),
    correct_count: toFiniteNumber(row.correct_count),
    accuracy: toFiniteNumber(row.accuracy),
    last_submitted_at: toNullableText(row.last_submitted_at),
  }
}

/** 汇总归一化 */
function adaptSummary(raw: unknown): CompletionSummary {
  const summary = asRecord(raw)
  return {
    student_count: toFiniteNumber(summary.student_count),
    avg_accuracy: toFiniteNumber(summary.avg_accuracy),
  }
}

/**
 * 整体归一化
 *
 * - metrics_ready 只在后端明确返回 true 时为真（缺省按「统计未接入」处理）
 * - students 非数组时返回空数组，class_codes 非数组时不下发该字段
 */
export function adaptTeacherCompletion(raw: unknown): TeacherCompletionResult {
  const data = asRecord(raw)
  const students = Array.isArray(data.students)
    ? data.students.map((item) => adaptStudentCompletionRow(item))
    : []
  const classCodes = Array.isArray(data.class_codes)
    ? data.class_codes.map((item) => toSafeText(item)).filter((code) => code !== '')
    : undefined
  return {
    metrics_ready: data.metrics_ready === true,
    summary: adaptSummary(data.summary),
    ...(classCodes ? { class_codes: classCodes } : {}),
    students,
  }
}
