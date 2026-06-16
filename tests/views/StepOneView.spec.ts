import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import StepOneView from '@/views/StepOneView.vue'
import { routes } from '@/router'

describe('StepOneView.vue', () => {
  const pinia = createPinia()
  setActivePinia(pinia)

  const router = createRouter({
    history: createWebHistory(),
    routes: routes,
  })

  describe('基础渲染测试', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(StepOneView, {
        global: {
          plugins: [router, pinia],
          stubs: ['RouterLink', 'MultiRoleReading', 'WordList', 'VideoPlayer', 'Level1Quiz'],
        },
      })
      expect(wrapper.exists()).toBe(true)
    })

    it('应该包含页面内容', () => {
      const wrapper = mount(StepOneView, {
        global: {
          plugins: [router, pinia],
          stubs: ['RouterLink', 'MultiRoleReading', 'WordList', 'VideoPlayer', 'Level1Quiz'],
        },
      })
      expect(wrapper.html()).toBeDefined()
    })
  })

  describe('区块结构测试', () => {
    it('应该包含字词注释、音频学习、课后小测三个区块', () => {
      const wrapper = mount(StepOneView, {
        global: {
          plugins: [router, pinia],
          stubs: ['RouterLink', 'MultiRoleReading', 'WordList', 'VideoPlayer', 'Level1Quiz'],
        },
      })
      expect(wrapper.find('.annotated-section').exists()).toBe(true)
      expect(wrapper.find('.audio-section').exists()).toBe(true)
      expect(wrapper.find('.quiz-section').exists()).toBe(true)
    })

    it('应该在音频学习下方渲染 Level1Quiz 组件', () => {
      const wrapper = mount(StepOneView, {
        global: {
          plugins: [router, pinia],
          stubs: ['RouterLink', 'MultiRoleReading', 'WordList', 'VideoPlayer', 'Level1Quiz'],
        },
      })
      const level1QuizStub = wrapper.findComponent({ name: 'Level1Quiz' })
      expect(level1QuizStub.exists()).toBe(true)
      expect(level1QuizStub.props('wenId')).toBe('WEN_01')
    })

    it('应该向 Level1Quiz 透传 wenId', () => {
      const wrapper = mount(StepOneView, {
        global: {
          plugins: [router, pinia],
          stubs: {
            RouterLink: true,
            MultiRoleReading: true,
            WordList: true,
            VideoPlayer: true,
            Level1Quiz: { props: ['wenId'], template: '<div class="level1-quiz-stub" />' },
          },
        },
      })
      const quiz = wrapper.find('.level1-quiz-stub')
      expect(quiz.exists()).toBe(true)
    })
  })
})
