// ============================================================
// 学生信息管理 Service
// 说明：学生相关的业务 API 统一放在 services 层；旧的
//       utils/studentApi.ts 作为 re-export 兼容层存在。
// 学生相关类型统一在 @/types/student 声明。
// ============================================================

import { get, post, put, del, ApiError } from '@/utils/api'
import { useAuthStore, type Role } from '@/stores/auth'
import { getAuthData } from '@/utils/localStorage'
import type {
  StudentInfo,
  CreateStudentParams,
  UpdateStudentParams,
  DeleteStudentResponse,
  BatchDeleteStudentResponse,
  StudentValidationError,
} from '@/types/student'

/**
 * 后端学生记录（/api/admin/students 与 /api/teacher/students 共用列）
 */
interface RawStudentRow {
  id?: number
  student_id: string
  student_name?: string
  class_code?: string
  created_at?: string
}

/**
 * 读取当前登录角色
 * Pinia 尚未安装时回退到持久化登录态（与 utils/api.getAuthHeaders 的兜底策略一致）
 */
function currentRole(): Role | null {
  try {
    return useAuthStore().user?.role ?? null
  } catch {
    return getAuthData().user?.role ?? null
  }
}

/**
 * 学生管理接口前缀
 * 后端已下线 /api/students，按角色分别走：
 * - teacher        → /api/teacher/students（只能操作自己所教班级）
 * - admin/super_admin → /api/admin/students
 */
function studentEndpoint(): { base: string; role: Role } {
  const role = currentRole()
  if (role === 'teacher') return { base: '/api/teacher/students', role }
  if (role === 'admin' || role === 'super_admin') return { base: '/api/admin/students', role }
  throw new ApiError(403, 'FORBIDDEN', '当前角色无权管理学生')
}

/** 班级编码：后端要求 6 位 YYYYCC，数字形态补前导零 */
function toClassCode(classNum: number | undefined): string | undefined {
  if (classNum === undefined || classNum === null) return undefined
  return String(classNum).padStart(6, '0')
}

/**
 * 后端行 → 前端 StudentInfo
 * 后端返回 student_name / class_code（snake_case），视图层仍在用 name / class
 */
function toStudentInfo(row: RawStudentRow): StudentInfo {
  const classNum = row.class_code ? Number(row.class_code) : Number.NaN
  return {
    student_id: row.student_id,
    name: row.student_name ?? '',
    class: Number.isFinite(classNum) ? classNum : undefined,
    created_at: row.created_at,
  }
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
  const { base } = studentEndpoint()

  const classCode = toClassCode(classNum)
  const params = classCode ? { class_code: classCode } : undefined

  const response = await get<RawStudentRow[]>(base, params)
  if (!response.success || !response.data) {
    throw new ApiError(500, 'STUDENTS_UNAVAILABLE', response.message || '学生列表加载失败，请重试')
  }

  const students = response.data.map(toStudentInfo)
  // 默认 asc：后端不保证返回顺序，列表/导出都依赖稳定排序
  students.sort((a, b) => a.student_id.localeCompare(b.student_id, undefined, { numeric: true }))
  if (sortOrder === 'desc') {
    students.reverse()
  }
  return students
}

/**
 * 获取单个学生信息
 * @param studentId - 学号
 *
 * R101: 修复 catch {} 静默吞掉所有错误的问题——
 * 原实现网络错误、超时、服务端 500 都被当作"学生不存在"返回 null，
 * 导致 checkStudentExists 在网络故障时误判学生不存在。
 * 现改为：仅 404（学生不存在）返回 null；其他错误重新抛出由调用方处理。
 */
export async function getStudent(studentId: string): Promise<StudentInfo | null> {
  const { base } = studentEndpoint()
  try {
    const response = await get<RawStudentRow>(`${base}/${encodeURIComponent(studentId)}`)
    if (!response.success || !response.data) {
      throw new ApiError(500, 'STUDENT_UNAVAILABLE', response.message || '学生信息加载失败，请重试')
    }
    return toStudentInfo(response.data)
  } catch (err) {
    // 404 表示学生不存在，返回 null 是语义正确的
    if (err instanceof ApiError && err.status === 404) {
      return null
    }
    // 其他错误（网络故障、超时、5xx 等）向上抛出，避免误判
    throw err
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
    const { base, role } = studentEndpoint()
    // 教师接口只收 student_id + student_name（班级由学号前 6 位推导并校验权限）；
    // 管理员接口额外接受 class_code
    const body: Record<string, unknown> =
      role === 'teacher'
        ? { student_id: params.studentId.trim(), student_name: params.name.trim() }
        : {
            student_id: params.studentId.trim(),
            student_name: params.name.trim(),
            class_code: toClassCode(params.class),
          }

    // 后端新建学生会生成一次性口令且只返回这一次，调用方需要展示它，
    // 否则学生 must_reset_password=1 却没人知道初始密码，等于建了个登不进的账号
    const response = await post<RawStudentRow & { temporary_password?: string }>(base, body)
    if (!response.success) {
      return { success: false, message: response.message || '添加学生失败，请重试' }
    }

    const temporaryPassword = response.data?.temporary_password
    return {
      success: true,
      message: temporaryPassword
        ? `学生添加成功，一次性临时口令：${temporaryPassword}（仅本次显示）`
        : response.message || '学生添加成功',
      // 建库接口不回 student_name，直接用入参组装，避免返回一条 name 为空的学生
      data: {
        student_id: params.studentId.trim(),
        name: params.name.trim(),
        class: params.class,
      },
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
    const { base, role } = studentEndpoint()
    // 教师端只允许改姓名（后端 teacherController.updateStudent 忽略班级）
    const body: Record<string, unknown> =
      role === 'teacher'
        ? { student_name: params.name.trim() }
        : { student_name: params.name.trim(), class_code: toClassCode(params.class) }

    const response = await put<StudentInfo>(
      `${base}/${encodeURIComponent(studentId)}`,
      body,
    )
    if (!response.success) {
      return { success: false, message: response.message || '修改学生信息失败，请重试' }
    }

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
    const { base } = studentEndpoint()
    const response = await del(`${base}/${encodeURIComponent(studentId)}`)
    if (!response.success) {
      return { success: false, message: response.message || '学生删除失败，请重试' }
    }
    return { success: true, message: response.message || '学生删除成功' }
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

  // 后端没有批量删除接口（旧 /api/students/batch-delete 已随旧路由下线），
  // 这里退化为逐个 DELETE，调用方仍可一次删除多条；部分失败时如实回报
  let base: string
  try {
    base = studentEndpoint().base
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '无权删除学生' }
  }

  let deletedCount = 0
  const failures: string[] = []
  for (const id of studentIds) {
    try {
      await del(`${base}/${encodeURIComponent(id)}`)
      deletedCount++
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        failures.push(`${id}: 无权删除`)
      } else {
        failures.push(`${id}: ${err instanceof Error ? err.message : '删除失败'}`)
      }
    }
  }

  if (failures.length > 0) {
    return {
      success: false,
      message: `成功删除 ${deletedCount} 条，失败 ${failures.length} 条（${failures[0]}）`,
      deletedCount,
    }
  }
  return { success: true, message: `成功删除 ${deletedCount} 条学生记录`, deletedCount }
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

// 保持类型兼容：从集中类型文件 re-export，避免外部 import 失效
export type {
  StudentInfo,
  CreateStudentParams,
  UpdateStudentParams,
  DeleteStudentResponse,
  BatchDeleteStudentResponse,
  StudentValidationError,
}
