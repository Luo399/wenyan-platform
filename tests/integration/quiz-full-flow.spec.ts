import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import StudentLogin from '@/components/StudentLogin.vue'
import Level1Quiz from '@/components/Level1Quiz.vue'
import AdaptQuiz from '@/components/AdaptQuiz.vue'
import AnswerQueryView from '@/views/AnswerQueryView.vue'
import { useAnswerSubmitter } from '@/composables/useAnswerSubmitter'
import { useStudentStore } from '@/stores/student'
import { useDataLoader } from '@/composables/useDataLoader'
import { post, get } from '@/utils/api'

vi.mock('@/composables/useDataLoader')
vi.mock('@/utils/api', () => ({
  post: vi.fn(),
  get: vi.fn(),
}))

vi.mock('@/utils/studentApi', () => ({
  createStudent: vi.fn(),
  updateStudent: vi.fn(),
  deleteStudent: vi.fn(),
  validateStudentId: vi.fn(() => ({ valid: true })),
  validateStudentName: vi.fn(() => ({ valid: true })),
}))

const mockPost = vi.mocked(post)
const mockGet = vi.mocked(get)

const mockQuizData = [
  {
    text_id: 'WEN_01',
    question_number: 1,
    question_text: '测试题目1',
    option_a: '选项A',
    option_b: '选项B',
    option_c: '选项C',
    option_d: '选项D',
    correct_answer: 2,
    correct_index: 2,
    explanation: '答案解析1',
    difficulty: 'L2',
  },
  {
    text_id: 'WEN_01',
    question_number: 2,
    question_text: '测试题目2',
    option_a: '选项A',
    option_b: '选项B',
    option_c: '选项C',
    option_d: '选项D',
    correct_answer: 1,
    correct_index: 1,
    explanation: '答案解析2',
    difficulty: 'L1',
  },
]

