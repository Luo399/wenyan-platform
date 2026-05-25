import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import RuleView1 from '@/views/RuleView1.vue'
import RuleView2 from '@/views/RuleView2.vue'
import RuleView3 from '@/views/RuleView3.vue'
import { routes } from '@/router'

describe('RuleViews - 测试套件', () => {
  const pinia = createPinia()
  setActivePinia(pinia)

  const router = createRouter({
    history: createWebHistory(),
    routes: routes,
  })

  describe('RuleView1.vue', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(RuleView1, {
        global: {
          plugins: [router, pinia],
          stubs: ['RouterLink', 'VideoPlayer'],
        },
      })
      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('RuleView2.vue', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(RuleView2, {
        global: {
          plugins: [router, pinia],
          stubs: ['RouterLink', 'VideoPlayer'],
        },
      })
      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('RuleView3.vue', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(RuleView3, {
        global: {
          plugins: [router, pinia],
          stubs: ['RouterLink', 'VideoPlayer'],
        },
      })
      expect(wrapper.exists()).toBe(true)
    })
  })
})
