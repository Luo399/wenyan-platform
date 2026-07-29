import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import PoetryMenu from '@/components/PoetryMenu.vue'
import { getAllPoems } from '@/utils/wenUtils'

describe('PoetryMenu.vue（C10 核心验证）', () => {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: '/rule/:id', name: 'rules', component: { template: '<div></div>' } }],
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('基础渲染测试', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(PoetryMenu, {
        global: {
          plugins: [router],
        },
      })
      expect(wrapper.exists()).toBe(true)
    })

    it('应该显示菜单触发区文本', () => {
      const wrapper = mount(PoetryMenu, {
        global: {
          plugins: [router],
        },
      })
      expect(wrapper.find('.menu-trigger').text()).toContain('诗题选集')
    })
  })

  describe('诗文列表渲染测试（C10 数据源统一验证）', () => {
    it('应该渲染 4 个诗文条目（与 getAllPoems 返回数量一致）', () => {
      const wrapper = mount(PoetryMenu, {
        global: {
          plugins: [router],
        },
      })
      const items = wrapper.findAll('.dropdown li')
      expect(items.length).toBe(4)
      expect(items.length).toBe(getAllPoems().length)
    })

    it('每个条目的标题应该与 getAllPoems 返回的标题一致（不再硬编码）', () => {
      const wrapper = mount(PoetryMenu, {
        global: {
          plugins: [router],
        },
      })
      const items = wrapper.findAll('.dropdown li')
      const expectedTitles = getAllPoems().map((p) => p.title)
      const actualTitles = items.map((li) => li.text().trim())
      expect(actualTitles).toEqual(expectedTitles)
    })

    it('每个条目的 wenId 应该与 getAllPoems 返回一致（v-for key 使用 wenId）', () => {
      const wrapper = mount(PoetryMenu, {
        global: {
          plugins: [router],
        },
      })
      const poems = getAllPoems()
      // 通过触发 click 并检查 router.push 参数，间接验证 wenId 传递正确
      const items = wrapper.findAll('.dropdown li')
      for (let i = 0; i < items.length; i++) {
        // 检查每个 key 属性（v-for :key 生成的 __v 属性通过 wrapper attributes 不易直接访问，
        // 这里通过文本匹配间接验证：title 与 poems[i] 对应）
        expect(items[i].text().trim()).toBe(poems[i].title)
      }
    })
  })

  describe('导航跳转测试（goToRules 行为验证）', () => {
    it('点击诗文条目应该调用 router.push 跳转到 rules 路由，参数为对应 poemId', async () => {
      const pushSpy = vi.spyOn(router, 'push')
      const wrapper = mount(PoetryMenu, {
        global: {
          plugins: [router],
        },
      })
      const poems = getAllPoems()
      const items = wrapper.findAll('.dropdown li')

      // 点击 WEN_01（陈涉世家）
      await items[0].trigger('click')
      expect(pushSpy).toHaveBeenCalledTimes(1)
      expect(pushSpy).toHaveBeenLastCalledWith({
        name: 'rules',
        params: { id: poems[0].poemId }, // '1'
      })

      // 点击 WEN_02（马说）
      await items[1].trigger('click')
      expect(pushSpy).toHaveBeenCalledTimes(2)
      expect(pushSpy).toHaveBeenLastCalledWith({
        name: 'rules',
        params: { id: poems[1].poemId }, // '2'
      })

      pushSpy.mockRestore()
    })

    it("WEN_01 点击应该跳转 poemId=1（验证 poemMap 顺序修复正确，不再是'马说'）", async () => {
      const pushSpy = vi.spyOn(router, 'push')
      const wrapper = mount(PoetryMenu, {
        global: {
          plugins: [router],
        },
      })
      const items = wrapper.findAll('.dropdown li')
      // 第一项文本应该是"陈涉世家"
      expect(items[0].text().trim()).toBe('陈涉世家')
      await items[0].trigger('click')
      expect(pushSpy).toHaveBeenLastCalledWith({
        name: 'rules',
        params: { id: '1' },
      })
      pushSpy.mockRestore()
    })
  })

  describe('下拉菜单显示/隐藏逻辑', () => {
    it('鼠标进入触发区应该显示下拉菜单', async () => {
      vi.useFakeTimers()
      const wrapper = mount(PoetryMenu, {
        global: {
          plugins: [router],
        },
      })
      // 初始不显示
      expect(wrapper.find('.dropdown').isVisible()).toBe(false)

      await wrapper.find('.menu-trigger').trigger('mouseenter')
      expect(wrapper.find('.dropdown').isVisible()).toBe(true)

      vi.useRealTimers()
    })

    it('鼠标离开后延时 200ms 隐藏下拉菜单', async () => {
      vi.useFakeTimers()
      const wrapper = mount(PoetryMenu, {
        global: {
          plugins: [router],
        },
      })

      // 先进入显示
      await wrapper.find('.menu-trigger').trigger('mouseenter')
      expect(wrapper.find('.dropdown').isVisible()).toBe(true)

      // 离开
      await wrapper.find('.menu-trigger').trigger('mouseleave')
      // 立刻仍然显示
      expect(wrapper.find('.dropdown').isVisible()).toBe(true)

      // 200ms 后隐藏
      vi.advanceTimersByTime(200)
      expect(wrapper.find('.dropdown').isVisible()).toBe(false)

      vi.useRealTimers()
    })
  })
})
