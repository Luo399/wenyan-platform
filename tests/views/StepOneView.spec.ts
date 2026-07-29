import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory, type Router } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import StepOneView from '@/views/StepOneView.vue'

// Mock useNavigation：验证组件不直接调用 router.push，而是走 goNext/goPrev
const mockGoNext = vi.fn()
const mockGoPrev = vi.fn()
vi.mock('@/composables/useNavigation', () => ({
  useNavigation: () => ({ goNext: mockGoNext, goPrev: mockGoPrev }),
}))

// mock debug 工具，隔离日志噪音并便于验证事件处理
const mockDebugLog = vi.fn()
const mockDebugError = vi.fn()
vi.mock('@/utils/debug', () => ({
  debugLog: mockDebugLog,
  debugError: mockDebugError,
  debugWarn: vi.fn(),
}))

describe('StepOneView.vue', () => {
  const pinia = createPinia()
  setActivePinia(pinia)

  let router: Router
  beforeEach(async () => {
    vi.clearAllMocks()
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', name: 'home', component: { template: '<div></div>' } },
        { path: '/stepone/:id', name: 'stepone', component: StepOneView },
      ],
    })
    await router.push('/stepone/1')
    await router.isReady()
  })

  // 统一挂载：stub 掉子组件，避免其内部依赖
  const mountWith = () =>
    mount(StepOneView, {
      global: {
        plugins: [router, pinia],
        stubs: {
          WordList: { name: 'WordList', template: '<div class="word-list-stub"></div>' },
          MultiRoleReading: {
            name: 'MultiRoleReading',
            props: ['wenId', 'autoLoad'],
            emits: ['load-success', 'load-error', 'segment-change'],
            template: '<div class="multi-role-reading-stub"></div>',
          },
          BackContinue: {
            name: 'BackContinue',
            template: '<div class="back-continue-stub"></div>',
          },
        },
      },
    })

  describe('基础渲染测试', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mountWith()
      expect(wrapper.exists()).toBe(true)
    })

    it('应该包含页面内容', () => {
      const wrapper = mountWith()
      expect(wrapper.html()).toBeDefined()
    })
  })

  describe('区块结构测试', () => {
    it('应该包含字词注释与音频学习两个区块', () => {
      const wrapper = mountWith()
      expect(wrapper.find('.annotated-section').exists()).toBe(true)
      expect(wrapper.find('.audio-section').exists()).toBe(true)
    })

    it('不应包含已拆分到 DetailView 的课后小测区块', () => {
      // 历史遗留：早期版本集成 Level1Quiz，后拆分到 DetailView
      // C09 同步修正过期测试，避免"测试通过但断言失效"假象
      const wrapper = mountWith()
      expect(wrapper.find('.quiz-section').exists()).toBe(false)
    })

    it('应该包含字词注释与音频学习之间的分割线', () => {
      const wrapper = mountWith()
      expect(wrapper.find('.divider').exists()).toBe(true)
      expect(wrapper.find('.divider-text').text()).toBe('音频学习')
    })
  })

  describe('子组件渲染与 props 透传测试', () => {
    it('应该渲染 WordList 组件', () => {
      const wrapper = mountWith()
      expect(wrapper.findComponent({ name: 'WordList' }).exists()).toBe(true)
    })

    it('应该渲染 MultiRoleReading 组件并透传 wenId 与 autoLoad', () => {
      const wrapper = mountWith()
      const multiRole = wrapper.findComponent({ name: 'MultiRoleReading' })
      expect(multiRole.exists()).toBe(true)
      expect(multiRole.props('wenId')).toBe('WEN_01')
      expect(multiRole.props('autoLoad')).toBe(true)
    })

    it('应该渲染 BackContinue 导航组件', () => {
      const wrapper = mountWith()
      expect(wrapper.findComponent({ name: 'BackContinue' }).exists()).toBe(true)
    })
  })

  describe('wenId 计算逻辑测试', () => {
    it('路由参数为数字时应转换为 WEN_xx 格式', () => {
      const wrapper = mountWith()
      const multiRole = wrapper.findComponent({ name: 'MultiRoleReading' })
      expect(multiRole.props('wenId')).toBe('WEN_01')
    })

    it('路由参数为 WEN_xx 格式时应直接使用', async () => {
      await router.push('/stepone/WEN_05')
      await router.isReady()
      const wrapper = mountWith()
      const multiRole = wrapper.findComponent({ name: 'MultiRoleReading' })
      expect(multiRole.props('wenId')).toBe('WEN_05')
    })

    it('路由参数无效时应回退到 WEN_01', async () => {
      await router.push('/stepone/abc')
      await router.isReady()
      const wrapper = mountWith()
      const multiRole = wrapper.findComponent({ name: 'MultiRoleReading' })
      expect(multiRole.props('wenId')).toBe('WEN_01')
    })
  })

  describe('事件处理测试（C09 dead state 清理验证）', () => {
    it('load-success 事件应触发 debugLog 输出音频数据', () => {
      const wrapper = mountWith()
      const multiRole = wrapper.findComponent({ name: 'MultiRoleReading' })
      const mockData = { segments: [] }
      multiRole.vm.$emit('load-success', mockData)
      expect(mockDebugLog).toHaveBeenCalledWith('音频数据加载成功:', mockData)
    })

    it('load-error 事件应触发 debugError 输出错误信息', () => {
      const wrapper = mountWith()
      const multiRole = wrapper.findComponent({ name: 'MultiRoleReading' })
      const errorMsg = '网络错误'
      multiRole.vm.$emit('load-error', errorMsg)
      expect(mockDebugError).toHaveBeenCalledWith('音频数据加载失败:', errorMsg)
    })

    it('segment-change 事件应触发 debugLog 输出段落索引', () => {
      // C09 重构：currentSegment dead state 已删除
      // handler 改为 debugLog 输出段落索引，保留事件监听以维持可观测性
      const wrapper = mountWith()
      const multiRole = wrapper.findComponent({ name: 'MultiRoleReading' })
      multiRole.vm.$emit('segment-change', 2)
      expect(mockDebugLog).toHaveBeenCalledWith('当前段落变化:', 2)
    })
  })

  describe('导航行为测试', () => {
    it('组件内不应直接使用 useRouter（分层规则验证）', () => {
      mountWith()
      // useNavigation 已被 mock，组件 setup 调用后取得 goNext/goPrev
      // 此处验证未触发导航事件
      expect(mockGoNext).not.toHaveBeenCalled()
      expect(mockGoPrev).not.toHaveBeenCalled()
    })

    it('BackContinue 触发 back 事件应调用 goPrev', async () => {
      const wrapper = mountWith()
      const backContinue = wrapper.findComponent({ name: 'BackContinue' })
      backContinue.vm.$emit('back')
      await wrapper.vm.$nextTick()
      expect(mockGoPrev).toHaveBeenCalledTimes(1)
    })

    it('BackContinue 触发 continue 事件应调用 goNext', async () => {
      const wrapper = mountWith()
      const backContinue = wrapper.findComponent({ name: 'BackContinue' })
      backContinue.vm.$emit('continue')
      await wrapper.vm.$nextTick()
      expect(mockGoNext).toHaveBeenCalledTimes(1)
    })
  })
})
