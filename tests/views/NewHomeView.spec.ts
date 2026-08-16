import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import NewHomeView from '@/views/NewHomeView.vue'
import { routes } from '@/router'

describe('NewHomeView.vue', () => {
  const pinia = createPinia()
  setActivePinia(pinia)

  const router = createRouter({
    history: createWebHistory(),
    routes: routes,
  })

  describe('基础渲染测试', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(NewHomeView, {
        global: {
          plugins: [router, pinia],
        },
      })
      expect(wrapper.exists()).toBe(true)
    })

    it('应该包含页面内容', () => {
      const wrapper = mount(NewHomeView, {
        global: {
          plugins: [router, pinia],
        },
      })
      expect(wrapper.html()).toBeDefined()
    })

    it('应该包含进入学习按钮', () => {
      const wrapper = mount(NewHomeView, {
        global: {
          plugins: [router, pinia],
        },
      })
      expect(wrapper.find('.enter-btn').exists()).toBe(true)
    })
  })
})