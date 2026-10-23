import { apiGet, apiPost, upload } from '@/utils/api'

/** 教师注册 —— 前端唯一入口（禁止组件内直接 fetch） */
export function teacherRegister(params: {
  phone: string; password: string; name: string
  can_view_all?: boolean; class_codes?: string[]
}) {
  return apiPost<{ success: boolean; message?: string; error?: string }>('/auth/teacher-register', params)
}

export function teacherLogin(phone: string, password: string) {
  return apiPost<{ token?: string; teacher_id?: string; name?: string; error?: string }>('/auth/teacher-login', { phone, password })
}

export function studentLogin(studentId: string, password: string) {
  return apiPost<{ token?: string; student_id?: string; student_name?: string; class_code?: string; error?: string }>('/auth/student-login', { student_id: studentId, password })
}

export function refreshToken(refreshToken: string) {
  return apiPost<{ data?: { accessToken: string } }>('/auth/refresh', { refreshToken })
}

export function changePassword(old_password: string, new_password: string) {
  return apiPost<{ success: boolean; message?: string; error?: string }>('/auth/change-password', { old_password, new_password })
}

export function getMyClasses() {
  return apiGet<string[]>('/teacher/students')
}

export function adminLogin(username: string, password: string) {
  return apiPost<{ token?: string; admin_id?: string; error?: string }>('/auth/admin-login', { username, password })
}

export function aiChat(payload: { messages: Array<{ role: string; content: string }>; wenId: string }) {
  return apiPost<{ reply?: string; quota?: unknown; usage?: unknown; error?: string }>('/ai/chat', payload)
}

export function uploadResource(path: string, formData: FormData) {
  return upload<{ url?: string; key?: string }>(path, formData)
}