import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import AnswerQueryView from '@/views/AnswerQueryView.vue'
import { get } from '@/utils/api'
import {
  createStudent,
  updateStudent,
  deleteStudent,
  validateStudentId,
  validateStudentName,
} from '@/utils/studentApi'

vi.mock('@/utils/api', () => ({
  get: vi.fn(),
}))

vi.mock('@/utils/studentApi', () => ({
  createStudent: vi.fn(),
  updateStudent: vi.fn(),
  deleteStudent: vi.fn(),
  validateStudentId: vi.fn(() => ({ valid: true })),
  validateStudentName: vi.fn(() => ({ valid: true })),
}))

const mockGet = vi.mocked(get)
const mockCreateStudent = vi.mocked(createStudent)
const mockUpdateStudent = vi.mocked(updateStudent)
const mockDeleteStudent = vi.mocked(deleteStudent)
const mockValidateStudentId = vi.mocked(validateStudentId)
const mockValidateStudentName = vi.mocked(validateStudentName)

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
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockResolvedValue({
      success: true,
      data: mockStudents,
    })
    mockCreateStudent.mockResolvedValue({ success: true })
    mockUpdateStudent.mockResolvedValue({ success: true })
    mockValidateStudentId.mockReturnValue({ valid: true })
    mockValidateStudentName.mockReturnValue({ valid: true })
  })

  describe('基础渲染测试', () => {
    it('应该正确渲染页面标题', () => {
      const wrapper = mount(AnswerQueryView)
      expect(wrapper.find('.page-header h1').text()).toBe('学生信息查询与管理')
    })

    it('应该显示标签页', () => {
      const wrapper = mount(AnswerQueryView)
      const tabBtns = wrapper.findAll('.tab-btn')
      expect(tabBtns.length).toBe(3)
      expect(tabBtns[0].text()).toBe('学生管理')
      expect(tabBtns[1].text()).toBe('按文言文ID查询')
      expect(tabBtns[2].text()).toBe('按学生ID查询')
    })

    it('默认应该显示学生管理标签页', () => {
      const wrapper = mount(AnswerQueryView)
      const activeTab = wrapper.find('.tab-btn.active')
      expect(activeTab.text()).toBe('学生管理')
    })
  })

  describe('学生管理功能测试', () => {
    it('应该正确加载学生列表', async () => {
      const wrapper = mount(AnswerQueryView)
      await flushPromises()

      expect(mockGet).toHaveBeenCalledWith('/api/students')

      const tableRows = wrapper.findAll('.data-table tbody tr')
      expect(tableRows.length).toBe(3)
      expect(tableRows[0].find('td').text()).toBe('2024001')
    })

    it('应该正确显示学生信息', async () => {
      const wrapper = mount(AnswerQueryView)
      await flushPromises()

      const firstRow = wrapper.findAll('.data-table tbody tr')[0]
      const tds = firstRow.findAll('td')
      expect(tds[0].text()).toBe('2024001')
      expect(tds[1].text()).toBe('张三')
      expect(tds[2].text()).toBe('9')
    })

    it('应该支持搜索功能', async () => {
      const wrapper = mount(AnswerQueryView)
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
      const wrapper = mount(AnswerQueryView)
      await flushPromises()

      const classSelect = wrapper.find('.class-select')
      await classSelect.setValue('9')
      await classSelect.trigger('change')
      await flushPromises()

      expect(mockGet).toHaveBeenCalledWith('/api/students?class=9')
    })

    it('应该支持新增学生', async () => {
      const wrapper = mount(AnswerQueryView)
      await flushPromises()

      const addBtn = wrapper.find('.add-btn')
      await addBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('.student-form-modal').exists()).toBe(true)
      expect(wrapper.find('.modal-header h3').text()).toBe('新增学生')
    })

    it('应该支持编辑学生', async () => {
      const wrapper = mount(AnswerQueryView)
      await flushPromises()

      const editBtn = wrapper.findAll('.edit-btn')[0]
      await editBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('.student-form-modal').exists()).toBe(true)
      expect(wrapper.find('.modal-header h3').text()).toBe('编辑学生信息')
    })

    it('应该支持删除学生', async () => {
      const wrapper = mount(AnswerQueryView)
      await flushPromises()

      const deleteBtn = wrapper.findAll('.delete-btn')[0]
      await deleteBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('.delete-confirm-modal').exists()).toBe(true)
    })

    it('提交新增学生表单应该打开表单弹窗', async () => {
      const wrapper = mount(AnswerQueryView)
      await flushPromises()

      const addBtn = wrapper.find('.add-btn')
      await addBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('.student-form-modal').exists()).toBe(true)
    })

    it('提交编辑学生表单应该打开表单弹窗', async () => {
      const wrapper = mount(AnswerQueryView)
      await flushPromises()

      const editBtn = wrapper.findAll('.edit-btn')[0]
      await editBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('.student-form-modal').exists()).toBe(true)
    })

    it('确认删除学生应该调用deleteStudent', async () => {
      const wrapper = mount(AnswerQueryView)
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
      const wrapper = mount(AnswerQueryView)
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

      const wrapper = mount(AnswerQueryView)
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

      const wrapper = mount(AnswerQueryView)
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

      const wrapper = mount(AnswerQueryView)
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

      const wrapper = mount(AnswerQueryView)
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
      const wrapper = mount(AnswerQueryView)
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

      const wrapper = mount(AnswerQueryView)
      await flushPromises()

      const studentIdTab = wrapper.findAll('.tab-btn')[2]
      await studentIdTab.trigger('click')
      await flushPromises()

      const input = wrapper.find('input[placeholder="如：2024001"]')
      await input.setValue('2024001')
      await flushPromises()

      const queryBtn = wrapper.find('.query-btn')
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

      const wrapper = mount(AnswerQueryView)
      await flushPromises()

      const studentIdTab = wrapper.findAll('.tab-btn')[2]
      await studentIdTab.trigger('click')
      await flushPromises()

      const input = wrapper.find('input[placeholder="如：2024001"]')
      await input.setValue('2024001')
      await flushPromises()

      const queryBtn = wrapper.find('.query-btn')
      await queryBtn.trigger('click')
      await flushPromises()

      const statsCards = wrapper.findAll('.stat-card')
      expect(statsCards.length).toBeGreaterThan(0)
    })

    it('学生ID查询应该显示查询表单', async () => {
      const wrapper = mount(AnswerQueryView)
      await flushPromises()

      const studentIdTab = wrapper.findAll('.tab-btn')[2]
      await studentIdTab.trigger('click')
      await flushPromises()

      expect(wrapper.find('input[placeholder="如：2024001"]').exists()).toBe(true)
    })
  })

  describe('数据展示测试', () => {
    it('错误状态应该显示错误信息', async () => {
      mockGet.mockRejectedValue(new Error('网络错误'))

      const wrapper = mount(AnswerQueryView)
      await flushPromises()

      expect(wrapper.find('.error-state').exists()).toBe(true)
    })

    it('空数据状态应该显示提示', async () => {
      mockGet.mockResolvedValue({ success: true, data: [] })

      const wrapper = mount(AnswerQueryView)
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

      const wrapper = mount(AnswerQueryView)
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

      const wrapper = mount(AnswerQueryView)
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

      const wrapper = mount(AnswerQueryView)
      await flushPromises()

      expect(wrapper.find('.pagination').exists()).toBe(true)
    })

    it('应该支持数据导出', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: mockStudents,
      })

      const wrapper = mount(AnswerQueryView)
      await flushPromises()

      const exportBtn = wrapper.find('.export-btn')
      expect(exportBtn.exists()).toBe(true)
      expect(exportBtn.element.disabled).toBe(false)
    })
  })

  describe('答案格式化测试', () => {
    it('应该正确格式化日期', async () => {
      const wrapper = mount(AnswerQueryView)
      await flushPromises()

      const vm = wrapper.vm as any
      const formatted = vm.formatDate('2024-01-01T00:00:00Z')
      expect(typeof formatted).toBe('string')
    })

    it('应该正确格式化答案', async () => {
      const wrapper = mount(AnswerQueryView)
      await flushPromises()

      const vm = wrapper.vm as any
      expect(vm.formatAnswer(2)).toBe('2')
      expect(vm.formatAnswer([0, 2])).toBe('0, 2')
      expect(vm.formatAnswer(null)).toBe('-')
      expect(vm.formatAnswer(undefined)).toBe('-')
    })
  })

  describe('边界情况测试', () => {
    it('查询空文言文ID应该显示错误', async () => {
      const wrapper = mount(AnswerQueryView)
      await flushPromises()

      const wenIdTab = wrapper.findAll('.tab-btn')[1]
      await wenIdTab.trigger('click')
      await flushPromises()

      const queryBtn = wrapper.find('.query-btn')
      await queryBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('.error-state').exists()).toBe(true)
    })

    it('查询空学生ID应该显示错误', async () => {
      const wrapper = mount(AnswerQueryView)
      await flushPromises()

      const studentIdTab = wrapper.findAll('.tab-btn')[2]
      await studentIdTab.trigger('click')
      await flushPromises()

      const queryBtn = wrapper.find('.query-btn')
      await queryBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('.error-state').exists()).toBe(true)
    })

    it('API返回失败应该显示错误信息', async () => {
      mockGet.mockResolvedValue({
        success: false,
        message: '获取数据失败',
      })

      const wrapper = mount(AnswerQueryView)
      await flushPromises()

      expect(wrapper.find('.error-state').exists()).toBe(true)
      expect(wrapper.find('.error-state').text()).toContain('获取数据失败')
    })
  })
})
