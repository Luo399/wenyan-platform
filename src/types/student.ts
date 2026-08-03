/**
 * 学生相关类型集中声明（A05）
 *
 * 命名约定：
 *  - StudentInfo: 后端返回/前端服务层通用的学生实体（snake_case 字段）
 *  - StudentInfoState: useStudentInfo 中的本地封装状态（含 loading/error）
 *  - StudentLoginForm / StudentQueryResult 等派生类型按场景加后缀
 */

/** 后端接口返回的学生实体 */
export interface StudentInfo {
  student_id: string
  name: string
  class?: number
  created_at?: string
}

/** 新增学生参数 */
export interface CreateStudentParams {
  studentId: string
  name: string
  class?: number
}

/** 修改学生参数 */
export interface UpdateStudentParams {
  name: string
  class?: number
}

/** useStudentInfo 组合的本地学生状态（并非后端实体） */
export interface StudentInfoState {
  id: string
  name: string
  isLoading: boolean
  error: string | null
}

/** 删除学生响应 */
export interface DeleteStudentResponse {
  studentId: string
}

/** 批量删除学生响应 */
export interface BatchDeleteStudentResponse {
  deletedCount: number
  studentIds: string[]
}

/** 学生表单验证错误 */
export interface StudentValidationError {
  field: string
  message: string
}
