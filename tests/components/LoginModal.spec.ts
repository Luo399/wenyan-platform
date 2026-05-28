import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import LoginModal from '@/components/LoginModal.vue'

// Mock auth store
const mockLogin = vi.fn()
const mockClearError = vi.fn()

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    login: mockLogin,
    clearError: mockClearError,
    isLoading: false,
    error: null,
  }),
}))

describe('LoginModal.vue', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
  })

  describe('基础渲染测试', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(LoginModal, {
        props: {
          visible: true,
        },
      })
      expect(wrapper.exists()).toBe(true)
    })

    it('应该显示登录标题', () => {
      const wrapper = mount(LoginModal, {
        props: {
          visible: true,
        },
      })
      expect(wrapper.text()).toContain('用户登录')
    })

    it('应该显示学号输入框', () => {
      const wrapper = mount(LoginModal, {
        props: {
          visible: true,
        },
      })
      const input = wrapper.find('input#studentId')
      expect(input.exists()).toBe(true)
    })

    it('应该显示登录按钮', () => {
      const wrapper = mount(LoginModal, {
        props: {
          visible: true,
        },
      })
      expect(wrapper.text()).toContain('登录')
    })
  })

  describe('用户认证测试', () => {
    it('学号输入验证 - 空输入应该显示错误', async () => {
      const wrapper = mount(LoginModal, {
        props: {
          visible: true,
        },
      })
      
      const button = wrapper.find('button[type="submit"]')
      await button.trigger('click')
      
      expect(wrapper.text()).toContain('请输入学号')
    })

    it('学号输入验证 - 非空输入应该通过验证', async () => {
      const wrapper = mount(LoginModal, {
        props: {
          visible: true,
        },
      })
      
      const input = wrapper.find('input#studentId')
      await input.setValue('2024001')
      
      expect(wrapper.text()).not.toContain('请输入学号')
    })

    it('登录成功应该触发 login-success 事件', async () => {
      mockLogin.mockResolvedValue(undefined)
      
      const wrapper = mount(LoginModal, {
        props: {
          visible: true,
        },
      })
      
      const input = wrapper.find('input#studentId')
      await input.setValue('2024001')
      
      const button = wrapper.find('button[type="submit"]')
      await button.trigger('click')
      
      expect(mockLogin).toHaveBeenCalledWith('2024001')
      expect(wrapper.emitted('login-success')).toBeTruthy()
    })

    it('关闭按钮应该触发 close 事件', async () => {
      const wrapper = mount(LoginModal, {
        props: {
          visible: true,
        },
      })
      
      const closeBtn = wrapper.find('.close-btn')
      await closeBtn.trigger('click')
      
      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('交互功能测试', () => {
    it('点击外部区域应该关闭弹窗', async () => {
      const wrapper = mount(LoginModal, {
        props: {
          visible: true,
        },
      })
      
      const overlay = wrapper.find('.modal-overlay')
      await overlay.trigger('click')
      
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('点击弹窗内部不应该关闭', async () => {
      const wrapper = mount(LoginModal, {
        props: {
          visible: true,
        },
      })
      
      const container = wrapper.find('.modal-container')
      await container.trigger('click')
      
      expect(wrapper.emitted('close')).toBeFalsy()
    })

    it('ESC 键应该关闭弹窗', async () => {
      const wrapper = mount(LoginModal, {
        props: {
          visible: true,
        },
      })
      
      await wrapper.trigger('keydown', { key: 'Escape' })
      
      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('加载状态测试', () => {
    it('加载中应该显示加载文字', async () => {
      const mockStore = {
        login: mockLogin,
        clearError: mockClearError,
        isLoading: true,
        error: null,
      }
      
      vi.mock('@/stores/auth', () => ({
        useAuthStore: () => mockStore,
      }))
      
      const wrapper = mount(LoginModal, {
        props: {
          visible: true,
        },
      })
      
      expect(wrapper.text()).toContain('登录中...')
    })
  })

  describe('记住登录状态测试', () => {
    it('应该显示记住登录状态复选框', () => {
      const wrapper = mount(LoginModal, {
        props: {
          visible: true,
        },
      })
      
      const checkbox = wrapper.find('.checkbox-input')
      expect(checkbox.exists()).toBe(true)
    })

    it('记住登录状态默认应该选中', () => {
      const wrapper = mount(LoginModal, {
        props: {
          visible: true,
        },
      })
      
      const checkbox = wrapper.find('.checkbox-input')
      expect(checkbox.element.checked).toBe(true)
    })
  })
})
