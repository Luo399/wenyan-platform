import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import StudentLoginView from '@/views/StudentLoginView.vue'
import Level1Quiz from '@/components/Level1Quiz.vue'
import BlockQuiz from '@/components/BlockQuiz.vue'
import AnswerQueryView from '@/views/AnswerQueryView.vue'
import { useAnswerSubmitter } from '@/composables/useAnswerSubmitter'
import { useAuthStore } from '@/stores/auth'
import { useDataLoader } from '@/composables/useDataLoader'
import { post, get } from '@/utils/api'

vi.mock('@/composables/useDataLoader')

// vi.mock 会被提升到文件顶部，工厂里引用的变量必须走 vi.hoisted
const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {}, params: {}, fullPath: '/student-login' }),
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
}))

vi.mock('@/utils/api', () => {
  class ApiError extends Error {
    status: number
    errorCode: string
    constructor(status: number, errorCode: string, message: string) {
      super(message)
      this.name = 'ApiError'
      this.status = status
      this.errorCode = errorCode
    }
  }
  return {
    request: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
    upload: vi.fn(),
    batchPost: vi.fn(),
    ApiError,
    // 登录页的 redirect 校验：测试里不涉及 query.redirect，回落到默认目标即可
    sanitizeRedirect: (target: string | null | undefined, fallback = '/') => target ?? fallback,
  }
})

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

/**
 * 构造一个"看起来合法"的 JWT：authStore.initialize() 会用 atob 解 exp，
 * 纯字符串 'mock-token' 会被判为已过期并把刚登录的状态清掉。
 */
function makeFakeJwt(expiresInSeconds = 3600): string {
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const header = b64url({ alg: 'HS256', typ: 'JWT' })
  const payload = b64url({ exp: Math.floor(Date.now() / 1000) + expiresInSeconds })
  return `${header}.${payload}.test-signature`
}

const TEST_TOKEN = makeFakeJwt()

/**
 * 登录响应：post() 返回的是 ApiResponse 信封 { success, message, data }
 */
function loginEnvelope(token = TEST_TOKEN, role = 'student') {
  return {
    success: true,
    message: '登录成功',
    data: {
      token,
      user: { id: '1', username: '张三', student_id: '2024001', role },
    },
  }
}

/**
 * 提交响应：后端 /api/submit 的 data 里再套一层 result 信封（见 answerController.submitAnswers），
 * apiService.submitAnswers 返回的就是这层内信封。
 */
