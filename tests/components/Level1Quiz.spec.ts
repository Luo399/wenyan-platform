import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import Level1Quiz from '@/components/Level1Quiz.vue'
import BaseLoader from '@/components/common/BaseLoader.vue'
import BaseError from '@/components/common/BaseError.vue'
import BaseEmpty from '@/components/common/BaseEmpty.vue'
import { useDataLoader } from '@/composables/useDataLoader'

vi.mock('@/composables/useDataLoader')

const mockQuizData = [
  {
    text_id: 'WEN_01',
    question_number: 1,
    question_text: '测试题目1',
    option_a: '选项A内容',
    option_b: '选项B内容',
    option_c: '选项C内容',
    option_d: '选项D内容',
    correct_answer: 2,
    correct_index: 2,
    explanation: '答案解析内容',
    difficulty: 'L2',
  },
  {
    text_id: 'WEN_01',
    question_number: 2,
    question_text: '测试题目2',
    option_a: '选项A内容',
    option_b: '选项B内容',
    option_c: '选项C内容',
    option_d: '选项D内容',
    correct_answer: 1,
    correct_index: 1,
    explanation: '答案解析内容2',
    difficulty: 'L1',
  },
]

describe('Level1Quiz.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(useDataLoader).mockReturnValue({
      loading: ref(false),
      error: ref<string | null>(null),
      isTimeout: ref(false),
      data: ref(mockQuizData),
      retry: vi.fn(),
      load: vi.fn(),
    })
  })

  it('should render correctly', () => {
    const wrapper = mount(Level1Quiz, {
      props: { wenId: 'WEN_01' },
    })
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('.level1-quiz-container').exists()).toBe(true)
  })

  it('should display loading state', () => {
    vi.mocked(useDataLoader).mockReturnValue({
      loading: ref(true),
      error: ref<string | null>(null),
      isTimeout: ref(false),
      data: ref<null>(null),
      retry: vi.fn(),
      load: vi.fn(),
    })

    const wrapper = mount(Level1Quiz, {
      props: { wenId: 'WEN_01' },
    })
    expect(wrapper.findComponent(BaseLoader).exists()).toBe(true)
  })

  it('should display error state', () => {
    vi.mocked(useDataLoader).mockReturnValue({
      loading: ref(false),
      error: ref('加载失败'),
      isTimeout: ref(false),
      data: ref<null>(null),
      retry: vi.fn(),
      load: vi.fn(),
    })

    const wrapper = mount(Level1Quiz, {
      props: { wenId: 'WEN_01' },
    })
    expect(wrapper.findComponent(BaseError).exists()).toBe(true)
    expect(wrapper.findComponent(BaseError).props('error')).toBe('加载失败')
  })

  it('should display empty state when no data', () => {
    vi.mocked(useDataLoader).mockReturnValue({
      loading: ref(false),
      error: ref<string | null>(null),
      isTimeout: ref(false),
      data: ref([]),
      retry: vi.fn(),
      load: vi.fn(),
    })

    const wrapper = mount(Level1Quiz, {
      props: { wenId: 'WEN_01' },
    })
    expect(wrapper.findComponent(BaseEmpty).exists()).toBe(true)
  })

  it('should display quiz questions', () => {
    const wrapper = mount(Level1Quiz, {
      props: { wenId: 'WEN_01' },
    })
    const quizItems = wrapper.findAll('.quiz-item')
    expect(quizItems.length).toBe(2)
    expect(wrapper.text()).toContain('第 1 题')
    expect(wrapper.text()).toContain('第 2 题')
    expect(wrapper.text()).toContain('测试题目1')
    expect(wrapper.text()).toContain('测试题目2')
  })

  it('should display options', () => {
    const wrapper = mount(Level1Quiz, {
      props: { wenId: 'WEN_01' },
    })
    const optionBtns = wrapper.findAll('.option-btn')
    expect(optionBtns.length).toBe(8)

    const firstQuestionOptions = wrapper.findAll('.quiz-item')[0].findAll('.option-btn')
    expect(firstQuestionOptions.length).toBe(4)
    expect(firstQuestionOptions[0].text()).toContain('A')
    expect(firstQuestionOptions[1].text()).toContain('B')
    expect(firstQuestionOptions[2].text()).toContain('C')
    expect(firstQuestionOptions[3].text()).toContain('D')
  })

  it('should display difficulty tags', () => {
    const wrapper = mount(Level1Quiz, {
      props: { wenId: 'WEN_01' },
    })
    const difficultyTags = wrapper.findAll('.difficulty-tag')
    expect(difficultyTags.length).toBe(2)
    expect(difficultyTags[0].text()).toBe('L2')
    expect(difficultyTags[1].text()).toBe('L1')
    expect(difficultyTags[0].classes()).toContain('L2')
    expect(difficultyTags[1].classes()).toContain('L1')
  })

  it('should select option when clicked', async () => {
    const wrapper = mount(Level1Quiz, {
      props: { wenId: 'WEN_01' },
    })
    const firstOption = wrapper.findAll('.option-btn')[0]
    await firstOption.trigger('click')
    await flushPromises()
    expect(firstOption.classes()).toContain('selected')
  })

  it('should show explanation after submission', async () => {
    const wrapper = mount(Level1Quiz, {
      props: { wenId: 'WEN_01' },
    })

    const firstQuizOptions = wrapper.findAll('.quiz-item')[0].findAll('.option-btn')
    const secondQuizOptions = wrapper.findAll('.quiz-item')[1].findAll('.option-btn')

    await firstQuizOptions[0].trigger('click')
    await secondQuizOptions[0].trigger('click')
    await flushPromises()

    const submitBtn = wrapper.find('.submit-btn')
    await submitBtn.trigger('click')
    await flushPromises()

    const explanations = wrapper.findAll('.explanation')
    expect(explanations.length).toBe(2)
    expect(explanations[0].text()).toContain('答案解析')
  })

  it('should show correct and wrong states', async () => {
    const wrapper = mount(Level1Quiz, {
      props: { wenId: 'WEN_01' },
    })

    const firstQuizOptions = wrapper.findAll('.quiz-item')[0].findAll('.option-btn')
    const secondQuizOptions = wrapper.findAll('.quiz-item')[1].findAll('.option-btn')

    await firstQuizOptions[2].trigger('click')
    await secondQuizOptions[2].trigger('click')
    await flushPromises()

    const submitBtn = wrapper.find('.submit-btn')
    await submitBtn.trigger('click')
    await flushPromises()

    const refreshedFirstOptions = wrapper.findAll('.quiz-item')[0].findAll('.option-btn')
    expect(refreshedFirstOptions[2].classes()).toContain('correct')

    const refreshedSecondOptions = wrapper.findAll('.quiz-item')[1].findAll('.option-btn')
    expect(refreshedSecondOptions[2].classes()).toContain('wrong')
    expect(refreshedSecondOptions[1].classes()).toContain('correct')
  })

  it('should disable options after submission', async () => {
    const wrapper = mount(Level1Quiz, {
      props: { wenId: 'WEN_01' },
    })

    const firstQuizOptions = wrapper.findAll('.quiz-item')[0].findAll('.option-btn')
    const secondQuizOptions = wrapper.findAll('.quiz-item')[1].findAll('.option-btn')

    await firstQuizOptions[0].trigger('click')
    await secondQuizOptions[0].trigger('click')
    await flushPromises()

    const submitBtn = wrapper.find('.submit-btn')
    await submitBtn.trigger('click')
    await flushPromises()

    const allOptions = wrapper.findAll('.option-btn')
    allOptions.forEach((option) => {
      expect(option.classes()).toContain('disabled')
    })
  })

  it('should show result panel after submission', async () => {
    const wrapper = mount(Level1Quiz, {
      props: { wenId: 'WEN_01' },
    })

    const firstQuizOptions = wrapper.findAll('.quiz-item')[0].findAll('.option-btn')
    const secondQuizOptions = wrapper.findAll('.quiz-item')[1].findAll('.option-btn')

    await firstQuizOptions[2].trigger('click')
    await secondQuizOptions[2].trigger('click')
    await flushPromises()

    const submitBtn = wrapper.find('.submit-btn')
    await submitBtn.trigger('click')
    await flushPromises()

    expect(wrapper.find('.result-panel').exists()).toBe(true)
    expect(wrapper.text()).toContain('测试结果')
    expect(wrapper.text()).toContain('正确:')
    expect(wrapper.text()).toContain('得分:')
  })

  it('should emit submit and complete events', async () => {
    const wrapper = mount(Level1Quiz, {
      props: { wenId: 'WEN_01' },
    })

    const firstQuizOptions = wrapper.findAll('.quiz-item')[0].findAll('.option-btn')
    const secondQuizOptions = wrapper.findAll('.quiz-item')[1].findAll('.option-btn')

    await firstQuizOptions[2].trigger('click')
    await secondQuizOptions[2].trigger('click')
    await flushPromises()

    const submitBtn = wrapper.find('.submit-btn')
    await submitBtn.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('submit')).toBeTruthy()
    expect(wrapper.emitted('complete')).toBeTruthy()
    expect(wrapper.emitted('complete')?.[0][0]).toEqual({ correct: 1, total: 2 })
  })

  it('should reset quiz when reset button clicked', async () => {
    const wrapper = mount(Level1Quiz, {
      props: { wenId: 'WEN_01' },
    })

    const firstQuizOptions = wrapper.findAll('.quiz-item')[0].findAll('.option-btn')
    const secondQuizOptions = wrapper.findAll('.quiz-item')[1].findAll('.option-btn')

    await firstQuizOptions[2].trigger('click')
    await secondQuizOptions[2].trigger('click')
    await flushPromises()

    const submitBtn = wrapper.find('.submit-btn')
    await submitBtn.trigger('click')
    await flushPromises()

    expect(wrapper.find('.result-panel').exists()).toBe(true)

    const resetBtn = wrapper.find('.reset-btn')
    await resetBtn.trigger('click')
    await flushPromises()

    expect(wrapper.find('.result-panel').exists()).toBe(false)
    const allOptions = wrapper.findAll('.option-btn')
    allOptions.forEach((option) => {
      expect(option.classes()).not.toContain('selected')
      expect(option.classes()).not.toContain('correct')
      expect(option.classes()).not.toContain('wrong')
      expect(option.classes()).not.toContain('disabled')
    })
  })

  it('should disable submit button when not all questions answered', async () => {
    const wrapper = mount(Level1Quiz, {
      props: { wenId: 'WEN_01' },
    })

    const firstQuizOptions = wrapper.findAll('.quiz-item')[0].findAll('.option-btn')
    await firstQuizOptions[0].trigger('click')
    await flushPromises()

    const submitBtn = wrapper.find('.submit-btn')
    expect(submitBtn.attributes('disabled')).toBeDefined()
  })

  it('should enable submit button when all questions answered', async () => {
    const wrapper = mount(Level1Quiz, {
      props: { wenId: 'WEN_01' },
    })

    const firstQuizOptions = wrapper.findAll('.quiz-item')[0].findAll('.option-btn')
    const secondQuizOptions = wrapper.findAll('.quiz-item')[1].findAll('.option-btn')

    await firstQuizOptions[0].trigger('click')
    await secondQuizOptions[0].trigger('click')
    await flushPromises()

    const submitBtn = wrapper.find('.submit-btn')
    expect(submitBtn.attributes('disabled')).toBeUndefined()
  })

  it('should support custom baseUrl prop', () => {
    vi.mocked(useDataLoader).mockImplementation((urlFn: () => string) => {
      expect(urlFn()).toBe('/custom/path/WEN_01.json')
      return {
        loading: ref(false),
        error: ref<string | null>(null),
        isTimeout: ref(false),
        data: ref(mockQuizData),
        retry: vi.fn(),
        load: vi.fn(),
      }
    })

    mount(Level1Quiz, {
      props: { wenId: 'WEN_01', baseUrl: '/custom/path/' },
    })
  })

  it('should support autoLoad prop set to false', () => {
    vi.mocked(useDataLoader).mockImplementation((urlFn: () => string, options: unknown) => {
      const opts = options as { autoLoad?: boolean }
      expect(opts.autoLoad).toBe(false)
      return {
        loading: ref(false),
        error: ref<string | null>(null),
        isTimeout: ref(false),
        data: ref(mockQuizData),
        retry: vi.fn(),
        load: vi.fn(),
      }
    })

    mount(Level1Quiz, {
      props: { wenId: 'WEN_01', autoLoad: false },
    })
  })

  it('should handle correct_answer without correct_index', async () => {
    const dataWithoutIndex = [
      {
        text_id: 'WEN_01',
        question_number: 1,
        question_text: '测试题目',
        option_a: '选项A',
        option_b: '选项B',
        option_c: '选项C',
        option_d: '选项D',
        correct_answer: 1,
        explanation: '答案解析',
        difficulty: 'L1',
      },
    ]

    vi.mocked(useDataLoader).mockReturnValue({
      loading: ref(false),
      error: ref<string | null>(null),
      isTimeout: ref(false),
      data: ref(dataWithoutIndex),
      retry: vi.fn(),
      load: vi.fn(),
    })

    const wrapper = mount(Level1Quiz, {
      props: { wenId: 'WEN_01' },
    })

    const options = wrapper.findAll('.quiz-item')[0].findAll('.option-btn')
    await options[1].trigger('click')
    await flushPromises()

    const submitBtn = wrapper.find('.submit-btn')
    await submitBtn.trigger('click')
    await flushPromises()

    const refreshedOptions = wrapper.findAll('.quiz-item')[0].findAll('.option-btn')
    expect(refreshedOptions[1].classes()).toContain('correct')
  })

  it('should trigger retry on error state', async () => {
    const retrySpy = vi.fn()
    vi.mocked(useDataLoader).mockReturnValue({
      loading: ref(false),
      error: ref('加载失败'),
      isTimeout: ref(false),
      data: ref<null>(null),
      retry: retrySpy,
      load: vi.fn(),
    })

    const wrapper = mount(Level1Quiz, {
      props: { wenId: 'WEN_01' },
    })

    await flushPromises()

    const baseError = wrapper.findComponent(BaseError)
    await baseError.vm.$emit('retry')
    await flushPromises()

    expect(retrySpy).toHaveBeenCalled()
  })
})
