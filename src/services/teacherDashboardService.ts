// ============================================================
// 教师数据看板 Service
// 统一封装 /api/teacher/dashboard/* 的调用，视图层不出现裸 URL 与裸 fetch。
//
// 类型与 backend/src/controllers/teacherDashboardController.js 的返回体一一对应，
// 后端字段是 snake_case（SQL 聚合直出），这里保持一致以免两侧口径「翻译」出错。
//
// 完成率类指标的分母全部来自后端（题量清单 questionInventory），
// 前端不做「已答 / 总题」的二次计算，避免出现两端分母不一致的完成率。
// ============================================================

import { get } from '@/utils/api'

/** 班级范围（token 决定，前端只能收窄） */
export interface DashboardScope {
  all_access: boolean
  class_codes: string[]
  requested_class_code: string | null
}

/** 单个关卡（A/B/C）的进度统计 */
export interface LevelStat {
  answered: number
  correct: number
  total: number
  accuracy: number
  completion_rate: number
}

/** 学生三关进度；other 收的是题号无法识别关卡的历史数据 */
export interface StudentLevels {
  A: LevelStat
  B: LevelStat
  C: LevelStat
  other: LevelStat
}

/** 学生明细行 */
export interface DashboardStudent {
  student_id: string
  student_name: string
  class_code: string
  answered_questions: number
  correct_questions: number
  accuracy: number
  total_questions: number
  completion_rate: number
  last_submitted_at: string | null
  /** 距最近一次提交的天数；从未提交为 null */
  stalled_days: number | null
  never_started: boolean
  is_active_7d: boolean
  levels: StudentLevels
}

/** 概览卡片指标 */
export interface TeacherOverviewSummary {
  class_count: number
  student_count: number
  answered_student_count: number
  untouched_student_count: number
  active_students_7d: number
  submissions_total: number
  submissions_7d: number
  avg_accuracy: number
  avg_completion_rate: number
  total_questions: number
  text_count: number
  level_totals: { A: number; B: number; C: number }
}

/** 班级汇总行 */
export interface TeacherClassRow {
  class_code: string
  student_count: number
  answered_student_count: number
  untouched_student_count: number
  active_students_7d: number
  avg_accuracy: number
  avg_completion_rate: number
}

/** 篇目 × 班级矩阵的单元格 */
export interface TextMatrixCell {
  class_code: string
  student_count: number
  answered_students: number
  completed_students: number
  accuracy: number
  /** 班内人均该篇完成比例 0~100，热力图色深 */
  avg_progress: number
  started_rate: number
  completed_rate: number
}

/** 篇目 × 班级矩阵的行 */
export interface TextMatrixRow {
  wen_id: string
  title: string
  author: string
  dynasty: string
  levels: { A: number; B: number; C: number }
  total_questions: number
  cells: TextMatrixCell[]
}

/** 薄弱题行 */
export interface WeakQuestionRow {
  wen_id: string
  title: string
  question_id: string
  level: 'A' | 'B' | 'C' | null
  attempted_students: number
  correct_students: number
  accuracy: number
  top_wrong_answers: { answer: string; count: number }[]
}

export interface DailyActivityPoint {
  date: string
  submissions: number
  active_students: number
}

export interface HourlyActivityBucket {
  hour: number
  submissions: number
}

export interface Pagination {
  page: number
  page_size: number
  total: number
  total_pages: number
}

/** 学生明细查询参数 */
export interface StudentQuery {
  class_code?: string
  keyword?: string
  sort?: 'student_id' | 'accuracy' | 'completion_rate' | 'answered_questions' | 'last_submitted_at' | 'stalled_days'
  order?: 'asc' | 'desc'
  page?: number
  page_size?: number
}

export interface TeacherOverviewResult {
  scope: DashboardScope
  summary: TeacherOverviewSummary
  classes: TeacherClassRow[]
}

export interface TeacherTextMatrixResult {
  scope: DashboardScope
  classes: string[]
  rows: TextMatrixRow[]
}

export interface TeacherStudentsResult {
  scope: DashboardScope
  summary: {
    student_count: number
    answered_student_count: number
    untouched_student_count: number
    active_students_7d: number
    submissions_7d: number
  }
  pagination: Pagination
  students: DashboardStudent[]
}

