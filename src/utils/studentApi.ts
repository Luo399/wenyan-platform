// ============================================================
// 学生信息管理 API
// ============================================================

import { get, post, put, del, ApiError } from './api'

/**
 * 学生信息接口
 */
export interface StudentInfo {
  student_id: string
  name: string
  class?: number
  created_at?: string
}

/**
 * 新增学生参数
 */
export interface CreateStudentParams {
  studentId: string
  name: string
  class?: number
}

/**
 * 修改学生参数
 */
export interface UpdateStudentParams {
  name: string
  class?: number
}

/**
 * 删除学生响应
 */
export interface DeleteStudentResponse {
  studentId: string
}

/**
 * 批量删除学生响应
 */
export interface BatchDeleteStudentResponse {
  deletedCount: number
  studentIds: string[]
}

/**
 * 学生表单验证错误
 */
export interface StudentValidationError {
  field: string
  message: string
}

/**
 * 学生数据验证函数
 */
export function validateStudentId(studentId: string): { valid: boolean; error?: string } {
  if (!studentId || !studentId.trim()) {
    return { valid: false, error: '学号不能为空' }
  }
  if (!/^\d+$/.test(studentId.trim())) {
    return { valid: false, error: '学号必须为纯数字' }
  }
  if (studentId.trim().length < 4) {
    return { valid: false, error: '学号长度不能少于4位' }
  }
  if (studentId.trim().length > 20) {
    return { valid: false, error: '学号长度不能超过20位' }
  }
  return { valid: true }
}

/**
 * 学生姓名验证函数
 */
