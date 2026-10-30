import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory, type Router } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import StepView from '@/views/StepView.vue'

// StepOne/Two/ThreeView 已在 R1 合并为 StepView（stepone/steptwo/stepthree 共用），
// 本文件验证 steptwo 路由下的 Step 2 行为。
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

// Step 2 的数据来自 useDataLoader（/data/<dataDir>/<wenId>.json），
// 这里直接给出已加载的 pageConfig，避免走 fetch/Worker 链路
vi.mock('@/composables/useDataLoader', async () => {
  const { ref } = await import('vue')
  return {
    useDataLoader: vi.fn(() => ({
      loading: ref(false),
      error: ref<string | null>(null),
      isTimeout: ref(false),
      data: ref({ title: '测试页面', blocks: [] }),
      load: vi.fn(),
      retry: vi.fn(),
    })),
  }
})

describe('StepView.vue（step 2 / steptwo）', () => {
  const pinia = createPinia()
  setActivePinia(pinia)

  let router: Router
  beforeEach(async () => {
    vi.clearAllMocks()
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', name: 'home', component: { template: '<div></div>' } },
        { path: '/steptwo/:id', name: 'steptwo', component: StepView },
      ],
    })
    await router.push('/steptwo/1')
    await router.isReady()
  })

  const mountStep = () =>
    mount(StepView, {
      global: {
        plugins: [router, pinia],
        stubs: {
          BlockRenderer: { name: 'BlockRenderer', template: '<div class="block-stub"></div>' },
          WordList: true,
          MultiRoleReading: true,
          CultureCards: true,
        },
      },
    })

  describe('基础渲染测试', () => {
    it('应该正确渲染 Step 2 壳子', () => {
      const wrapper = mountStep()
      expect(wrapper.find('.step-2-view').exists()).toBe(true)
      expect(wrapper.find('.page-scaffold').exists()).toBe(true)
      expect(wrapper.find('.page-scaffold-title').text()).toBeTruthy()
    })

    it('应该显示返回按钮', () => {
      const wrapper = mountStep()
      expect(wrapper.find('.back-btn').text()).toContain('返回')
    })

    it('未完成答题也显示继续按钮（答题只解锁解析，不拦导航）', () => {
      const wrapper = mountStep()
      expect(wrapper.find('.continue-btn').exists()).toBe(true)
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

  describe('答题进度测试', () => {
    it('已加载 pageConfig 时应渲染 blocks 容器', () => {
      const wrapper = mountStep()
      expect(wrapper.find('.blocks-container').exists()).toBe(true)
    })
  })
})
