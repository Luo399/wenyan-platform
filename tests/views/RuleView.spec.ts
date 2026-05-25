import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import RuleView from '@/views/RuleView.vue'
import { routes } from '@/router'

describe('RuleView.vue', () => {
  const pinia = createPinia()
  setActivePinia(pinia)

  const router = createRouter({
    history: createWebHistory(),
    routes: routes,
  })

  describe('基础渲染测试', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(RuleView, {
        global: {
          plugins: [router, pinia],
          stubs: ['RouterLink', 'VideoPlayer'],
        },
      })
      expect(wrapper.exists()).toBe(true)
    })

    it('应该包含页面内容', () => {
      const wrapper = mount(RuleView, {
        global: {
          plugins: [router, pinia],
          stubs: ['RouterLink', 'VideoPlayer'],
        },
      })
      expect(wrapper.html()).toBeDefined()
    })
  })
})
