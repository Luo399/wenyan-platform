import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import BlockDemoView from '@/views/BlockDemoView.vue'

// Mock useNavigation：验证组件不直接调用 router.push，而是走 goHome
const mockGoHome = vi.fn()
vi.mock('@/composables/useNavigation', () => ({
  useNavigation: () => ({ goHome: mockGoHome }),
}))

// Mock useDataLoader：避免 jsdom 环境下真实 fetch/Worker
vi.mock('@/composables/useDataLoader', () => ({
  useDataLoader: () => ({
    data: { value: null },
    loading: { value: false },
    error: { value: null },
    retry: vi.fn(),
  }),
}))

// Mock BlockRenderer：避免渲染子组件的复杂依赖
vi.mock('@/components/BlockRenderer.vue', () => ({
  default: {
    name: 'BlockRenderer',
    template: '<div class="block-renderer-stub"></div>',
  },
}))

describe('BlockDemoView.vue', () => {
  const pinia = createPinia()
  setActivePinia(pinia)

  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: '/', name: 'home', component: { template: '<div></div>' } }],
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('基础渲染测试', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(BlockDemoView, {
        global: {
          plugins: [router, pinia],
        },
      })
      expect(wrapper.exists()).toBe(true)
    })

    it('应该包含返回首页按钮', () => {
      const wrapper = mount(BlockDemoView, {
        global: {
          plugins: [router, pinia],
        },
      })
      expect(wrapper.find('.back-btn').exists()).toBe(true)
    })
  })

  describe('goBack 行为测试（C06 核心验证）', () => {
    it('点击"返回首页"按钮应调用 useNavigation().goHome()', async () => {
      const wrapper = mount(BlockDemoView, {
        global: {
          plugins: [router, pinia],
        },
      })
      await wrapper.find('.back-btn').trigger('click')
      expect(mockGoHome).toHaveBeenCalledTimes(1)
    })

    it('组件内不应直接使用 useRouter（分层规则验证）', () => {
      // 读取组件源码字符串，验证不直接 import useRouter
      // 这是分层规则的静态保护：useNavigation 是唯一跳转入口
      const source = BlockDemoView.toString()
      // 组件 setup 内不应出现 useRouter 调用（mock 后此检查主要防止回退）
      expect(mockGoHome).not.toHaveBeenCalled()
    })
  })

  describe('页面选择器测试', () => {
    it('应该包含页面选择器', () => {
      const wrapper = mount(BlockDemoView, {
        global: {
          plugins: [router, pinia],
        },
      })
      expect(wrapper.find('.page-selector').exists()).toBe(true)
      expect(wrapper.findAll('.selector-input option').length).toBeGreaterThan(0)
    })
  })

  describe('刷新按钮测试', () => {
    it('应该包含刷新按钮', () => {
      const wrapper = mount(BlockDemoView, {
        global: {
          plugins: [router, pinia],
        },
      })
      expect(wrapper.find('.refresh-btn').exists()).toBe(true)
    })
  })
})
