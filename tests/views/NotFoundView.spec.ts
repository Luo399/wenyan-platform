import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import NotFoundView from '@/views/NotFoundView.vue'

// Mock useNavigation：验证组件不直接调用 router.push，而是走 goHome
const mockGoHome = vi.fn()
vi.mock('@/composables/useNavigation', () => ({
  useNavigation: () => ({ goHome: mockGoHome }),
}))

describe('NotFoundView.vue', () => {
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
      const wrapper = mount(NotFoundView, {
        global: {
          plugins: [router, pinia],
        },
      })
      expect(wrapper.exists()).toBe(true)
    })

    it('应该显示 404 标题', () => {
      const wrapper = mount(NotFoundView, {
        global: {
          plugins: [router, pinia],
        },
      })
      expect(wrapper.find('h1').text()).toBe('404')
    })

    it('应该显示页面未找到提示', () => {
      const wrapper = mount(NotFoundView, {
        global: {
          plugins: [router, pinia],
        },
      })
      expect(wrapper.find('.message').text()).toContain('页面未找到')
    })

    it('应该包含返回首页按钮', () => {
      const wrapper = mount(NotFoundView, {
        global: {
          plugins: [router, pinia],
        },
      })
      expect(wrapper.find('.back-btn').exists()).toBe(true)
      expect(wrapper.find('.back-btn').text()).toContain('返回首页')
    })
  })

  describe('goBack 行为测试（C06 核心验证）', () => {
    it('点击"返回首页"按钮应调用 useNavigation().goHome()', async () => {
      const wrapper = mount(NotFoundView, {
        global: {
          plugins: [router, pinia],
        },
      })
      await wrapper.find('.back-btn').trigger('click')
      expect(mockGoHome).toHaveBeenCalledTimes(1)
    })

    it('初始状态不应调用 goHome', () => {
      mount(NotFoundView, {
        global: {
          plugins: [router, pinia],
        },
      })
      expect(mockGoHome).not.toHaveBeenCalled()
    })
  })
})
