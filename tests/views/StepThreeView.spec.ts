import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory, type Router } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import StepView from '@/views/StepView.vue'

// StepOne/Two/ThreeView 已在 R1 合并为 StepView（stepone/steptwo/stepthree 共用），
// 本文件验证 stepthree 路由下的 Step 3 行为。
const { mockGoNext, mockGoPrev } = vi.hoisted(() => ({
  mockGoNext: vi.fn(),
  mockGoPrev: vi.fn(),
}))

vi.mock('@/composables/useNavigation', () => ({
  useNavigation: () => ({ goNext: mockGoNext, goPrev: mockGoPrev }),
}))

vi.mock('@/utils/debug', () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
  debugError: vi.fn(),
}))

// Step 3 的数据来自 useDataLoader；同时返回 blocks: [] 以兼容 Step 2 的 watch
vi.mock('@/composables/useDataLoader', async () => {
  const { ref } = await import('vue')
  return {
    useDataLoader: vi.fn(() => ({
      loading: ref(false),
      error: ref<string | null>(null),
      isTimeout: ref(false),
      data: ref({
        title: '测试页面',
        blocks: [],
        items: [
          {
            text: '情境描述',
            quiz: {
              question_type: 'radio',
              question_text: '下列哪一项正确？',
              options: ['A', 'B'],
              correct_answer: 0,
              explanation: '因为 A',
              difficulty: 'easy',
            },
          },
        ],
      }),
      load: vi.fn(),
      retry: vi.fn(),
    })),
  }
})

describe('StepView.vue（step 3 / stepthree）', () => {
  const pinia = createPinia()
  setActivePinia(pinia)

  let router: Router
  beforeEach(async () => {
    vi.clearAllMocks()
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', name: 'home', component: { template: '<div></div>' } },
        { path: '/stepthree/:id', name: 'stepthree', component: StepView },
      ],
    })
    await router.push('/stepthree/1')
    await router.isReady()
  })

  const mountStep = () =>
    mount(StepView, {
      global: {
        plugins: [router, pinia],
        stubs: {
          QuizCard: {
            name: 'QuizCard',
            props: ['data', 'submitted'],
            template: '<div class="quiz-card-stub"></div>',
          },
          CultureCards: true,
          BlockRenderer: true,
          WordList: true,
          MultiRoleReading: true,
        },
      },
    })

  describe('基础渲染测试', () => {
    it('应该正确渲染 Step 3 壳子', () => {
      const wrapper = mountStep()
      expect(wrapper.find('.step-3-view').exists()).toBe(true)
      expect(wrapper.find('.quiz-list').exists()).toBe(true)
    })

    it('应该显示返回按钮', () => {
      const wrapper = mountStep()
      expect(wrapper.find('.back-btn').text()).toContain('返回')
    })

    it('初始状态不应该显示继续按钮（未答完）', () => {
      const wrapper = mountStep()
      expect(wrapper.find('.continue-btn').exists()).toBe(false)
    })

    it('应该按 items 渲染题目并显示进度', () => {
      const wrapper = mountStep()
      expect(wrapper.findAll('.quiz-item')).toHaveLength(1)
      expect(wrapper.find('.progress-text').text()).toContain('0 / 1')
    })
  })

  describe('导航功能测试', () => {
    it('点击返回按钮应该触发 goPrev', async () => {
      const wrapper = mountStep()
      await wrapper.find('.back-btn').trigger('click')
      expect(mockGoPrev).toHaveBeenCalledTimes(1)
    })

    it('BackContinue 触发 continue 事件应该调用 goNext', async () => {
      const wrapper = mountStep()
      wrapper.findComponent({ name: 'BackContinue' }).vm.$emit('continue')
      await wrapper.vm.$nextTick()
      expect(mockGoNext).toHaveBeenCalledTimes(1)
    })
  })
})