export function validateStudentName(name: string): { valid: boolean; error?: string } {
  if (!name || !name.trim()) {
    return { valid: false, error: '姓名不能为空' }
  }
  if (name.trim().length < 2) {
    return { valid: false, error: '姓名长度不能少于2个字符' }
  }
  if (name.trim().length > 50) {
    return { valid: false, error: '姓名长度不能超过50个字符' }
  }
  // 检查是否包含危险字符
  if (/[<>"'&]/.test(name)) {
    return { valid: false, error: '姓名不能包含特殊字符' }
  }
  return { valid: true }
}

/**
 * 获取学生列表（支持按班级筛选）
 * @param options - 可选参数
 * @param options.class - 班级编号（可选）
 * @param options.sortOrder - 排序方式，'asc' 或 'desc'，默认 'asc'
 */
export async function getAllStudents(options?: {
  class?: number
  sortOrder?: 'asc' | 'desc'
}): Promise<StudentInfo[]> {
  const { class: classNum, sortOrder = 'asc' } = options || {}

  let url = '/api/students'
  if (classNum !== undefined && classNum !== null) {
    url += `?class=${classNum}`
  }

  const response = await get<StudentInfo[]>(url)
  if (!response.data) return []

  if (sortOrder === 'desc') {
    return response.data.sort((a, b) =>
      b.student_id.localeCompare(a.student_id, undefined, { numeric: true }),
    )
  }
  return response.data
}

/**
 * 获取单个学生信息
 * @param studentId - 学号
 */
export async function getStudent(studentId: string): Promise<StudentInfo | null> {
  try {
    const response = await get<StudentInfo>(`/api/students/${studentId}`)
    return response.data || null
  } catch {
    return null
  }
}

/**
 * 验证学生是否存在
 * @param studentId - 学号
 */
export async function checkStudentExists(studentId: string): Promise<boolean> {
  const student = await getStudent(studentId)
  return student !== null
}

/**
 * 新增学生
 * @param params - 新增学生参数，包含 studentId, name 和 class
 */
export async function createStudent(
  params: CreateStudentParams,
): Promise<{ success: boolean; message: string; data?: StudentInfo }> {
  // 前端验证
  const idValidation = validateStudentId(params.studentId)
  if (!idValidation.valid) {
    return { success: false, message: idValidation.error! }
  }

  const nameValidation = validateStudentName(params.name)
  if (!nameValidation.valid) {
    return { success: false, message: nameValidation.error! }
  }

  try {
    const response = await post<StudentInfo>('/api/students', {
      studentId: params.studentId.trim(),
      name: params.name.trim(),
      class: params.class,
    })

    return {
      success: true,
      message: response.message || '学生添加成功',
      data: response.data,
    }
  } catch (err) {
    if (err instanceof ApiError) {
      return { success: false, message: err.message }
    }
    return { success: false, message: '添加学生失败，请重试' }
  }
}

/**
 * 修改学生信息
 * @param studentId - 学号
 * @param params - 修改参数，包含 name 和 class
 */
export async function updateStudent(
  studentId: string,
  params: UpdateStudentParams,
): Promise<{ success: boolean; message: string; data?: StudentInfo }> {
  // 前端验证
  const idValidation = validateStudentId(studentId)
  if (!idValidation.valid) {
    return { success: false, message: idValidation.error! }
  }

  const nameValidation = validateStudentName(params.name)
  if (!nameValidation.valid) {
    return { success: false, message: nameValidation.error! }
  }

  try {
    const response = await put<StudentInfo>(`/api/students/${studentId}`, {
      name: params.name.trim(),
      class: params.class,
    })

    return {
      success: true,
      message: response.message || '学生信息修改成功',
      data: response.data,
    }
  } catch (err) {
    if (err instanceof ApiError) {
      return { success: false, message: err.message }
    }
    return { success: false, message: '修改学生信息失败，请重试' }
  }
}

/**
 * 删除学生
 * @param studentId - 学号
 */
export async function deleteStudent(
  studentId: string,
): Promise<{ success: boolean; message: string }> {
  // 前端验证
  const idValidation = validateStudentId(studentId)
  if (!idValidation.valid) {
    return { success: false, message: idValidation.error! }
  }

  try {
    await del(`/api/students/${studentId}`)
    return { success: true, message: '学生删除成功' }
  } catch (err) {
    if (err instanceof ApiError) {
      return { success: false, message: err.message }
    }
    return { success: false, message: '删除学生失败，请重试' }
  }
}

/**
 * 批量删除学生
 * @param studentIds - 学号数组
 */
export async function batchDeleteStudents(
  studentIds: string[],
): Promise<{ success: boolean; message: string; deletedCount?: number }> {
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return { success: false, message: '请选择要删除的学生' }
  }

  // 验证所有学号
  for (const id of studentIds) {
    const validation = validateStudentId(id)
    if (!validation.valid) {
      return { success: false, message: `${id}: ${validation.error}` }
    }
  }

  try {
    const response = await post<BatchDeleteStudentResponse>('/api/students/batch-delete', {
      studentIds,
    })
    return {
      success: true,
      message: `成功删除 ${response.data?.deletedCount || studentIds.length} 条学生记录`,
      deletedCount: response.data?.deletedCount,
    }
  } catch (err) {
    if (err instanceof ApiError) {
      return { success: false, message: err.message }
    }
    return { success: false, message: '批量删除失败，请重试' }
  }
}

/**
 * 搜索学生（支持按学号或姓名搜索）
 * @param keyword - 搜索关键词
 * @param students - 学生列表（可选，用于前端筛选）
 */
export async function searchStudents(
  keyword: string,
  students?: StudentInfo[],
): Promise<StudentInfo[]> {
  if (!keyword || !keyword.trim()) {
    return students || []
  }

  const searchTerm = keyword.trim().toLowerCase()

  // 如果提供了学生列表，在前端筛选
  if (students && students.length > 0) {
    return students.filter(
      (s) =>
        s.student_id.toLowerCase().includes(searchTerm) ||
        s.name.toLowerCase().includes(searchTerm),
    )
  }

  // 否则获取全部再筛选
  const allStudents = await getAllStudents()
  return allStudents.filter(
    (s) =>
      s.student_id.toLowerCase().includes(searchTerm) || s.name.toLowerCase().includes(searchTerm),
  )
}
