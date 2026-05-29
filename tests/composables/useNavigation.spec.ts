import { describe, it, expect, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useNavigation } from '@/composables/useNavigation'

// Mock router
const mockRouter = {
  push: vi.fn(),
  back: vi.fn(),
}

vi.mock('vue-router', () => ({
  useRouter: () => mockRouter,
}))

describe('useNavigation', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
  })

  describe('composable 初始化', () => {
    it('应该正确初始化 composable', () => {
      const navigation = useNavigation('rules', '1')
      expect(navigation).toBeDefined()
    })

    it('应该返回所有必要的属性和方法', () => {
      const navigation = useNavigation('rules', '1')
      expect(navigation).toHaveProperty('goNext')
      expect(navigation).toHaveProperty('goPrev')
      expect(navigation).toHaveProperty('goTo')
      expect(navigation).toHaveProperty('currentIndex')
      expect(navigation).toHaveProperty('hasNext')
      expect(navigation).toHaveProperty('hasPrev')
    })
  })

  describe('导航方法测试', () => {
    it('goNext 应该是一个函数', () => {
      const navigation = useNavigation('rules', '1')
      expect(typeof navigation.goNext).toBe('function')
    })

    it('goPrev 应该是一个函数', () => {
      const navigation = useNavigation('rules', '1')
      expect(typeof navigation.goPrev).toBe('function')
    })

    it('goTo 应该是一个函数', () => {
      const navigation = useNavigation('rules', '1')
      expect(typeof navigation.goTo).toBe('function')
    })
  })

  describe('计算属性测试', () => {
    it('currentIndex 应该是一个计算属性', () => {
      const navigation = useNavigation('rules', '1')
      expect(typeof navigation.currentIndex).toBe('object')
    })

    it('hasNext 应该是一个计算属性', () => {
      const navigation = useNavigation('rules', '1')
      expect(typeof navigation.hasNext).toBe('object')
    })

    it('hasPrev 应该是一个计算属性', () => {
      const navigation = useNavigation('rules', '1')
      expect(typeof navigation.hasPrev).toBe('object')
    })
  })

  describe('多次调用测试', () => {
    it('可以多次调用 useNavigation 而不会出错', () => {
      const nav1 = useNavigation('rules', '1')
      const nav2 = useNavigation('rules', '1')
      expect(nav1).toBeDefined()
      expect(nav2).toBeDefined()
    })
  })
})
