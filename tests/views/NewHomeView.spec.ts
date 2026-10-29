import { describe, it, expect, vi } from 'vitest'
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

    it('应该渲染课文选集入口（诗题 chip）', () => {
      // 旧版首页的单个 .enter-btn 已被 NewMenu 的诗题卡片列表取代
      const wrapper = mount(NewHomeView, {
        global: {
          plugins: [router, pinia],
        },
      })
      expect(wrapper.find('.new-menu').exists()).toBe(true)
      const chips = wrapper.findAll('.poem-chip')
      expect(chips.length).toBeGreaterThan(0)
      expect(chips[0].attributes('type')).toBe('button')
    })

    it('未登录时点击可进入的诗题应带 redirect 跳登录页', async () => {
      const wrapper = mount(NewHomeView, {
        global: {
          plugins: [router, pinia],
        },
      })
      const pushSpy = vi.spyOn(router, 'push').mockResolvedValue(undefined as never)

      const readyChip = wrapper
        .findAll('.poem-chip')
        .find((chip) => !chip.attributes('disabled'))
      expect(readyChip).toBeDefined()

      await readyChip!.trigger('click')

      expect(pushSpy).toHaveBeenCalledTimes(1)
      const target = pushSpy.mock.calls[0][0] as string
      expect(target).toMatch(/^\/student-login\?redirect=\/rules\/\d+$/)
      pushSpy.mockRestore()
    })
  })
})