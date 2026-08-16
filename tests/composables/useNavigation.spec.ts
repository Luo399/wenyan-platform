import { describe, it, expect, vi, beforeEach } from 'vitest'
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

// Mock debug 模块，便于断言 warn/error
const mockDebugWarn = vi.fn()
const mockDebugError = vi.fn()
vi.mock('@/utils/debug', () => ({
  debugWarn: (...args: unknown[]) => mockDebugWarn(...args),
  debugError: (...args: unknown[]) => mockDebugError(...args),
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
      expect(navigation).toHaveProperty('goHome')
      expect(navigation).toHaveProperty('currentIndex')
      expect(navigation).toHaveProperty('hasNext')
      expect(navigation).toHaveProperty('hasPrev')
    })

    it('不传 currentRouteName 时也应正确初始化（非顺序页面）', () => {
      const navigation = useNavigation()
      expect(navigation).toBeDefined()
      expect(typeof navigation.goHome).toBe('function')
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

    it('goHome 应该是一个函数', () => {
      const navigation = useNavigation('rules', '1')
      expect(typeof navigation.goHome).toBe('function')
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

  describe('goHome 行为测试', () => {
    it('goHome 应调用 router.push 且参数为首页路径 "/"', () => {
      const navigation = useNavigation('rules', '1')
      navigation.goHome()
      expect(mockRouter.push).toHaveBeenCalledTimes(1)
      expect(mockRouter.push).toHaveBeenCalledWith('/')
    })

    it('goHome 不依赖 currentRouteName（非顺序页面也可用）', () => {
      const navigation = useNavigation()
      navigation.goHome()
      expect(mockRouter.push).toHaveBeenCalledTimes(1)
      expect(mockRouter.push).toHaveBeenCalledWith('/')
    })

    it('goHome 多次调用应多次触发跳转', () => {
      const navigation = useNavigation()
      navigation.goHome()
      navigation.goHome()
      expect(mockRouter.push).toHaveBeenCalledTimes(2)
    })
  })

  describe('goPrev 在第一页时调用 goHome', () => {
    it('已是第一页时 goPrev 应跳转到首页（替代原 router.push("/") 硬编码）', () => {
      // home 是 pageSequence 的第一项，无上一页
      const navigation = useNavigation('home')
      navigation.goPrev()
      expect(mockRouter.push).toHaveBeenCalledTimes(1)
      expect(mockRouter.push).toHaveBeenCalledWith('/')
    })
  })

  describe('非顺序页面（未传 currentRouteName）行为测试', () => {
    it('goNext 未传 currentRouteName 时仅 warn 不跳转', () => {
      const navigation = useNavigation()
      navigation.goNext()
      expect(mockRouter.push).not.toHaveBeenCalled()
      expect(mockDebugWarn).toHaveBeenCalled()
    })

    it('goPrev 未传 currentRouteName 时仅 warn 不跳转', () => {
      const navigation = useNavigation()
      navigation.goPrev()
      expect(mockRouter.push).not.toHaveBeenCalled()
      expect(mockDebugWarn).toHaveBeenCalled()
    })

    it('currentIndex 在未传 currentRouteName 时返回 -1', () => {
      const navigation = useNavigation()
      expect(navigation.currentIndex.value).toBe(-1)
    })

    it('hasNext 在未传 currentRouteName 时返回 false', () => {
      const navigation = useNavigation()
      expect(navigation.hasNext.value).toBe(false)
    })

    it('hasPrev 在未传 currentRouteName 时返回 false', () => {
      const navigation = useNavigation()
      expect(navigation.hasPrev.value).toBe(false)
    })

    it('goTo 仍可正常工作（非顺序页面也可主动跳转）', () => {
      const navigation = useNavigation()
      navigation.goTo('rules', '2')
      expect(mockRouter.push).toHaveBeenCalledTimes(1)
      expect(mockRouter.push).toHaveBeenCalledWith('/rules/2')
    })
  })

  describe('顺序页面行为兼容性测试', () => {
    it('顺序页面 goNext 正常跳转到下一页', () => {
      // rules 是第二项，下一页应为 stepone（新顺序：rules -> stepone -> rule1 -> ...）
      const navigation = useNavigation('rules', '1')
      navigation.goNext()
      expect(mockRouter.push).toHaveBeenCalledTimes(1)
      expect(mockRouter.push).toHaveBeenCalledWith('/stepone/1')
    })

    it('顺序页面 stepone 的 goNext 应跳转到 rule1', () => {
      // 新顺序：rules -> stepone -> rule1 -> rule2 -> rule3 -> steptwo -> stepthree -> detail
      const navigation = useNavigation('stepone', '1')
      navigation.goNext()
      expect(mockRouter.push).toHaveBeenCalledTimes(1)
      expect(mockRouter.push).toHaveBeenCalledWith('/rule1/1')
    })

    it('顺序页面 goPrev 正常跳转到上一页', () => {
      // stepone 是第三项，上一页应为 rules
      const navigation = useNavigation('stepone', '1')
      navigation.goPrev()
      expect(mockRouter.push).toHaveBeenCalledTimes(1)
      expect(mockRouter.push).toHaveBeenCalledWith('/rules/1')
    })

    it('顺序页面 currentIndex 返回正确索引', () => {
      const navigation = useNavigation('rules', '1')
      // pageSequence: home(0) rules(1) stepone(2) rule1(3) rule2(4) rule3(5) steptwo(6) stepthree(7) detail(8)
      expect(navigation.currentIndex.value).toBe(1)
    })

    it('顺序页面 hasNext/hasPrev 正确判断', () => {
      const navRules = useNavigation('rules', '1')
      expect(navRules.hasNext.value).toBe(true)
      expect(navRules.hasPrev.value).toBe(true)

      const navHome = useNavigation('home')
      expect(navHome.hasNext.value).toBe(true)
      expect(navHome.hasPrev.value).toBe(false)

      // 最后一页 detail 应 hasNext=false
      const navDetail = useNavigation('detail', '1')
      expect(navDetail.hasNext.value).toBe(false)
      expect(navDetail.hasPrev.value).toBe(true)
    })
  })
})
