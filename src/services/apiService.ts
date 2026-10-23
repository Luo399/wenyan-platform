import { apiGet, apiPost, upload } from '@/utils/api'

/** 教师注册 —— 前端唯一入口（禁止组件内直接 fetch） */
export function teacherRegister(params: {
  email: string
  password: string
  name: string
  can_view_all?: boolean
  class_codes?: string[]
}) {
  return apiPost<{ success: boolean; message?: string; error?: string }>('/auth/teacher-register', params)
}

/** 教师登录 */
export function teacherLogin(email: string, password: string) {
  return apiPost<{ token?: string; teacher_id?: string; name?: string; email?: string; error?: string }>('/auth/teacher-login', { email, password })
}

/** 学生登录 */
export function studentLogin(studentId: string, password: string) {
  return apiPost<{ token?: string; student_id?: string; student_name?: string; class_code?: string; error?: string }>('/auth/student-login', { studentId, password })
}

/** 刷新 access token */
export function refreshToken(refreshToken: string) {
  return apiPost<{ data?: { accessToken: string } }>('/auth/refresh', { refreshToken })
}

/** 修改密码（学生） */
export function changePassword(oldPassword: string, newPassword: string) {
  return apiPost<{ success: boolean; message?: string; error?: string }>('/auth/change-password', { oldPassword, newPassword })
}

/** 修改密码（教师） */
export function teacherChangePassword(oldPassword: string, newPassword: string) {
  return apiPost<{ success: boolean; message?: string; error?: string }>('/auth/teacher-change-password', { oldPassword, newPassword })
}

/** 查询我的班级列表（教师） */
export function getMyClasses() {
  return apiGet<string[]>('/teacher/my-students')
}

/** 管理员登录 */
export function adminLogin(email: string, password: string) {
  return apiPost<{ token?: string; admin_id?: string; error?: string }>('/auth/admin-login', { email, password })
}

/** AI 聊天 */
export function aiChat(payload: {
  messages: Array<{ role: string; content: string }>
  wenId: string
  userId: string
  sessionId: string
  aiRole?: string
  roleName?: string
  roleDesc?: string
  temperature?: number
  maxTokens?: number
}) {
  return apiPost<{ content?: string; quotaExceeded?: boolean }>('/ai/chat', payload)
}

/** 上传资源（图片/音频/视频） */
export function uploadResource(path: string, formData: FormData) {
  return upload<{ url?: string; key?: string }>(path, formData)
}
