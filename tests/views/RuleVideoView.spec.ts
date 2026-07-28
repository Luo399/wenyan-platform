import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import RuleVideoView from '@/views/RuleVideoView.vue'
import { routes } from '@/router'

/**
 * RuleVideoView 测试套件
 *
 * 验证合并后的统一组件在 4 种 props 配置下均能正确渲染：
 * - videoKey: 'bg' | '1' | '2' | '3'
 * - navKey: 'rules' | 'rule1' | 'rule2' | 'rule3'
 * - titlePrefix: 对应标题前缀
 */
describe('RuleVideoView.vue', () => {
  let pinia: ReturnType<typeof createPinia>
  let router: ReturnType<typeof createRouter>

  beforeEach(async () => {
    pinia = createPinia()
    setActivePinia(pinia)

    router = createRouter({
      history: createWebHistory(),
      routes: routes,
    })

    // 推入带 id 参数的路由，使 useRoute().params.id 生效
    await router.push('/rules/1')
    await router.isReady()
  })

  /**
   * 通用挂载函数，避免重复样板代码
   */
  function mountComponent(props: Record<string, string>) {
    return mount(RuleVideoView, {
      props,
      global: {
        plugins: [router, pinia],
        stubs: ['RouterLink', 'VideoPlayer', 'BackContinue'],
      },
    })
  }

  describe('基础渲染', () => {
    it('应该在 rules 配置下正确渲染', () => {
      const wrapper = mountComponent({
        videoKey: 'bg',
        navKey: 'rules',
        titlePrefix: '规则介绍',
      })
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.html()).toBeDefined()
    })

    it('应该在 rule1 配置下正确渲染', () => {
      const wrapper = mountComponent({
        videoKey: '1',
        navKey: 'rule1',
        titlePrefix: '规则介绍（一）',
      })
      expect(wrapper.exists()).toBe(true)
    })

    it('应该在 rule2 配置下正确渲染', () => {
      const wrapper = mountComponent({
        videoKey: '2',
        navKey: 'rule2',
        titlePrefix: '规则介绍（二）',
      })
      expect(wrapper.exists()).toBe(true)
    })

    it('应该在 rule3 配置下正确渲染', () => {
      const wrapper = mountComponent({
        videoKey: '3',
        navKey: 'rule3',
        titlePrefix: '规则介绍（三）',
      })
      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('Props 参数化', () => {
    it('应该显示 titlePrefix 前缀的标题', () => {
      const wrapper = mountComponent({
        videoKey: '1',
        navKey: 'rule1',
        titlePrefix: '规则介绍（一）',
      })
      // 标题格式："{titlePrefix} - {篇目标题}"
      expect(wrapper.text()).toContain('规则介绍（一）')
    })

    it('应该使用默认 props 正确渲染', () => {
      // 不传 props，使用 withDefaults 默认值
      const wrapper = mount(RuleVideoView, {
        global: {
          plugins: [router, pinia],
          stubs: ['RouterLink', 'VideoPlayer', 'BackContinue'],
        },
      })
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.text()).toContain('规则介绍')
    })
  })

  describe('组件结构', () => {
    it('应该包含 page-title 标题元素', () => {
      const wrapper = mountComponent({
        videoKey: 'bg',
        navKey: 'rules',
        titlePrefix: '规则介绍',
      })
      expect(wrapper.find('.page-title').exists()).toBe(true)
    })

    it('应该包含 video-section 容器', () => {
      const wrapper = mountComponent({
        videoKey: 'bg',
        navKey: 'rules',
        titlePrefix: '规则介绍',
      })
      expect(wrapper.find('.video-section').exists()).toBe(true)
    })

    it('应该渲染 VideoPlayer 子组件', () => {
      const wrapper = mountComponent({
        videoKey: 'bg',
        navKey: 'rules',
        titlePrefix: '规则介绍',
      })
      // VideoPlayer 被 stub，渲染为 stub-component
      expect(wrapper.findComponent({ name: 'VideoPlayer' }).exists()).toBe(true)
    })

    it('应该渲染 BackContinue 子组件', () => {
      const wrapper = mountComponent({
        videoKey: 'bg',
        navKey: 'rules',
        titlePrefix: '规则介绍',
      })
      expect(wrapper.findComponent({ name: 'BackContinue' }).exists()).toBe(true)
    })
  })
})
