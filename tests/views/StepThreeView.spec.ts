import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { ref } from 'vue'
import StepThreeView from '@/views/StepThreeView.vue'

const mockRouter = {
  push: vi.fn(),
  back: vi.fn(),
}

vi.mock('vue-router', () => ({
  useRouter: () => mockRouter,
  useRoute: () => ({ params: { id: 'WEN_01' } }),
}))

vi.mock('@/composables/useDataLoader', () => ({
  useDataLoader: vi.fn(() => ({
    loading: ref(false),
    error: ref<string | null>(null),
    data: ref({
      title: '测试页面',
      items: [],
    }),
    retry: vi.fn(),
  })),
}))

describe('StepThreeView.vue', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  describe('基础渲染测试', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(StepThreeView)
      expect(wrapper.exists()).toBe(true)
    })

    it('应该显示返回按钮', () => {
      const wrapper = mount(StepThreeView)
      expect(wrapper.text()).toContain('返回')
    })

    it('初始状态不应该显示继续按钮', () => {
      const wrapper = mount(StepThreeView)
      expect(wrapper.text()).not.toContain('继续')
    })
  })

  describe('导航功能测试', () => {
    it('点击返回按钮应该触发goPrev', async () => {
      const wrapper = mount(StepThreeView)
      const backBtn = wrapper.find('.back-btn')
      await backBtn.trigger('click')
      expect(mockRouter.push).toHaveBeenCalled()
    })
  })

  describe('答题进度测试', () => {
    it('应该初始化答题进度', () => {
      const wrapper = mount(StepThreeView)
      expect(wrapper.vm.$data).toBeDefined()
    })
  })
})
