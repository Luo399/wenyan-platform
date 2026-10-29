import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AnswerQueryView from '@/views/AnswerQueryView.vue'
import { get, batchPost } from '@/utils/api'
import {
  createStudent,
  updateStudent,
  deleteStudent,
  getAllStudents,
} from '@/services/studentService'
import { resetTeacherPassword } from '@/services/adminService'
import { useAuthStore } from '@/stores/auth'
import { formatDate, formatAnswer } from '@/utils/format'

// 视图现在直接从 services/studentService 导入（旧的 utils/studentApi 只是 re-export 兼容层），
// 因此 mock 必须打在 services 路径上，否则拦截不到。
vi.mock('@/utils/api', () => ({
  get: vi.fn(),
  batchPost: vi.fn(),
}))

vi.mock('@/services/studentService', () => ({
  getAllStudents: vi.fn(),
  createStudent: vi.fn(),
  updateStudent: vi.fn(),
  deleteStudent: vi.fn(),
  validateStudentId: vi.fn(() => ({ valid: true })),
  validateStudentName: vi.fn(() => ({ valid: true })),
}))

vi.mock('@/services/adminService', () => ({
  resetTeacherPassword: vi.fn(),
}))

const mockGet = vi.mocked(get)
const mockBatchPost = vi.mocked(batchPost)
const mockGetAllStudents = vi.mocked(getAllStudents)
const mockCreateStudent = vi.mocked(createStudent)
const mockUpdateStudent = vi.mocked(updateStudent)
const mockDeleteStudent = vi.mocked(deleteStudent)
const mockResetTeacherPassword = vi.mocked(resetTeacherPassword)

const mockStudents = [
  { student_id: '2024001', name: '张三', class: 9, created_at: '2024-01-01' },
  { student_id: '2024002', name: '李四', class: 9, created_at: '2024-01-02' },
  { student_id: '2024003', name: '王五', class: 10, created_at: '2024-01-03' },
]

const mockWenAnswers = [
  {
    studentId: '2024001',
    studentName: '张三',
    totalQuestions: 5,
    correctCount: 4,
    wrongCount: 1,
    avgScore: 80,
    answers: [
      { questionIndex: 0, userAnswer: 2, correctAnswer: 2, isCorrect: true, score: 20 },
      { questionIndex: 1, userAnswer: 0, correctAnswer: 1, isCorrect: false, score: 0 },
    ],
  },
  {
    studentId: '2024002',
    studentName: '李四',
    totalQuestions: 5,
    correctCount: 3,
    wrongCount: 2,
    avgScore: 60,
    answers: [],
  },
]

const mockStudentAnswers = [
  {
    wenId: 'WEN_01',
    submittedAt: '2024-01-01',
    totalQuestions: 5,
    correctCount: 4,
    avgScore: 80,
    answers: [],
  },
  {
    wenId: 'WEN_02',
    submittedAt: '2024-01-02',
    totalQuestions: 5,
    correctCount: 3,
    avgScore: 60,
    answers: [],
  },
]