export interface TeacherWeakQuestionsResult {
  scope: DashboardScope
  questions: WeakQuestionRow[]
}

export interface TeacherActivityResult {
  scope: DashboardScope
  days: number
  daily: DailyActivityPoint[]
  hourly: HourlyActivityBucket[]
  totals: { submissions: number; peak_date: string | null; peak_hour: number | null }
}

/** 空概览结构：接口异常或未开学时用零值渲染，页面不出现 undefined */
function emptySummary(): TeacherOverviewSummary {
  return {
    class_count: 0,
    student_count: 0,
    answered_student_count: 0,
    untouched_student_count: 0,
    active_students_7d: 0,
    submissions_total: 0,
    submissions_7d: 0,
    avg_accuracy: 0,
    avg_completion_rate: 0,
    total_questions: 0,
    text_count: 0,
    level_totals: { A: 0, B: 0, C: 0 },
  }
}

function scopeParams(classCode?: string): Record<string, string> | undefined {
  return classCode ? { class_code: classCode } : undefined
}

/**
 * 概览卡片 + 班级汇总
 */
export async function getTeacherOverview(classCode?: string): Promise<TeacherOverviewResult> {
  const res = await get<TeacherOverviewResult>('/api/teacher/dashboard/overview', scopeParams(classCode))
  return res.data || { scope: { all_access: false, class_codes: [], requested_class_code: null }, summary: emptySummary(), classes: [] }
}

/**
 * 篇目 × 班级完成矩阵
 */
export async function getTeacherTextMatrix(classCode?: string): Promise<TeacherTextMatrixResult> {
  const res = await get<TeacherTextMatrixResult>('/api/teacher/dashboard/texts', scopeParams(classCode))
  return res.data || { scope: { all_access: false, class_codes: [], requested_class_code: null }, classes: [], rows: [] }
}

/**
 * 学生明细（分页 + 排序 + 关键字）
 */
export async function getTeacherStudents(
  query: StudentQuery = {},
): Promise<TeacherStudentsResult> {
  const pageSize = query.page_size ?? 20
  const params: Record<string, string | number> = {
    page: query.page ?? 1,
    page_size: pageSize,
    sort: query.sort ?? 'student_id',
    order: query.order ?? 'asc',
  }
  if (query.class_code) params.class_code = query.class_code
  if (query.keyword) params.keyword = query.keyword
  const res = await get<TeacherStudentsResult>('/api/teacher/dashboard/students', params)
  return (
    res.data || {
      scope: { all_access: false, class_codes: [], requested_class_code: null },
      summary: { student_count: 0, answered_student_count: 0, untouched_student_count: 0, active_students_7d: 0, submissions_7d: 0 },
      pagination: { page: 1, page_size: pageSize, total: 0, total_pages: 1 },
      students: [],
    }
  )
}

/**
 * 薄弱题 Top N
 * @param minStudents - 至少多少人作答才纳入（覆盖太少的题正确率没有意义）
 */
export async function getTeacherWeakQuestions(
  classCode?: string,
  minStudents = 2,
  limit = 10,
): Promise<TeacherWeakQuestionsResult> {
  const params: Record<string, string | number> = { min_students: minStudents, limit }
  if (classCode) params.class_code = classCode
  const res = await get<TeacherWeakQuestionsResult>('/api/teacher/dashboard/weak-questions', params)
  return res.data || { scope: { all_access: false, class_codes: [], requested_class_code: null }, questions: [] }
}

/**
 * 活跃趋势：按日提交 + 24 小时分布
 */
export async function getTeacherActivity(classCode?: string, days = 30): Promise<TeacherActivityResult> {
  const params: Record<string, string | number> = { days }
  if (classCode) params.class_code = classCode
  const res = await get<TeacherActivityResult>('/api/teacher/dashboard/activity', params)
  return (
    res.data || {
      scope: { all_access: false, class_codes: [], requested_class_code: null },
      days,
      daily: [],
      hourly: [],
      totals: { submissions: 0, peak_date: null, peak_hour: null },
    }
  )
}