describe('题目组件全流程集成测试', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  describe('学生登录流程', () => {
    it('学生应该能够输入学号并登录', async () => {
      const wrapper = mount(StudentLogin)
      const input = wrapper.find('input')
      const submitBtn = wrapper.find('button')

      await input.setValue('2024001')
      await flushPromises()

      expect(submitBtn.element.disabled).toBe(false)
      await submitBtn.trigger('click')
      await flushPromises()

      const studentStore = useStudentStore()
      expect(studentStore.studentId).toBe('2024001')
      expect(studentStore.isLoggedIn).toBe(true)
      expect(localStorage.getItem('studentId')).toBe('2024001')
    })

    it('空学号应该显示错误', async () => {
      const wrapper = mount(StudentLogin)
      const input = wrapper.find('input')
      await input.setValue('')
      await flushPromises()

      wrapper.vm.handleSubmit()
      await flushPromises()

      expect(wrapper.find('.error-message').exists()).toBe(true)
      expect(wrapper.find('.error-message').text()).toBe('学号不能为空')
    })
  })

  describe('答题组件显示流程', () => {
    beforeEach(() => {
      vi.mocked(useDataLoader).mockReturnValue({
        loading: ref(false),
        error: ref<string | null>(null),
        isTimeout: ref(false),
        data: ref(mockQuizData),
        retry: vi.fn(),
        load: vi.fn(),
      })
    })

    it('Level1Quiz应该正确渲染题目和选项', () => {
      const wrapper = mount(Level1Quiz, { props: { wenId: 'WEN_01' } })

      expect(wrapper.find('.level1-quiz-container').exists()).toBe(true)
      expect(wrapper.text()).toContain('测试题目1')
      expect(wrapper.text()).toContain('选项A')
      expect(wrapper.text()).toContain('选项B')

      const quizItems = wrapper.findAll('.quiz-item')
      expect(quizItems.length).toBe(2)

      const firstQuestionOptions = quizItems[0].findAll('.option-btn')
      expect(firstQuestionOptions.length).toBe(4)
    })

    it('AdaptQuiz应该正确渲染题目', () => {
      const wrapper = mount(AdaptQuiz, {
        props: {
          text_id: 'WEN_01',
          question_id: 'WEN_01_B1',
          question_number: 1,
          question_text: '测试题目1',
          option_a: '选项A内容',
          option_b: '选项B内容',
          option_c: '选项C内容',
          option_d: '选项D内容',
          correct_answer: 2,
          explanation: '答案解析内容',
          difficulty: 'L2',
          question_type: 'radio',
        },
      })

      expect(wrapper.find('.adapt-quiz').exists()).toBe(true)
      expect(wrapper.text()).toContain('测试题目1')

      const optionLabels = wrapper.findAll('.option-label')
      expect(optionLabels.length).toBe(4)
    })

    it('答题组件应该显示难度标签', () => {
      const wrapper = mount(Level1Quiz, { props: { wenId: 'WEN_01' } })

      const difficultyTags = wrapper.findAll('.difficulty-tag')
      expect(difficultyTags.length).toBe(2)
      expect(difficultyTags[0].text()).toBe('L2')
      expect(difficultyTags[1].text()).toBe('L1')
    })
  })

  describe('答题交互流程', () => {
    beforeEach(() => {
      vi.mocked(useDataLoader).mockReturnValue({
        loading: ref(false),
        error: ref<string | null>(null),
        isTimeout: ref(false),
        data: ref(mockQuizData),
        retry: vi.fn(),
        load: vi.fn(),
      })
    })

    it('学生应该能够选择选项并提交答案', async () => {
      const wrapper = mount(Level1Quiz, { props: { wenId: 'WEN_01' } })

      const firstQuizOptions = wrapper.findAll('.quiz-item')[0].findAll('.option-btn')
      const secondQuizOptions = wrapper.findAll('.quiz-item')[1].findAll('.option-btn')

      await firstQuizOptions[2].trigger('click')
      await secondQuizOptions[1].trigger('click')
      await flushPromises()

      expect(firstQuizOptions[2].classes()).toContain('selected')
      expect(secondQuizOptions[1].classes()).toContain('selected')

      const submitBtn = wrapper.find('.submit-btn')
      expect(submitBtn.attributes('disabled')).toBeUndefined()

      await submitBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('.result-panel').exists()).toBe(true)
      expect(wrapper.emitted('submit')).toBeTruthy()
      expect(wrapper.emitted('complete')).toBeTruthy()
    })

    it('提交后应该显示正确和错误状态', async () => {
      const wrapper = mount(Level1Quiz, { props: { wenId: 'WEN_01' } })

      const firstQuizOptions = wrapper.findAll('.quiz-item')[0].findAll('.option-btn')
      const secondQuizOptions = wrapper.findAll('.quiz-item')[1].findAll('.option-btn')

      await firstQuizOptions[2].trigger('click')
      await secondQuizOptions[2].trigger('click')
      await flushPromises()

      await wrapper.find('.submit-btn').trigger('click')
      await flushPromises()

      const refreshedFirstOptions = wrapper.findAll('.quiz-item')[0].findAll('.option-btn')
      expect(refreshedFirstOptions[2].classes()).toContain('correct')

      const refreshedSecondOptions = wrapper.findAll('.quiz-item')[1].findAll('.option-btn')
      expect(refreshedSecondOptions[2].classes()).toContain('wrong')
      expect(refreshedSecondOptions[1].classes()).toContain('correct')
    })
  })

  describe('答案提交流程', () => {
    beforeEach(() => {
      const studentStore = useStudentStore()
      studentStore.setStudentId('2024001')

      mockPost.mockResolvedValue({
        success: true,
        message: '提交成功',
        data: {
          studentId: '2024001',
          wenId: 'WEN_01',
          questionCount: 2,
          correctCount: 1,
          totalScore: 50,
          avgScore: 50,
          details: [],
        },
      })
    })

    it('应该能够收集和提交答题数据', async () => {
      const submitter = useAnswerSubmitter()

      submitter.addAnswer({
        questionId: 'Q1',
        userAnswer: 2,
        correctAnswer: 2,
        isCorrect: true,
      })

      submitter.addAnswer({
        questionId: 'Q2',
        userAnswer: 0,
        correctAnswer: 1,
        isCorrect: false,
      })

      expect(submitter.answers.value.length).toBe(2)

      const validation = submitter.validateAnswers()
      expect(validation.valid).toBe(true)

      const payload = submitter.buildSubmitPayload('WEN_01')
      expect(payload).not.toBeNull()
      expect(payload!.studentId).toBe('2024001')
      expect(payload!.wenId).toBe('WEN_01')
    })

    it('提交答案应该调用API并返回结果', async () => {
      const submitter = useAnswerSubmitter()

      submitter.addAnswer({
        questionId: 'Q1',
        userAnswer: 2,
        correctAnswer: 2,
      })

      submitter.addAnswer({
        questionId: 'Q2',
        userAnswer: 1,
        correctAnswer: 1,
      })

      const result = await submitter.submitAnswers('WEN_01')

      expect(mockPost).toHaveBeenCalledWith('/api/submit', expect.objectContaining({
        studentId: '2024001',
        wenId: 'WEN_01',
        answers: { Q1: 2, Q2: 1 },
      }))

      expect(result.success).toBe(true)
      expect(result.message).toBe('提交成功')
    })

    it('网络异常时应该正确处理错误', async () => {
      mockPost.mockRejectedValue(new Error('网络错误'))

      const submitter = useAnswerSubmitter()
      submitter.addAnswer({ questionId: 'Q1', userAnswer: 2, correctAnswer: 2 })

      await expect(submitter.submitAnswers('WEN_01')).rejects.toThrow('网络错误')
      expect(submitter.submitError.value).toBe('网络错误')
      expect(submitter.isSubmitting.value).toBe(false)
    })
  })

  describe('教师端数据展示流程', () => {
    const mockStudents = [
      { student_id: '2024001', name: '张三', class: 9, created_at: '2024-01-01' },
      { student_id: '2024002', name: '李四', class: 9, created_at: '2024-01-02' },
    ]

    const mockWenAnswers = [
      {
        studentId: '2024001',
        studentName: '张三',
        totalQuestions: 2,
        correctCount: 1,
        wrongCount: 1,
        avgScore: 50,
        answers: [],
      },
    ]

    beforeEach(() => {
      mockGet.mockResolvedValue({ success: true, data: mockStudents })
    })

    it('教师应该能够查看学生列表', async () => {
      const wrapper = mount(AnswerQueryView)
      await flushPromises()

      expect(mockGet).toHaveBeenCalledWith('/api/students')

      const tableRows = wrapper.findAll('.data-table tbody tr')
      expect(tableRows.length).toBe(2)
      expect(tableRows[0].find('td').text()).toBe('2024001')
    })

    it('教师应该能够按文言文ID查询答题数据', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: { students: mockWenAnswers, studentCount: 1 },
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

      const tableRows = wrapper.findAll('.data-table tbody tr')
      expect(tableRows.length).toBe(1)
      expect(tableRows[0].findAll('td')[0].text()).toBe('2024001')
    })
  })

  describe('全流程端到端测试', () => {
    it('学生登录→答题→提交→教师查看的完整流程', async () => {
      vi.mocked(useDataLoader).mockReturnValue({
        loading: ref(false),
        error: ref<string | null>(null),
        isTimeout: ref(false),
        data: ref(mockQuizData),
        retry: vi.fn(),
        load: vi.fn(),
      })

      mockPost.mockResolvedValue({
        success: true,
        message: '提交成功',
        data: {
          studentId: '2024001',
          wenId: 'WEN_01',
          questionCount: 2,
          correctCount: 1,
          avgScore: 50,
          details: [],
        },
      })

      const mockStudents = [{ student_id: '2024001', name: '张三', class: 9 }]
      const mockWenAnswers = [
        {
          studentId: '2024001',
          studentName: '张三',
          totalQuestions: 2,
          correctCount: 1,
          avgScore: 50,
          answers: [],
        },
      ]

      mockGet.mockResolvedValue({ success: true, data: mockStudents })

      const loginWrapper = mount(StudentLogin)
      await loginWrapper.find('input').setValue('2024001')
      await loginWrapper.find('button').trigger('click')
      await flushPromises()

      const studentStore = useStudentStore()
      expect(studentStore.studentId).toBe('2024001')

      const quizWrapper = mount(Level1Quiz, { props: { wenId: 'WEN_01' } })

      const firstOptions = quizWrapper.findAll('.quiz-item')[0].findAll('.option-btn')
      const secondOptions = quizWrapper.findAll('.quiz-item')[1].findAll('.option-btn')

      await firstOptions[2].trigger('click')
      await secondOptions[0].trigger('click')
      await flushPromises()

      await quizWrapper.find('.submit-btn').trigger('click')
      await flushPromises()

      expect(quizWrapper.emitted('submit')).toBeTruthy()

      mockGet.mockResolvedValue({
        success: true,
        data: { students: mockWenAnswers, studentCount: 1 },
      })

      const answerQueryWrapper = mount(AnswerQueryView)
      await flushPromises()

      const wenIdTab = answerQueryWrapper.findAll('.tab-btn')[1]
      await wenIdTab.trigger('click')
      await flushPromises()

      const input = answerQueryWrapper.find('input[placeholder="如：WEN_01"]')
      await input.setValue('WEN_01')
      await flushPromises()

      await answerQueryWrapper.find('.query-btn').trigger('click')
      await flushPromises()

      expect(mockGet).toHaveBeenCalledWith('/api/answers/wen/WEN_01')

      const tableRows = answerQueryWrapper.findAll('.data-table tbody tr')
      expect(tableRows.length).toBe(1)
      expect(tableRows[0].findAll('td')[0].text()).toBe('2024001')
    })
  })
})