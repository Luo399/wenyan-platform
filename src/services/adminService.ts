// ============================================================
// 管理员账号管理 Service
// 统一封装 /api/admin/* 的教师 / 学生账号 CRUD 调用，
// 避免在视图组件里散落 URL 与错误处理逻辑。
// ============================================================

import { get, post, put, del } from '@/utils/api'

/** 管理员视角的教师实体 */
export interface AdminTeacher {
  id: number
  phone: string
  name: string
  school_id: number | null
  school_name?: string
  status: 'active' | 'disabled'
  class_codes: string[]
  created_at?: string
  updated_at?: string
}

/** 管理员视角的学生实体 */
export interface AdminStudent {
  id: number
  student_id: string
  student_name: string
  class_code: string
  school_id: number | null
  school_name?: string
  must_reset_password?: number
  created_by?: string
  created_at?: string
  updated_at?: string
}

/** 新增教师参数 */
export interface CreateTeacherParams {
  phone: string
  name: string
  password: string
  school_id: number
  class_codes: string[]
}

/** 更新教师参数 */
export interface UpdateTeacherParams {
  name?: string
  school_id?: number
  status?: 'active' | 'disabled'
  class_codes?: string[]
}

/** 新增学生参数 */
export interface CreateStudentParams {
  student_id: string
  student_name: string
  class_code?: string
}

/** 更新学生参数 */
export interface UpdateStudentParams {
  student_name?: string
  class_code?: string
  school_id?: number
}

/** 统一返回结构 */
export interface AdminActionResult<T = unknown> {
  success: boolean
  message: string
  data?: T
}

/** 把异常统一转换为可展示的结果 */
function toResult<T>(err: unknown, fallback: string): AdminActionResult<T> {
  return { success: false, message: err instanceof Error ? err.message : fallback }
}

// ===== 教师 =====

/** 查询全部教师 */
export async function listTeachers(): Promise<AdminTeacher[]> {
  const res = await get<AdminTeacher[]>('/api/admin/teachers')
  return res.data || []
}

/** 查询单个教师 */
export async function getTeacher(phone: string): Promise<AdminTeacher | null> {
  const res = await get<AdminTeacher>(`/api/admin/teachers/${encodeURIComponent(phone)}`)
  return res.data || null
}

/** 新增教师 */
export async function createTeacher(
  params: CreateTeacherParams,
): Promise<AdminActionResult> {
  try {
    const res = await post('/api/admin/teachers', params)
    return { success: true, message: res.message || '教师账号创建成功' }
  } catch (err) {
    return toResult(err, '创建教师失败')
  }
}

/** 更新教师 */
export async function updateTeacher(
  phone: string,
  params: UpdateTeacherParams,
): Promise<AdminActionResult> {
  try {
    const res = await put(`/api/admin/teachers/${encodeURIComponent(phone)}`, params)
    return { success: true, message: res.message || '教师账号已更新' }
  } catch (err) {
    return toResult(err, '更新教师失败')
  }
}

/** 删除教师 */
export async function deleteTeacher(phone: string): Promise<AdminActionResult> {
  try {
    const res = await del(`/api/admin/teachers/${encodeURIComponent(phone)}`)
    return { success: true, message: res.message || '教师账号已删除' }
  } catch (err) {
    return toResult(err, '删除教师失败')
  }
}

// ===== 学生 =====

/** 查询全部学生（可按班级筛选） */
export async function listStudents(classCode?: string): Promise<AdminStudent[]> {
  const params = classCode ? { class_code: classCode } : undefined
  const res = await get<AdminStudent[]>('/api/admin/students', params)
  return res.data || []
}

/** 查询单个学生 */
export async function getStudent(studentId: string): Promise<AdminStudent | null> {
  const res = await get<AdminStudent>(`/api/admin/students/${encodeURIComponent(studentId)}`)
  return res.data || null
}

/** 新增学生 */
export async function createStudent(
  params: CreateStudentParams,
): Promise<AdminActionResult> {
  try {
    const res = await post('/api/admin/students', params)
    return { success: true, message: res.message || '学生账号创建成功' }
  } catch (err) {
    return toResult(err, '创建学生失败')
  }
}

/** 更新学生 */
export async function updateStudent(
  studentId: string,
  params: UpdateStudentParams,
): Promise<AdminActionResult> {
  try {
    const res = await put(`/api/admin/students/${encodeURIComponent(studentId)}`, params)
    return { success: true, message: res.message || '学生信息已更新' }
  } catch (err) {
    return toResult(err, '更新学生失败')
  }
}

/** 删除学生 */
export async function deleteStudent(studentId: string): Promise<AdminActionResult> {
  try {
    const res = await del(`/api/admin/students/${encodeURIComponent(studentId)}`)
    return { success: true, message: res.message || '学生账号已删除' }
  } catch (err) {
    return toResult(err, '删除学生失败')
  }
}

/** 重置学生密码为 123456 */
export async function resetStudentPassword(studentId: string): Promise<AdminActionResult> {
  try {
    const res = await post(
      `/api/admin/students/${encodeURIComponent(studentId)}/reset-password`,
    )
    return { success: true, message: res.message || '密码已重置为 123456' }
  } catch (err) {
    return toResult(err, '重置学生密码失败')
  }
}

/** 重置教师密码（返回临时密码） */
export async function resetTeacherPassword(
  phone: string,
): Promise<AdminActionResult<{ temporary_password: string }>> {
  try {
    const res = await post<{ temporary_password: string }>(
      `/api/admin/teachers/${encodeURIComponent(phone)}/reset-password`,
    )
    return {
      success: true,
      message: res.message || '教师密码已重置',
      data: res.data,
    }
  } catch (err) {
    return toResult(err, '重置教师密码失败')
  }
}
