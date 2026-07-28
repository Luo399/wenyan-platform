import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import LoginModal from '@/components/LoginModal.vue'

vi.mock('@/stores/auth', () => {
  const mockLogin = vi.fn()
  const mockClearError = vi.fn()
  const mockFetchStudentName = vi.fn()

  const mockAuthState = {
    login: mockLogin,
    clearError: mockClearError,
    fetchStudentName: mockFetchStudentName,
    isLoading: false,
    error: null,
    isLoggedIn: false,
    user: null,
    token: null,
  }

  return {
    useAuthStore: () => mockAuthState,
  }
})

describe('LoginModal.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('基础渲染测试', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(LoginModal, {
        props: { visible: true },
        global: {
          stubs: {
            Teleport: true,
          },
        },
      })
      expect(wrapper.exists()).toBe(true)
    })

    it('应该显示登录标题', () => {
      const wrapper = mount(LoginModal, {
        props: { visible: true },
        global: {
          stubs: {
            Teleport: true,
          },
        },
      })
      expect(wrapper.text()).toContain('登录')
    })

    it('应该显示学号输入框', () => {
      const wrapper = mount(LoginModal, {
        props: { visible: true },
        global: {
          stubs: {
            Teleport: true,
          },
        },
      })
      const input = wrapper.find('input[type="text"]')
      expect(input.exists()).toBe(true)
    })

    it('应该显示登录按钮', () => {
      const wrapper = mount(LoginModal, {
        props: { visible: true },
        global: {
          stubs: {
            Teleport: true,
          },
        },
      })
      expect(wrapper.text()).toContain('登录')
    })
  })

  describe('交互功能测试', () => {
    it('点击弹窗内部不应该关闭', async () => {
      const wrapper = mount(LoginModal, {
        props: { visible: true },
        global: {
          stubs: {
            Teleport: true,
          },
        },
      })

      const modalContainer = wrapper.find('.modal-container')
      await modalContainer.trigger('click')
      await nextTick()

      expect(wrapper.emitted('close')).toBeFalsy()
    })

    it('点击外部区域应该关闭弹窗', async () => {
      const wrapper = mount(LoginModal, {
        props: { visible: true },
        global: {
          stubs: {
            Teleport: true,
          },
        },
      })

      const modalOverlay = wrapper.find('.modal-overlay')
      await modalOverlay.trigger('click')
      await nextTick()

      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('按下ESC键应该关闭弹窗', async () => {
      const wrapper = mount(LoginModal, {
        props: { visible: true },
        global: {
          stubs: {
            Teleport: true,
          },
        },
      })

      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      document.dispatchEvent(event)
      await nextTick()

      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('用户认证测试', () => {
    it('关闭按钮应该触发 close 事件', async () => {
      const wrapper = mount(LoginModal, {
        props: { visible: true },
        global: {
          stubs: {
            Teleport: true,
          },
        },
      })

      const closeBtn = wrapper.find('.close-btn')
      await closeBtn.trigger('click')
      await nextTick()

      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('登录成功应该触发 login-success 事件', async () => {
      const wrapper = mount(LoginModal, {
        props: { visible: true },
        global: {
          stubs: {
            Teleport: true,
          },
        },
      })

      const input = wrapper.find('input[type="text"]')
      await input.setValue('2024001')
      await nextTick()

      const form = wrapper.find('form')
      await form.trigger('submit')
      await flushPromises()

      expect(wrapper.emitted('login-success')).toBeTruthy()
    })

    it('学号输入验证 - 非空输入应该通过验证', async () => {
      const wrapper = mount(LoginModal, {
        props: { visible: true },
        global: {
          stubs: {
            Teleport: true,
          },
        },
      })

      const input = wrapper.find('input[type="text"]')
      await input.setValue('2024001')
      await nextTick()

      expect(wrapper.find('.error-message').exists()).toBe(false)
    })

    it('学号输入验证 - 空输入应该显示错误', async () => {
      const wrapper = mount(LoginModal, {
        props: { visible: true },
        global: {
          stubs: {
            Teleport: true,
          },
        },
      })

      const input = wrapper.find('input[type="text"]')
      await input.setValue('')
      await nextTick()

      const form = wrapper.find('form')
      await form.trigger('submit')
      await nextTick()

      expect(wrapper.find('.error-message').exists()).toBe(true)
    })
  })
})
