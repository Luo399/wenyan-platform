import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  validateStudentId,
  validateStudentName,
  getStudent,
  getAllStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  batchDeleteStudents,
  searchStudents,
  checkStudentExists,
} from '@/services/studentService'
import { ApiError } from '@/utils/api'

describe('services/studentService', () => {
  let fetchMock: vi.Mock

  beforeEach(() => {
    setActivePinia(createPinia())
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ============================================================
  // 学号验证（validateStudentId）
  // ============================================================
  describe('validateStudentId', () => {
    it('空值/全空格校验失败', () => {
      expect(validateStudentId('')).toEqual({ valid: false, error: '学号不能为空' })
      expect(validateStudentId('   ')).toEqual({ valid: false, error: '学号不能为空' })
      expect(validateStudentId(null as unknown as string)).toEqual({
        valid: false,
        error: '学号不能为空',
      })
    })

    it('非纯数字校验失败', () => {
      expect(validateStudentId('abc123')).toEqual({ valid: false, error: '学号必须为纯数字' })
      expect(validateStudentId('2024-0001')).toEqual({
        valid: false,
        error: '学号必须为纯数字',
      })
      expect(validateStudentId('学号2024')).toEqual({
        valid: false,
        error: '学号必须为纯数字',
      })
    })

    it('长度 < 4 校验失败', () => {
      expect(validateStudentId('1')).toEqual({ valid: false, error: '学号长度不能少于4位' })
      expect(validateStudentId('12')).toEqual({ valid: false, error: '学号长度不能少于4位' })
      expect(validateStudentId('123')).toEqual({ valid: false, error: '学号长度不能少于4位' })
    })

    it('长度 > 20 校验失败', () => {
      expect(validateStudentId('1'.repeat(21))).toEqual({
        valid: false,
        error: '学号长度不能超过20位',
      })
    })

    it('合法学号校验通过', () => {
      expect(validateStudentId('20240001')).toEqual({ valid: true })
      expect(validateStudentId('1234')).toEqual({ valid: true }) // 4位边界
      expect(validateStudentId('1'.repeat(20))).toEqual({ valid: true }) // 20位边界
      expect(validateStudentId('  20240001  ')).toEqual({ valid: true }) // 前后空格自动trim
    })
  })

  // ============================================================
  // 姓名验证（validateStudentName）
  // ============================================================
  describe('validateStudentName', () => {
    it('空值/全空格校验失败', () => {
      expect(validateStudentName('')).toEqual({ valid: false, error: '姓名不能为空' })
      expect(validateStudentName('   ')).toEqual({ valid: false, error: '姓名不能为空' })
    })

    it('长度 < 2 校验失败', () => {
      expect(validateStudentName('A')).toEqual({
        valid: false,
        error: '姓名长度不能少于2个字符',
      })
    })

    it('长度 > 50 校验失败', () => {
      expect(validateStudentName('A'.repeat(51))).toEqual({
        valid: false,
        error: '姓名长度不能超过50个字符',
      })
    })

    it('包含危险字符 < > " \' & 校验失败', () => {
      expect(validateStudentName('张三<script>')).toEqual({
        valid: false,
        error: '姓名不能包含特殊字符',
      })
      expect(validateStudentName('张三" OR 1=1')).toEqual({
        valid: false,
        error: '姓名不能包含特殊字符',
      })
      expect(validateStudentName("O'Neil")).toEqual({
        valid: false,
        error: '姓名不能包含特殊字符',
      })
      expect(validateStudentName('张三&李四')).toEqual({
        valid: false,
        error: '姓名不能包含特殊字符',
      })
      expect(validateStudentName('<张三>')).toEqual({
        valid: false,
        error: '姓名不能包含特殊字符',
      })
    })

    it('合法姓名校验通过', () => {
      expect(validateStudentName('张三')).toEqual({ valid: true }) // 2位边界
      expect(validateStudentName('欧阳小明')).toEqual({ valid: true })
      expect(validateStudentName('张三·李四')).toEqual({ valid: true }) // 允许·这种非危险字符
      expect(validateStudentName('A'.repeat(50))).toEqual({ valid: true }) // 50位边界
      expect(validateStudentName('  张三  ')).toEqual({ valid: true }) // 前后空格自动trim
    })
  })

  // ============================================================
  // getStudent - R101: 404 与其他错误区分
  // ============================================================
  describe('getStudent (R101: 404 与其他错误区分)', () => {
    it('学生存在时返回学生信息', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: { student_id: '20240001', name: '张三', class: 1 },
        }),
      })

      const result = await getStudent('20240001')
      expect(result).toEqual({ student_id: '20240001', name: '张三', class: 1 })
    })

    it('R101: 404（学生不存在）时返回 null 而非抛错', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValue({ message: '学生不存在' }),
      })

      const result = await getStudent('99999999')
      expect(result).toBeNull()
    })

    it('R101: 非 404 错误（如 500 服务器错误）应向上抛错', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({ message: '数据库异常' }),
      })

      await expect(getStudent('20240001')).rejects.toBeInstanceOf(ApiError)
    })

    it('R101: 网络错误（断网）应向上抛错而非误判为不存在', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'))

      await expect(getStudent('20240001')).rejects.toThrow('Network error')
    })
  })

  describe('checkStudentExists', () => {
    it('学生存在返回 true', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: { student_id: '20240001', name: '张三' },
        }),
      })
      expect(await checkStudentExists('20240001')).toBe(true)
    })

    it('学生不存在返回 false', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValue({ message: '学生不存在' }),
      })
      expect(await checkStudentExists('99999999')).toBe(false)
    })
  })

  // ============================================================
  // getAllStudents - 排序逻辑
  // ============================================================
  describe('getAllStudents', () => {
    const mockStudents = [
      { student_id: '20240003', name: '丙', class: 1 },
      { student_id: '20240001', name: '甲', class: 1 },
      { student_id: '20240002', name: '乙', class: 1 },
    ]

    it('默认按学号升序排序', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true, data: mockStudents }),
      })

      const result = await getAllStudents()
      expect(result.map((s) => s.student_id)).toEqual([
        '20240001',
        '20240002',
        '20240003',
      ])
    })

    it('sortOrder=desc 按学号降序排序', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true, data: mockStudents }),
      })

      const result = await getAllStudents({ sortOrder: 'desc' })
      expect(result.map((s) => s.student_id)).toEqual([
        '20240003',
        '20240002',
        '20240001',
      ])
    })

    it('响应 data 为空时返回空数组', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      })
      expect(await getAllStudents()).toEqual([])
    })
  })

  // ============================================================
  // createStudent / updateStudent / deleteStudent 前端验证逻辑
  // ============================================================
  describe('createStudent - 前端验证前置', () => {
    it('学号非法时不发请求直接返回错误', async () => {
      const result = await createStudent({ studentId: 'abc', name: '张三', class: 1 })
      expect(result.success).toBe(false)
      expect(result.message).toBe('学号必须为纯数字')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('姓名非法时不发请求直接返回错误', async () => {
      const result = await createStudent({
        studentId: '20240001',
        name: '<script>',
        class: 1,
      })
      expect(result.success).toBe(false)
      expect(result.message).toBe('姓名不能包含特殊字符')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('合法参数 + 请求成功返回 success', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          message: '学生添加成功',
          data: { student_id: '20240001', name: '张三' },
        }),
      })
      const result = await createStudent({ studentId: '20240001', name: '张三', class: 1 })
      expect(result.success).toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('updateStudent - 前端验证前置', () => {
    it('学号非法时直接返回错误', async () => {
      const result = await updateStudent('', { name: '张三', class: 1 })
      expect(result.success).toBe(false)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('姓名非法时直接返回错误', async () => {
      const result = await updateStudent('20240001', { name: 'A', class: 1 })
      expect(result.success).toBe(false)
      expect(result.message).toBe('姓名长度不能少于2个字符')
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('deleteStudent - 前端验证前置', () => {
    it('学号非法时直接返回错误', async () => {
      const result = await deleteStudent('abc')
      expect(result.success).toBe(false)
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // batchDeleteStudents
  // ============================================================
  describe('batchDeleteStudents', () => {
    it('空数组不发请求直接返回错误', async () => {
      const result = await batchDeleteStudents([])
      expect(result.success).toBe(false)
      expect(result.message).toBe('请选择要删除的学生')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('包含非法学号时直接返回错误（不发请求）', async () => {
      const result = await batchDeleteStudents(['20240001', 'abc', '20240002'])
      expect(result.success).toBe(false)
      expect(result.message).toContain('abc')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('全部合法 + 请求成功', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: { deletedCount: 3 },
        }),
      })
      const result = await batchDeleteStudents(['20240001', '20240002', '20240003'])
      expect(result.success).toBe(true)
      expect(result.deletedCount).toBe(3)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  // ============================================================
  // searchStudents - 前端筛选
  // ============================================================
  describe('searchStudents', () => {
    const mockStudents = [
      { student_id: '20240001', name: '张三', class: 1 },
      { student_id: '20240002', name: '李四', class: 1 },
      { student_id: '20240003', name: '王五', class: 2 },
    ]

    it('空关键词返回完整列表（提供列表时）', async () => {
      const result = await searchStudents('', mockStudents)
      expect(result).toHaveLength(3)
    })

    it('按学号前缀筛选（不区分大小写）', async () => {
      const result = await searchStudents('20240001', mockStudents)
      expect(result).toHaveLength(1)
      expect(result[0].student_id).toBe('20240001')
    })

    it('按姓名筛选（不区分大小写）', async () => {
      const result = await searchStudents('张', mockStudents)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('张三')
    })

    it('无匹配时返回空数组', async () => {
      const result = await searchStudents('不存在的人', mockStudents)
      expect(result).toEqual([])
    })

    it('未提供学生列表 + 空关键词返回空数组', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true, data: mockStudents }),
      })
      const result = await searchStudents('')
      expect(result).toEqual([])
    })
  })
})
