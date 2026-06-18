import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from '@vue/runtime-core'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const mockLogin = vi.fn()
const mockClearError = vi.fn()
const mockFetchStudentName = vi.fn()

const mockAuthState = {
  isLoading: false,
  error: null,
  isLoggedIn: false,
  user: null,
  token: null,
}

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    login: mockLogin,
    clearError: mockClearError,
    fetchStudentName: mockFetchStudentName,
    get isLoading() {
      return mockAuthState.isLoading
    },
    get error() {
      return mockAuthState.error
    },
    get isLoggedIn() {
      return mockAuthState.isLoggedIn
    },
    get user() {
      return mockAuthState.user
    },
    get token() {
      return mockAuthState.token
    },
  })),
}))

vi.mock('@/utils/api', () => ({
  get: vi.fn(() => Promise.resolve({ success: true, data: { name: '测试学生' } })),
}))

import LoginModal from '@/components/LoginModal.vue'

describe('LoginModal.vue', () => {
  let teleportContainer: HTMLElement

  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
    mockAuthState.isLoading = false
    mockAuthState.error = null
    mockAuthState.isLoggedIn = false
    mockAuthState.user = null
    mockAuthState.token = null
    teleportContainer = document.createElement('div')
    teleportContainer.id = 'teleport-target'
    document.body.appendChild(teleportContainer)
  })

  afterEach(() => {
    document.body.removeChild(teleportContainer)
  })

  const createWrapper = (visible = true) => {
    return mount(LoginModal, {
      props: {
        visible,
      },
      global: {
        stubs: {
          Teleport: true,
        },
      },
    })
  }

  describe('基础渲染测试', () => {
    it('应该正确渲染组件', () => {
      const wrapper = createWrapper()
      expect(wrapper.exists()).toBe(true)
      wrapper.unmount()
    })

    it('应该显示登录标题', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('用户登录')
      wrapper.unmount()
    })

    it('应该显示学号输入框', () => {
      const wrapper = createWrapper()
      const input = wrapper.find('input#studentId')
      expect(input.exists()).toBe(true)
      wrapper.unmount()
    })

    it('应该显示登录按钮', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('登录')
      wrapper.unmount()
    })
  })

  describe('用户认证测试', () => {
    it('学号输入验证 - 空输入应该显示错误', async () => {
      const wrapper = createWrapper()

      const button = wrapper.find('button[type="submit"]')
      await button.trigger('click')

      expect(wrapper.text()).toContain('请输入学号')
      wrapper.unmount()
    })

    it('学号输入验证 - 非空输入应该通过验证', async () => {
      const wrapper = createWrapper()

      const input = wrapper.find('input#studentId')
      await input.setValue('2024001')
      await nextTick()

      const errorMessage = wrapper.find('.error-message')
      expect(errorMessage.exists()).toBe(false)
      wrapper.unmount()
    })

    it('登录成功应该触发 login-success 事件', async () => {
      mockLogin.mockResolvedValue(undefined)

      const wrapper = createWrapper()

      const input = wrapper.find('input#studentId')
      await input.setValue('2024001')
      await nextTick()

      const form = wrapper.find('form.login-form')
      await form.trigger('submit')
      await nextTick()

      expect(mockLogin).toHaveBeenCalled()
      expect(wrapper.emitted('login-success')).toBeTruthy()
      wrapper.unmount()
    })

    it('关闭按钮应该触发 close 事件', async () => {
      const wrapper = createWrapper()

      const closeBtn = wrapper.find('.close-btn')
      await closeBtn.trigger('click')

      expect(wrapper.emitted('close')).toBeTruthy()
      wrapper.unmount()
    })
  })

  describe('交互功能测试', () => {
    it('点击外部区域应该关闭弹窗', async () => {
      const wrapper = createWrapper()

      const overlay = wrapper.find('.modal-overlay')
      await overlay.trigger('click')

      expect(wrapper.emitted('close')).toBeTruthy()
      wrapper.unmount()
    })

    it('点击弹窗内部不应该关闭', async () => {
      const wrapper = createWrapper()

      const containerEl = wrapper.find('.modal-container')
      await containerEl.trigger('click')

      expect(wrapper.emitted('close')).toBeFalsy()
      wrapper.unmount()
    })

    it('ESC 键应该关闭弹窗', async () => {
      const wrapper = createWrapper()

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await nextTick()

      expect(wrapper.emitted('close')).toBeTruthy()
      wrapper.unmount()
    })
  })

  describe('加载状态测试', () => {
    it('加载中应该显示加载文字', async () => {
      mockAuthState.isLoading = true

      const wrapper = createWrapper()

      expect(wrapper.text()).toContain('登录中...')

      mockAuthState.isLoading = false
      wrapper.unmount()
    })
  })

  describe('记住登录状态测试', () => {
    it('应该显示记住登录状态复选框', () => {
      const wrapper = createWrapper()

      const checkbox = wrapper.find('.checkbox-input')
      expect(checkbox.exists()).toBe(true)
      wrapper.unmount()
    })

    it('记住登录状态默认应该选中', () => {
      const wrapper = createWrapper()

      const checkbox = wrapper.find('.checkbox-input')
      expect(checkbox.element.checked).toBe(true)
      wrapper.unmount()
    })
  })
})