describe('AnswerQueryView.vue', () => {
  let pinia: ReturnType<typeof createPinia>

  /** 视图 setup 里就会 useAuthStore()，必须带 pinia 挂载 */
  const mountView = () => mount(AnswerQueryView, { global: { plugins: [pinia] } })

  beforeEach(() => {
    vi.clearAllMocks()
    pinia = createPinia()
    setActivePinia(pinia)
    // 学生列表接口按角色分流，默认用教师身份（管理员专属入口另有单独用例）
    const authStore = useAuthStore()
    authStore.token = 'test-token'
    authStore.user = { id: '1', username: 'teacher', studentId: '1', role: 'teacher' }

    // 学生 tab 现在走 studentService.getAllStudents（→ /api/teacher|admin/students）
    mockGetAllStudents.mockResolvedValue(mockStudents as never)
    mockGet.mockResolvedValue({
      success: true,
      data: mockStudents,
    })
    mockCreateStudent.mockResolvedValue({ success: true, message: '学生添加成功' })
    mockUpdateStudent.mockResolvedValue({ success: true, message: '学生信息修改成功' })
    mockDeleteStudent.mockResolvedValue({ success: true, message: '学生删除成功' })
    mockResetTeacherPassword.mockResolvedValue({
      success: true,
      data: { temporary_password: 'TempPass123' },
    } as never)
  })

  describe('基础渲染测试', () => {
    it('应该正确渲染页面标题', () => {
      const wrapper = mountView()
      expect(wrapper.find('.page-header h1').text()).toBe('学生信息查询与管理')
    })

    it('应该显示标签页', () => {
      const wrapper = mountView()
      const tabBtns = wrapper.findAll('.tab-btn')
      expect(tabBtns.length).toBe(3)
      expect(tabBtns[0].text()).toBe('学生管理')
      expect(tabBtns[1].text()).toBe('按文言文ID查询')
      expect(tabBtns[2].text()).toBe('按学生ID查询')
    })

    it('默认应该显示学生管理标签页', () => {
      const wrapper = mountView()
      const activeTab = wrapper.find('.tab-btn.active')
      expect(activeTab.text()).toBe('学生管理')
    })
  })

  describe('学生管理功能测试', () => {
    it('应该正确加载学生列表', async () => {
      const wrapper = mountView()
      await flushPromises()

      expect(mockGetAllStudents).toHaveBeenCalledTimes(1)
      expect(mockGet).not.toHaveBeenCalled()

      const tableRows = wrapper.findAll('.data-table tbody tr')
      expect(tableRows.length).toBe(3)
      expect(tableRows[0].find('td').text()).toBe('2024001')
    })

    it('应该正确显示学生信息', async () => {
      const wrapper = mountView()
      await flushPromises()

      const firstRow = wrapper.findAll('.data-table tbody tr')[0]
      const tds = firstRow.findAll('td')
      expect(tds[0].text()).toBe('2024001')
      expect(tds[1].text()).toBe('张三')
      expect(tds[2].text()).toBe('9')
    })

    it('应该支持搜索功能', async () => {
      const wrapper = mountView()
      await flushPromises()

      const searchInput = wrapper.find('.search-input')
      await searchInput.setValue('张三')
      await searchInput.trigger('input')
      await flushPromises()

      const tableRows = wrapper.findAll('.data-table tbody tr')
      expect(tableRows.length).toBe(1)
      expect(tableRows[0].find('td').text()).toBe('2024001')
    })

    it('应该支持按班级筛选', async () => {
      const wrapper = mountView()
      await flushPromises()

      const classSelect = wrapper.find('.class-select')
      await classSelect.setValue('9')
      await classSelect.trigger('change')
      await flushPromises()

      expect(mockGetAllStudents).toHaveBeenLastCalledWith({ class: 9 })
    })

    it('应该支持新增学生', async () => {
      const wrapper = mountView()
      await flushPromises()

      const addBtn = wrapper.find('.add-btn')
      await addBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('.student-form-modal').exists()).toBe(true)
      expect(wrapper.find('.modal-header h3').text()).toBe('新增学生')
    })

    it('应该支持编辑学生', async () => {
      const wrapper = mountView()
      await flushPromises()

      const editBtn = wrapper.findAll('.edit-btn')[0]
      await editBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('.student-form-modal').exists()).toBe(true)
      expect(wrapper.find('.modal-header h3').text()).toBe('编辑学生信息')
    })

    it('应该支持删除学生', async () => {
      const wrapper = mountView()
      await flushPromises()

      const deleteBtn = wrapper.findAll('.delete-btn')[0]
      await deleteBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('.delete-confirm-modal').exists()).toBe(true)
    })

    it('提交新增学生表单应该打开表单弹窗', async () => {
      const wrapper = mountView()
      await flushPromises()

      const addBtn = wrapper.find('.add-btn')
      await addBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('.student-form-modal').exists()).toBe(true)
    })

    it('提交编辑学生表单应该打开表单弹窗', async () => {
      const wrapper = mountView()
      await flushPromises()

      const editBtn = wrapper.findAll('.edit-btn')[0]
      await editBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('.student-form-modal').exists()).toBe(true)
    })

    it('确认删除学生应该调用deleteStudent', async () => {
      const wrapper = mountView()
      await flushPromises()

      const deleteBtn = wrapper.findAll('.delete-btn')[0]
      await deleteBtn.trigger('click')
      await flushPromises()

      const confirmDeleteBtn = wrapper.find('.danger-btn')
      await confirmDeleteBtn.trigger('click')
      await flushPromises()

      expect(mockDeleteStudent).toHaveBeenCalledWith('2024001')
    })
  })

  describe('按文言文ID查询功能测试', () => {
    it('切换到文言文ID查询标签页应该显示查询表单', async () => {
      const wrapper = mountView()
      await flushPromises()

      const wenIdTab = wrapper.findAll('.tab-btn')[1]
      await wenIdTab.trigger('click')
      await flushPromises()

      expect(wrapper.find('.tab-btn.active').text()).toBe('按文言文ID查询')
      expect(wrapper.find('input[placeholder="如：WEN_01"]').exists()).toBe(true)
    })

    it('查询文言文答题情况应该调用正确的API', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: {
          students: mockWenAnswers,
          studentCount: 2,
        },
      })

      const wrapper = mountView()
      await flushPromises()

      const wenIdTab = wrapper.findAll('.tab-btn')[1]
      await wenIdTab.trigger('click')
      await flushPromises()

      const input = wrapper.find('input[placeholder="如：WEN_01"]')
      await input.setValue('WEN_01')
      await flushPromises()

      const queryBtn = wrapper.find('.query-btn')
      await queryBtn.trigger('click')
      await flushPromises()

      expect(mockGet).toHaveBeenCalledWith('/api/answers/wen/WEN_01')
    })

    it('应该正确显示文言文答题统计', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: {
          students: mockWenAnswers,
          studentCount: 2,
        },
      })

      const wrapper = mountView()
      await flushPromises()

      const wenIdTab = wrapper.findAll('.tab-btn')[1]
      await wenIdTab.trigger('click')
      await flushPromises()

      const input = wrapper.find('input[placeholder="如：WEN_01"]')
      await input.setValue('WEN_01')
      await flushPromises()

      const queryBtn = wrapper.find('.query-btn')
      await queryBtn.trigger('click')
      await flushPromises()

      const statsCards = wrapper.findAll('.stat-card')
      expect(statsCards[0].find('.stat-value').text()).toBe('2')
      expect(statsCards[1].find('.stat-value').text()).toBe('7')
      expect(statsCards[2].find('.stat-value').text()).toBe('3')
    })

    it('应该正确显示文言文答题表格', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: {
          students: mockWenAnswers,
          studentCount: 2,
        },
      })

      const wrapper = mountView()
      await flushPromises()

      const wenIdTab = wrapper.findAll('.tab-btn')[1]
      await wenIdTab.trigger('click')
      await flushPromises()

      const input = wrapper.find('input[placeholder="如：WEN_01"]')
      await input.setValue('WEN_01')
      await flushPromises()

      const queryBtn = wrapper.find('.query-btn')
      await queryBtn.trigger('click')
      await flushPromises()

      const tableRows = wrapper.findAll('.data-table tbody tr')
      expect(tableRows.length).toBe(2)
      expect(tableRows[0].findAll('td')[0].text()).toBe('2024001')
      expect(tableRows[0].findAll('td')[1].text()).toBe('张三')
      expect(tableRows[0].findAll('td')[2].text()).toBe('5')
      expect(tableRows[0].findAll('td')[3].text()).toBe('4')
    })

    it('点击详情按钮应该显示答题详情弹窗', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: {
          students: mockWenAnswers,
          studentCount: 2,
        },
      })

      const wrapper = mountView()
      await flushPromises()

      const wenIdTab = wrapper.findAll('.tab-btn')[1]
      await wenIdTab.trigger('click')
      await flushPromises()

      const input = wrapper.find('input[placeholder="如：WEN_01"]')
      await input.setValue('WEN_01')
      await flushPromises()

      const queryBtn = wrapper.find('.query-btn')
      await queryBtn.trigger('click')
      await flushPromises()

      const detailBtn = wrapper.find('.detail-btn')
      await detailBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('.answer-detail-modal').exists()).toBe(true)
    })
  })

  describe('按学生ID查询功能测试', () => {
    it('切换到学生ID查询标签页应该显示查询表单', async () => {
      const wrapper = mountView()
      await flushPromises()

      const studentIdTab = wrapper.findAll('.tab-btn')[2]
      await studentIdTab.trigger('click')
      await flushPromises()

      expect(wrapper.find('.tab-btn.active').text()).toBe('按学生ID查询')
      expect(wrapper.find('input[placeholder="如：2024001"]').exists()).toBe(true)
    })

    it('查询学生答题记录应该调用正确的API', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: {
          wenRecords: mockStudentAnswers,
          totalAllCorrect: 7,
          totalAllWrong: 3,
          overallAvgScore: 70,
        },
      })

      const wrapper = mountView()
      await flushPromises()

      const studentIdTab = wrapper.findAll('.tab-btn')[2]
      await studentIdTab.trigger('click')
      await flushPromises()

      const input = wrapper.find('input[placeholder="如：2024001"]')
      await input.setValue('2024001')
      await flushPromises()

      // 第 2 个 query-btn 属于学生ID表单（两个 tab 都在 DOM 里）
      const queryBtn = wrapper.findAll('.query-btn')[1]
      await queryBtn.trigger('click')
      await flushPromises()

      expect(mockGet).toHaveBeenCalled()
    })

    it('应该正确显示学生答题统计', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: {
          wenRecords: mockStudentAnswers,
          totalAllCorrect: 7,
          totalAllWrong: 3,
          overallAvgScore: 70,
        },
      })

      const wrapper = mountView()
      await flushPromises()

      const studentIdTab = wrapper.findAll('.tab-btn')[2]
      await studentIdTab.trigger('click')
      await flushPromises()

      const input = wrapper.find('input[placeholder="如：2024001"]')
      await input.setValue('2024001')
      await flushPromises()

      // 第 2 个 query-btn 属于学生ID表单（两个 tab 都在 DOM 里）
      const queryBtn = wrapper.findAll('.query-btn')[1]
      await queryBtn.trigger('click')
      await flushPromises()

      const statsCards = wrapper.findAll('.stat-card')
      expect(statsCards.length).toBeGreaterThan(0)
    })

    it('学生ID查询应该显示查询表单', async () => {
      const wrapper = mountView()
      await flushPromises()

      const studentIdTab = wrapper.findAll('.tab-btn')[2]
      await studentIdTab.trigger('click')
      await flushPromises()

      expect(wrapper.find('input[placeholder="如：2024001"]').exists()).toBe(true)
    })
  })

  describe('数据展示测试', () => {
    it('错误状态应该显示错误信息', async () => {
      mockGetAllStudents.mockRejectedValue(new Error('网络错误'))

      const wrapper = mountView()
      await flushPromises()

      expect(wrapper.find('.error-state').exists()).toBe(true)
      expect(wrapper.find('.error-state').text()).toContain('网络错误')
    })

    it('空数据状态应该显示提示', async () => {
      mockGetAllStudents.mockResolvedValue([])

      const wrapper = mountView()
      await flushPromises()

      expect(wrapper.find('.empty-state').exists()).toBe(true)
    })

    it('应该显示统计卡片', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: {
          students: mockWenAnswers,
          studentCount: 2,
        },
      })

      const wrapper = mountView()
      await flushPromises()

      const wenIdTab = wrapper.findAll('.tab-btn')[1]
      await wenIdTab.trigger('click')
      await flushPromises()

      const input = wrapper.find('input[placeholder="如：WEN_01"]')
      await input.setValue('WEN_01')
      await flushPromises()

      const queryBtn = wrapper.find('.query-btn')
      await queryBtn.trigger('click')
      await flushPromises()

      const statsCards = wrapper.findAll('.stat-card')
      expect(statsCards.length).toBe(4)
    })

    it('应该支持排序功能', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: mockStudents,
      })

      const wrapper = mountView()
      await flushPromises()

      const sortSelect = wrapper.find('.sort-select')
      await sortSelect.setValue('score')
      await sortSelect.trigger('change')
      await flushPromises()

      expect(wrapper.find('.sort-select').element.value).toBe('score')
    })

    it('应该支持分页功能', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: mockStudents,
      })

      const wrapper = mountView()
      await flushPromises()

      expect(wrapper.find('.pagination').exists()).toBe(true)
    })

    it('应该支持数据导出', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: mockStudents,
      })

      const wrapper = mountView()
      await flushPromises()

      const exportBtn = wrapper.find('.export-btn')
      expect(exportBtn.exists()).toBe(true)
      expect(exportBtn.element.disabled).toBe(false)
    })
  })

  describe('答案格式化测试', () => {
    // formatDate / formatAnswer 已抽到 utils/format.ts（C02 拆分），直接测试工具函数
    it('应该正确格式化日期', () => {
      const formatted = formatDate('2024-01-01T00:00:00Z')
      expect(typeof formatted).toBe('string')
    })

    it('应该正确格式化答案', () => {
      expect(formatAnswer(2)).toBe('2')
      expect(formatAnswer([0, 2])).toBe('0, 2')
      expect(formatAnswer(null)).toBe('-')
      expect(formatAnswer(undefined)).toBe('-')
    })
  })

  describe('边界情况测试', () => {
    it('查询空文言文ID应该显示错误', async () => {
      const wrapper = mountView()
      await flushPromises()

      const wenIdTab = wrapper.findAll('.tab-btn')[1]
      await wenIdTab.trigger('click')
      await flushPromises()

      const queryBtn = wrapper.findAll('.query-btn')[0]
      await queryBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('.error-state').exists()).toBe(true)
      expect(wrapper.find('.error-state').text()).toContain('请输入文言文ID')
      expect(mockGet).not.toHaveBeenCalled()
    })

    it('查询空学生ID应该显示错误', async () => {
      const wrapper = mountView()
      await flushPromises()

      const studentIdTab = wrapper.findAll('.tab-btn')[2]
      await studentIdTab.trigger('click')
      await flushPromises()

      // 第二个 query-btn 属于「按学生ID查询」表单（两个 tab 都在 DOM 里，靠 v-show 切换）
      const queryBtn = wrapper.findAll('.query-btn')[1]
      await queryBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('.error-state').exists()).toBe(true)
      expect(wrapper.find('.error-state').text()).toContain('请输入学生学号')
      expect(mockGet).not.toHaveBeenCalled()
    })

    it('API返回失败应该显示错误信息', async () => {
      mockGet.mockResolvedValue({
        success: false,
        message: '获取数据失败',
      })

      const wrapper = mountView()
      await flushPromises()

      const wenIdTab = wrapper.findAll('.tab-btn')[1]
      await wenIdTab.trigger('click')
      await flushPromises()

      await wrapper.find('input[placeholder="如：WEN_01"]').setValue('WEN_01')
      await wrapper.findAll('.query-btn')[0].trigger('click')
      await flushPromises()

      expect(wrapper.find('.error-state').exists()).toBe(true)
      expect(wrapper.find('.error-state').text()).toContain('获取数据失败')
    })
  })

  describe('角色权限（批量创建教师入口仅管理员可见）', () => {
    it('教师看不到「批量创建教师」入口', async () => {
      const wrapper = mountView()
      await flushPromises()

      expect(wrapper.findAll('.tool-nav-btn').length).toBe(0)
      expect(wrapper.text()).not.toContain('批量创建教师')
    })

    it('管理员可见「批量创建教师」入口', async () => {
      const authStore = useAuthStore()
      authStore.user = { id: '2', username: 'admin', studentId: '2', role: 'admin' }
      mockGetAllStudents.mockResolvedValue([])

      const wrapper = mountView()
      await flushPromises()

      expect(wrapper.text()).toContain('批量创建教师')
    })

    it('批量创建不提交写死口令，并展示服务端一次性临时口令', async () => {
      const authStore = useAuthStore()
      authStore.user = { id: '2', username: 'admin', studentId: '2', role: 'super_admin' }
      mockGetAllStudents.mockResolvedValue([])
      mockBatchPost.mockResolvedValue(
        [
          { key: 'a001', success: true, message: '创建成功' },
        ] as never,
      )

      const wrapper = mountView()
      await flushPromises()

      await wrapper.find('.tool-nav-btn').trigger('click')
      await flushPromises()
      await wrapper.find('.modal-footer .btn-primary').trigger('click')
      await flushPromises()

      expect(mockBatchPost).toHaveBeenCalledTimes(1)
      const [url, items] = mockBatchPost.mock.calls[0] as unknown as [
        string,
        Array<{ body: { password: string } }>,
      ]
      expect(url).toBe('/api/admin/teachers')
      expect(items).toHaveLength(9)
      // 旧实现写死 12345678；现在每个账号使用随机初始化口令，且不由前端展示
      for (const item of items) {
        expect(item.body.password).not.toBe('12345678')
        expect(item.body.password.length).toBe(16)
      }
      expect(mockResetTeacherPassword).toHaveBeenCalledWith('a001')
      expect(wrapper.find('.result-password').text()).toContain('TempPass123')
    })
  })
})
