import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import FigmaPageView from '@/views/FigmaPageView.vue'

const mockRouter = { push: vi.fn(), back: vi.fn() }

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'WEN_01' } }),
  useRouter: () => mockRouter,
}))

const pageData = {
  pageId: 'WEN_01',
  items: [
    {
      text: '情景一',
      quiz: {
        question_id: 'WEN_01_C1',
        module: 'C',
        question_text: '第一题题干',
        options: ['甲', '乙'],
        correct_answer: 0,
      },
    },
    {
      quiz: {
        question_id: 'WEN_01_C2',
        module: 'C',
        question_text: '第二题题干',
        options: ['甲', '乙'],
        correct_answer: 0,
      },
    },
  ],
}

vi.mock('@/composables/useDataLoader', () => ({
  useDataLoader: vi.fn(() => ({
    data: ref(pageData),
    loading: ref(false),
    error: ref<string | null>(null),
    isTimeout: ref(false),
    retry: vi.fn(),
    load: vi.fn(),
  })),
}))

const effects = {
  submitAnswer: vi.fn(async () => ({ ok: true })),
  markCompleted: vi.fn(),
  resetCompletion: vi.fn(),
}

vi.mock('@/composables/useQuizEffects', () => ({
  useQuizEffects: () => effects,
}))

vi.mock('@/composables/useTracking', () => ({
  useTracking: () => ({ stepId: 'stepthree_WEN_01', trackQuizSubmit: vi.fn() }),
}))

// 文化卡片依赖自身数据加载，集成测试用替身隔离
vi.mock('@/components/CultureCards.vue', () => ({
  default: { name: 'CultureCardsStub', template: '<div class="culture-cards-stub" />' },
}))

describe('集成：加载 → 选择 → 提交 → 解锁 → 完成', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('走完整答题链路，提交只发归一化答案且完成后写完成记录', async () => {
    const wrapper = mount(FigmaPageView, { props: { pageKey: 'stepthree' } })
    await flushPromises()

    // 1. 两题都预挂载，第二题未解锁
    const items = () => wrapper.findAll('.fg-quiz-item')
    expect(items()).toHaveLength(2)
    expect(items()[0]!.attributes('aria-hidden')).toBe('false')
    expect(items()[1]!.attributes('aria-hidden')).toBe('true')

    // 2. 第一题选择 A 并提交
    await items()[0]!.findAll('.fg-option')[0]!.trigger('click')
    await items()[0]!.find('.fg-submit-btn').trigger('click')
    await flushPromises()

    expect(effects.submitAnswer).toHaveBeenCalledTimes(1)
    const firstCall = effects.submitAnswer.mock.calls[0] as unknown as [
      { id: string },
      string[],
    ]
    expect(firstCall[0].id).toBe('WEN_01_C1')
    expect(firstCall[1]).toEqual(['A'])

    // 3. 提交成功后第二题解锁（未卸载）
    expect(items()).toHaveLength(2)
    expect(items()[1]!.attributes('aria-hidden')).toBe('false')

    // 4. 第二题作答并提交，触发完成态与完成记录
    await items()[1]!.findAll('.fg-option')[0]!.trigger('click')
    await items()[1]!.find('.fg-submit-btn').trigger('click')
    await flushPromises()

    expect(effects.submitAnswer).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('测验完成！')
    expect(wrapper.text()).toContain('答对 2 / 2 题')
    expect(effects.markCompleted).toHaveBeenCalledWith(2, 2)
    // 完成后展示文化卡片（保持重构前行为）
    expect(wrapper.find('.culture-cards-stub').exists()).toBe(true)
  })

  it('提交失败时不推进、不写完成记录，并展示可重试提示', async () => {
    effects.submitAnswer.mockResolvedValueOnce({ ok: false, error: '网络异常' })

    const wrapper = mount(FigmaPageView, { props: { pageKey: 'stepthree' } })
    await flushPromises()

    const first = wrapper.findAll('.fg-quiz-item')[0]!
    await first.findAll('.fg-option')[0]!.trigger('click')
    await first.find('.fg-submit-btn').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.fg-quiz-item')[1]!.attributes('aria-hidden')).toBe('true')
    expect(wrapper.text()).toContain('网络异常')
    expect(effects.markCompleted).not.toHaveBeenCalled()
    // 作答保留，可再次提交
    expect(first.find('.fg-submit-btn').attributes('disabled')).toBeUndefined()
  })
})
