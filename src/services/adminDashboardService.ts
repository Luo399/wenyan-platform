// ============================================================
// 管理员数据看板 Service
// 统一封装 /api/admin/dashboard/* 的调用，视图层不出现裸 URL 与裸 fetch。
//
// 与教师看板的字段差异是有意的：
// - overall_accuracy（管理员，按题次汇总：答对题次 / 已答题次）
//   vs avg_accuracy（教师，每个学生正确率的平均）
// 两侧口径不同，名字也不同，避免在同一个屏幕上被当成同一个数读。
// ============================================================

import { get, ApiError } from '@/utils/api'
import type { ApiResponse } from '@/utils/api'

/** 账号与结构计数 */
export interface AdminAccounts {
  teacher_total: number
  teacher_status: { active: number; pending: number; disabled: number; rejected: number }
  pending_teacher_count: number
  student_total: number
  school_count: number
  class_count: number
  admin_count: number
}

/** 使用情况（平台级） */
export interface AdminUsage {
  student_total: number
  answered_student_count: number
  untouched_student_count: number
  activation_rate: number
  overall_accuracy: number
  avg_completion_rate: number
  total_questions_per_student: number
  text_count: number
}

export interface AdminSubmissions {
  total: number
  last_7_days: number
  last_30_days: number
}

export interface AdminActivity {
  dau: number
  wau: number
  mau: number
}

export interface AdminTodos {
  pending_teacher_count: number
  students_on_default_password: number
}

export interface AdminOverviewResult {
  accounts: AdminAccounts
  usage: AdminUsage
  submissions: AdminSubmissions
  activity: AdminActivity
  todos: AdminTodos
}

export interface AdminTrendPoint {
  date: string
  new_students: number
  new_teachers: number
  submissions: number
  active_students: number
}

export interface AdminTrendsResult {
  days: number
  series: AdminTrendPoint[]
  totals: { new_students: number; new_teachers: number; submissions: number }
}

/** 分布维度：班级 / 年级 / 学校 */
export type DistributionDimension = 'class' | 'grade' | 'school'

export interface AdminDistributionGroup {
  key: string
  label: string
  student_count: number
  answered_student_count: number
  active_student_count: number
  /** 窗口内活跃人数 / 该组人数 */
  usage_rate: number
  /** 答过题的人数 / 该组人数 */
  activation_rate: number
  overall_accuracy: number
  avg_completion_rate: number
  submissions: number
  window_days: number
}

export interface AdminDistributionResult {
  dimension: DistributionDimension
  window_days: number
  total_questions: number
  groups: AdminDistributionGroup[]
  /** 一个学生都没答题的分组 key，等于「挂了名但没用」的名单 */
  uncovered: string[]
}

/**
 * 接口返回失败时抛 ApiError（而不是返回全零结构），
 * 让视图能区分「平台确实没用起来」和「看板接口挂了」
 */
function requireData<T>(res: ApiResponse<T>, message: string): T {
  if (!res.success || !res.data) {
    throw new ApiError(500, 'DASHBOARD_UNAVAILABLE', res.message || message)
  }
  return res.data
}

/**
 * 运营概览：账号结构 + 使用总量 + 活跃度 + 待办
 */
export async function getAdminOverview(): Promise<AdminOverviewResult> {
  const res = await get<AdminOverviewResult>('/api/admin/dashboard/overview')
  return requireData(res, '管理员看板概览加载失败，请重试')
}

/**
 * 增长与使用趋势
 */
export async function getAdminTrends(days = 30): Promise<AdminTrendsResult> {
  const res = await get<AdminTrendsResult>('/api/admin/dashboard/trends', { days })
  return requireData(res, '管理员看板趋势加载失败，请重试')
}

/**
 * 结构分布与覆盖率
 * @param windowDays - 活跃窗口（天），影响 usage_rate 分子
 */
export async function getAdminDistribution(
  dimension: DistributionDimension = 'class',
  windowDays = 30,
  limit = 50,
): Promise<AdminDistributionResult> {
  const res = await get<AdminDistributionResult>('/api/admin/dashboard/distribution', {
    dimension,
    window_days: windowDays,
    limit,
  })
  return requireData(res, '结构分布加载失败，请重试')
}
