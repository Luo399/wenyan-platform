import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import StepView from '../StepView.vue'

/**
 * StepView 回归测试
 *
 * 1. 第二关：答完最后一题后，题目后面的解析 dialogue 必须解锁。
 *    旧逻辑只按 currentIndex 截断，而 currentIndex 在最后一题不再前进，
 *    末尾 dialogue 永远 show=false。
 * 2. 第一关：level1_quiz 对应 A 关，题目要渲染出来，提交时
 *    questionId 用 WEN_nn_A{n}、module 用 A，后端不能收到 stepone: 前缀。
 */

const h = vi.hoisted(() => ({
  route: { name: 'steptwo', params: { id: '01' } } as { name: string; params: { id: string } },
  loggedIn: false,
  pageError: null as string | null,
  loaderUrls: [] as string[],
  pageConfig: {
    title: '测试课文',
    blocks: [
      { type: 'dialogue', data: { pre_dialog: '旁白：故事开始' } },
      { type: 'quiz', data: { question_id: 'WEN_01_B1' } },
      { type: 'dialogue', data: { pre_dialog: '旁白：第一题解析' } },
      { type: 'quiz', data: { question_id: 'WEN_01_B2' } },
      { type: 'dialogue', data: { pre_dialog: '旁白：第二题解析' } },
    ],
  },
  level1Quiz: [
    {
      text_id: 'WEN_01',
      question_number: 1,
      question_text: '第一关测试题',
      option_a: '甲选项',
      option_b: '乙选项',
      option_c: '丙选项',
      option_d: '丁选项',
      correct_answer: 'C',
      correct_index: 2,
      explanation: '丙选项正确',
      difficulty: 'L1',
      question_type: 'radio',
    },
  ],
}))

vi.mock('vue-router', () => ({
  useRoute: () => h.route,
}))

vi.mock('@/utils/asset', () => ({
  getDataUrlWithVersion: (dir: string, file: string) => `/data/${dir}/${file}`,
  // 与 utils/asset 的 getDataUrl 在「ossBase 未配置」时的拼法一致
  getDataUrl: (dir: string, file: string) => `/data/${dir}/${file}`,
}))

vi.mock('@/utils/tracking', () => ({
  markNextEnterFromBackButton: vi.fn(),
}))

vi.mock('@/composables/useNavigation', () => ({
  useNavigation: () => ({ goNext: vi.fn(), goPrev: vi.fn() }),
}))

vi.mock('@/composables/useTracking', () => ({
  useTracking: () => ({
    trackInteraction: vi.fn(),
    trackQuizSubmit: vi.fn(),
  }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    get isLoggedIn() {
      return h.loggedIn
    },
    get user() {
      return h.loggedIn ? { studentId: 'S001', username: '测试学生' } : null
    },
    initialize: vi.fn(),
  }),
}))

const apiMock = vi.hoisted(() => ({
  submitSingleAnswer: vi.fn(),
  submitAnswers: vi.fn(),
}))

vi.mock('@/services/apiService', () => apiMock)

vi.mock('@/composables/useDataLoader', async () => {
  const { ref } = await import('vue')
  return {
    useDataLoader: (urlGetter: () => string | Promise<string>) => {
      const url = urlGetter()
      h.loaderUrls.push(url)
      const data = ref<unknown>(null)
      const error = ref<string | null>(null)
      if (typeof url === 'string') {
        if (url.includes('pages_level2_dialog_quiz')) {
          if (h.pageError) error.value = h.pageError
          else data.value = h.pageConfig
        } else if (url.includes('level1_quiz')) {
          data.value = h.level1Quiz
        }
      }
      return {
        data,
        loading: ref(false),
        error,
        isTimeout: ref(false),
        retry: vi.fn(),
        load: vi.fn(),
      }
    },
  }
})

const PageScaffoldStub = defineComponent({
  name: 'PageScaffold',
  props: [
    'title',
    'subtitle',
    'loading',
    'error',
    'isEmpty',
    'emptyText',
    'showNavigation',
    'showContinue',
  ],
  template: '<div class="page-scaffold-stub"><slot /></div>',
})

const BlockRendererStub = defineComponent({
  name: 'BlockRenderer',
  props: ['block', 'show'],
  emits: ['quiz-answer'],
  template: `
    <div class="block-stub" :data-type="block.type" :data-show="show ? '1' : '0'">
      <button
        class="block-answer"
        @click="$emit('quiz-answer', {
          answer: 1,
          isCorrect: true,
          questionId: block.data?.question_id,
          module: 'B',
          correctAnswer: 1,
        })"
      >答</button>
    </div>
  `,
})