function submitEnvelope() {
  return {
    success: true,
    message: '答案提交成功',
    data: {
      success: true,
      message: '提交成功',
      data: {
        studentId: '2024001',
        wenId: 'WEN_01',
        submittedAt: new Date().toISOString(),
        questionCount: 2,
        correctCount: 1,
        wrongCount: 1,
        totalScore: 50,
        avgScore: 50,
        details: [],
      },
    },
  }
}

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
    it('学生应该能够输入学号和密码登录', async () => {
      mockPost.mockResolvedValue(loginEnvelope())

      const wrapper = mount(StudentLoginView)
      await wrapper.find('#studentId').setValue('2024001')
      await wrapper.find('#password').setValue('123456')
      await flushPromises()

      expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined()

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      const authStore = useAuthStore()
      expect(authStore.user?.studentId).toBe('2024001')
      expect(authStore.isLoggedIn).toBe(true)
      expect(localStorage.getItem('auth_token')).toBe(TEST_TOKEN)
      // 按角色跳转：学生默认去 /rules/1
      expect(mockPush).toHaveBeenCalledWith('/rules/1')
    })

    it('空学号应该显示错误', async () => {
      const wrapper = mount(StudentLoginView)
      await wrapper.find('#studentId').setValue('')
      await flushPromises()

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(wrapper.find('.error-message').exists()).toBe(true)
      expect(wrapper.find('.error-message').text()).toBe('请输入学号')
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

    it('BlockQuiz应该正确渲染题目', () => {
      const wrapper = mount(BlockQuiz, {
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
      const authStore = useAuthStore()
      authStore.user = {
        id: '1',
        username: '张三',
        studentId: '2024001',
        role: 'student',
      }
      authStore.token = 'mock-token'

      mockPost.mockResolvedValue(submitEnvelope())
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

      // apiService.submitAnswers 会带第三个参数 { timeout }，这里只校验收到的请求体
      const [url, payload] = mockPost.mock.calls[0] as [string, Record<string, unknown>]
      expect(url).toBe('/api/submit')
      expect(payload).toMatchObject({
        studentId: '2024001',
        wenId: 'WEN_01',
        answers: { Q1: 2, Q2: 1 },
      })

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
    // 后端原始行：学生管理接口返回 snake_case（student_name / class_code）
    const mockStudentRows = [
      { student_id: '2024001', student_name: '张三', class_code: '240109', created_at: '2024-01-01' },
      { student_id: '2024002', student_name: '李四', class_code: '240109', created_at: '2024-01-02' },
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
      const authStore = useAuthStore()
      authStore.user = { id: '9', username: '李老师', studentId: '13800000000', role: 'teacher' }
      authStore.token = 'teacher-token'

      mockGet.mockImplementation((url: string) => {
        if (url === '/api/teacher/students') {
          return Promise.resolve({ success: true, message: 'ok', data: mockStudentRows })
        }
        if (url === '/api/answers/wen/WEN_01') {
          return Promise.resolve({
            success: true,
            message: 'ok',
            data: { students: mockWenAnswers, studentCount: 1 },
          })
        }
        return Promise.resolve({ success: true, message: 'ok', data: [] })
      })
    })

    it('教师应该能够查看学生列表', async () => {
      const wrapper = mount(AnswerQueryView)
      await flushPromises()

      // P1：学生管理接口按角色分流，教师走 /api/teacher/students
      expect(mockGet).toHaveBeenCalledWith('/api/teacher/students', undefined)

      const tableRows = wrapper.findAll('.data-table tbody tr')
      expect(tableRows.length).toBe(2)
      expect(tableRows[0].find('td').text()).toBe('2024001')
    })

    it('教师应该能够按文言文ID查询答题数据', async () => {
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

      const mockStudentRows = [
        { student_id: '2024001', student_name: '张三', class_code: '240109', created_at: '2024-01-01' },
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

      mockGet.mockImplementation((url: string) => {
        if (url === '/api/teacher/students') {
          return Promise.resolve({ success: true, message: 'ok', data: mockStudentRows })
        }
        if (url === '/api/answers/wen/WEN_01') {
          return Promise.resolve({
            success: true,
            message: 'ok',
            data: { students: mockWenAnswers, studentCount: 1 },
          })
        }
        return Promise.resolve({ success: true, message: 'ok', data: [] })
      })

      mockPost.mockImplementation((url: string) => {
        if (url === '/api/auth/student/login') return Promise.resolve(loginEnvelope())
        if (url === '/api/submit') return Promise.resolve(submitEnvelope())
        return Promise.resolve({ success: true, message: 'ok' })
      })

      // ---- 1. 学生登录 ----
      const loginWrapper = mount(StudentLoginView)
      await loginWrapper.find('#studentId').setValue('2024001')
      await loginWrapper.find('#password').setValue('123456')
      await loginWrapper.find('form').trigger('submit')
      await flushPromises()

      const authStore = useAuthStore()
      expect(authStore.user?.studentId).toBe('2024001')

      // ---- 2. 答题并提交 ----
      const quizWrapper = mount(Level1Quiz, { props: { wenId: 'WEN_01' } })

      const firstOptions = quizWrapper.findAll('.quiz-item')[0].findAll('.option-btn')
      const secondOptions = quizWrapper.findAll('.quiz-item')[1].findAll('.option-btn')

      await firstOptions[2].trigger('click')
      await secondOptions[0].trigger('click')
      await flushPromises()

      await quizWrapper.find('.submit-btn').trigger('click')
      await flushPromises()

      expect(quizWrapper.emitted('submit')).toBeTruthy()
      // 登录态仍在时提交应真的打到后端（而不是退回本地判分）
      expect(mockPost).toHaveBeenCalledWith('/api/submit', expect.anything(), expect.anything())

      // ---- 3. 换成教师会话，按文言文查看答题数据 ----
      authStore.user = { id: '9', username: '李老师', studentId: '13800000000', role: 'teacher' }
      authStore.token = 'teacher-token'

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
