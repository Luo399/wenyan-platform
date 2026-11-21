import { describe, it, expect, vi, beforeEach } from 'vitest'

// 只替换请求函数，保留真实 ApiError（service 会 new ApiError）
vi.mock('@/utils/api', async () => {
  const actual = await vi.importActual<typeof import('@/utils/api')>('@/utils/api')
  return { ...actual, get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() }
})

import { get, post, put, del, ApiError } from '@/utils/api'
import {
  listTeachers,
  listStudents,
  getTeacher,
  getStudent,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  createStudent,
  updateStudent,
  deleteStudent,
  resetStudentPassword,
  resetTeacherPassword,
} from '@/services/adminService'

const mockGet = vi.mocked(get)
const mockPost = vi.mocked(post)
const mockPut = vi.mocked(put)
const mockDel = vi.mocked(del)

describe('adminService（管理员账密增删查改契约）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('教师', () => {
    it('listTeachers 带 status 时应透传查询参数', async () => {
      mockGet.mockResolvedValue({ success: true, data: [] })
      await listTeachers('pending')
      expect(mockGet).toHaveBeenCalledWith('/api/admin/teachers', { status: 'pending' })
    })

    it('listTeachers 失败应抛 ApiError，而不是返回空数组', async () => {
      mockGet.mockResolvedValue({ success: false, message: '服务异常' })
      await expect(listTeachers()).rejects.toBeInstanceOf(ApiError)
    })

    it('getTeacher 查不到时返回 null', async () => {
      mockGet.mockResolvedValue({ success: false })
      await expect(getTeacher('13800000000')).resolves.toBe(null)
      expect(mockGet).toHaveBeenCalledWith('/api/admin/teachers/13800000000')
    })

    it('createTeacher 应 POST 到教师集合', async () => {
      mockPost.mockResolvedValue({ success: true, message: '已创建' })
      const result = await createTeacher({
        phone: '13800000000',
        name: '王老师',
        password: 'Passw0rd!',
        school_id: 1,
        class_codes: ['202501'],
      })
      expect(mockPost).toHaveBeenCalledWith('/api/admin/teachers', expect.objectContaining({
        phone: '13800000000',
      }))
      expect(result).toEqual({ success: true, message: '已创建' })
    })

    it('updateTeacher / deleteTeacher 应使用 PUT / DELETE 且路径编码', async () => {
      mockPut.mockResolvedValue({ success: true, message: '已更新' })
      mockDel.mockResolvedValue({ success: true, message: '已删除' })

      await updateTeacher('13800000000', { name: '新名字' })
      await deleteTeacher('13800000000')

      expect(mockPut).toHaveBeenCalledWith('/api/admin/teachers/13800000000', { name: '新名字' })
      expect(mockDel).toHaveBeenCalledWith('/api/admin/teachers/13800000000')
    })

    it('写操作 success:false 时应返回失败结果而不是抛错', async () => {
      mockDel.mockResolvedValue({ success: false, message: '教师不存在' })
      const result = await deleteTeacher('13800000000')
      expect(result).toEqual({ success: false, message: '教师不存在' })
    })
  })

  describe('学生', () => {
    it('listStudents 带班级时应透传 class_code', async () => {
      mockGet.mockResolvedValue({ success: true, data: [] })
      await listStudents('202501')
      expect(mockGet).toHaveBeenCalledWith('/api/admin/students', { class_code: '202501' })
    })

    it('getStudent 查不到时返回 null', async () => {
      mockGet.mockResolvedValue({ success: false })
      await expect(getStudent('20250101')).resolves.toBe(null)
    })

    it('createStudent / updateStudent / deleteStudent 应命中对应方法', async () => {
      mockPost.mockResolvedValue({ success: true, message: '已创建' })
      mockPut.mockResolvedValue({ success: true, message: '已更新' })
      mockDel.mockResolvedValue({ success: true, message: '已删除' })

      await createStudent({ student_id: '20250101', student_name: '张三' })
      await updateStudent('20250101', { student_name: '张三丰' })
      await deleteStudent('20250101')

      expect(mockPost).toHaveBeenCalledWith('/api/admin/students', {
        student_id: '20250101',
        student_name: '张三',
      })
      expect(mockPut).toHaveBeenCalledWith('/api/admin/students/20250101', {
        student_name: '张三丰',
      })
      expect(mockDel).toHaveBeenCalledWith('/api/admin/students/20250101')
    })

    it('resetStudentPassword 应返回一次性临时口令', async () => {
      mockPost.mockResolvedValue({
        success: true,
        data: { temporary_password: 'Tmp123456' },
      })
      const result = await resetStudentPassword('20250101')
      expect(mockPost).toHaveBeenCalledWith('/api/admin/students/20250101/reset-password')
      expect(result.success).toBe(true)
      expect(result.message).toContain('Tmp123456')
    })

    it('服务端未返回临时口令时应判失败', async () => {
      mockPost.mockResolvedValue({ success: true, data: {} })
      const result = await resetStudentPassword('20250101')
      expect(result.success).toBe(false)
    })
  })

  describe('教师重置密码', () => {
    it('resetTeacherPassword 命中教师重置路径', async () => {
      mockPost.mockResolvedValue({
        success: true,
        message: '已重置',
        data: { temporary_password: 'Tmp654321' },
      })
      const result = await resetTeacherPassword('13800000000')
      expect(mockPost).toHaveBeenCalledWith('/api/admin/teachers/13800000000/reset-password')
      expect(result.success).toBe(true)
    })
  })
})