function mountStep() {
  return mount(StepView, {
    global: {
      stubs: {
        WordList: true,
        MultiRoleReading: true,
        BackContinue: true,
        CultureCards: true,
        PageScaffold: PageScaffoldStub,
        BlockRenderer: BlockRendererStub,
      },
    },
  })
}

describe('StepView', () => {
  beforeEach(() => {
    h.route = { name: 'steptwo', params: { id: '01' } }
    h.loggedIn = false
    h.pageError = null
    h.loaderUrls.length = 0
    apiMock.submitSingleAnswer.mockReset()
    apiMock.submitSingleAnswer.mockResolvedValue({})
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('第二关页面数据未交付的编号显示「制作中」占位，不再发数据请求', async () => {
    // 20 号位篇目未确认，也没有 pages_level2_dialog_quiz/WEN_20.json
    h.route = { name: 'steptwo', params: { id: '20' } }
    const wrapper = mountStep()
    await flushPromises()

    expect(wrapper.find('.step-not-ready').exists()).toBe(true)
    expect(wrapper.text()).toContain('本篇素材正在制作中，敬请期待')
    expect(wrapper.find('.block-stub').exists()).toBe(false)
    // 三个 loader 的 URL 都应被空串短路，不产生 HTTP 404
    expect(h.loaderUrls.filter((url) => url !== '')).toEqual([])
  })

  it('第二关页面数据已交付的 WEN_05 不再被第一关缺失挡成「制作中」', async () => {
    h.route = { name: 'steptwo', params: { id: '05' } }
    const wrapper = mountStep()
    await flushPromises()

    expect(wrapper.find('.step-not-ready').exists()).toBe(false)
    expect(wrapper.findAll('.block-stub')).toHaveLength(5)
    expect(h.loaderUrls).toContain('/data/pages_level2_dialog_quiz/WEN_05.json')
  })

  it('第一关仍按完整文本数据放行：WEN_05 缺字词/朗读数据时显示「制作中」', async () => {
    h.route = { name: 'stepone', params: { id: '05' } }
    const wrapper = mountStep()
    await flushPromises()

    expect(wrapper.find('.step-not-ready').exists()).toBe(true)
    expect(h.loaderUrls.filter((url) => url !== '')).toEqual([])
  })

  it('第二关加载失败时仍保留底部导航（可以返回）', async () => {
    h.pageError = 'HTTP 404'
    const wrapper = mountStep()
    await flushPromises()

    const scaffold = wrapper.findComponent(PageScaffoldStub)
    expect(scaffold.props('showNavigation')).toBe(true)
    expect(scaffold.props('error')).toBe('HTTP 404')
  })

  it('第二关最后一题提交后，末尾解析 dialogue 必须显示', async () => {
    const wrapper = mountStep()
    await flushPromises()

    const blocks = wrapper.findAll('.block-stub')
    expect(blocks).toHaveLength(5)
    expect(blocks[4].attributes('data-show')).toBe('0')

    await blocks[1].find('.block-answer').trigger('click')
    await flushPromises()
    expect(blocks[2].attributes('data-show')).toBe('1')
    expect(blocks[3].attributes('data-show')).toBe('1')
    expect(blocks[4].attributes('data-show')).toBe('0')

    await blocks[3].find('.block-answer').trigger('click')
    await flushPromises()
    expect(blocks[4].attributes('data-show')).toBe('1')
  })

  it('第一关渲染选择题并按 A 关题号提交', async () => {
    h.route = { name: 'stepone', params: { id: '01' } }
    h.loggedIn = true

    const wrapper = mountStep()
    await flushPromises()

    expect(wrapper.find('.quiz-card').exists()).toBe(true)
    expect(wrapper.text()).toContain('第一关测试题')

    const options = wrapper.findAll('.option-btn')
    expect(options).toHaveLength(4)
    await options[2].trigger('click')
    await wrapper.find('.quiz-card-footer .submit-btn').trigger('click')
    await flushPromises()

    expect(wrapper.find('.explanation-box').exists()).toBe(true)
    expect(wrapper.text()).toContain('练习完成')

    expect(apiMock.submitSingleAnswer).toHaveBeenCalledTimes(1)
    expect(apiMock.submitSingleAnswer.mock.calls[0][0]).toMatchObject({
      wenId: 'WEN_01',
      questionId: 'WEN_01_A1',
      userAnswer: 2,
      correctAnswer: 2,
    })
    expect(String(apiMock.submitSingleAnswer.mock.calls[0][0].questionId)).not.toContain('stepone:')
  })
})
