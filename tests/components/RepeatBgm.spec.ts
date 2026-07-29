import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import RepeatBgm from '@/components/common/RepeatBgm.vue'
import { useBgmStore } from '@/stores/bgm'

// 构造响应式 route mock，便于测试中修改 params.id 触发 watch
const mockRoute = reactive({ params: { id: 'WEN_01' } })

vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
}))

// mock getWenId：直接回显入参，便于断言
vi.mock('@/utils/wenUtils', () => ({
  getWenId: (id: string) => `WEN_${id.slice(-2)}`,
}))

// mock getAssetUrl：返回固定 URL，避免 import.meta.env 差异
vi.mock('@/utils/asset', () => ({
  getAssetUrl: (_type: string, fileName: string) => `https://mock-oss/audio/${fileName}`,
}))

// mock debug 工具，隔离日志噪音
vi.mock('@/utils/debug', () => ({
  debugLog: vi.fn(),
  debugError: vi.fn(),
  debugWarn: vi.fn(),
}))

// mock HTMLMediaElement 的 play/pause/load，jsdom 未实现
const mockPlay = vi.fn().mockResolvedValue(undefined)
const mockPause = vi.fn()
const mockLoad = vi.fn()

describe('RepeatBgm.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // 重置 route 到初始值
    mockRoute.params.id = 'WEN_01'
    // 在 HTMLMediaElement 原型上 mock play/pause/load
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(mockPlay)
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(mockPause)
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(mockLoad)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('基础渲染测试', () => {
    it('正常状态下应渲染 audio 元素、播放按钮与音量控制', async () => {
      const store = useBgmStore()
      // 设置有效的 wenId，使 currentBgmFile 有值
      store.setActiveWenId('WEN_01')
      const wrapper = mount(RepeatBgm)
      await flushPromises()

      expect(wrapper.find('audio').exists()).toBe(true)
      expect(wrapper.find('.bgm-btn').exists()).toBe(true)
      expect(wrapper.find('.volume-control').exists()).toBe(true)
      // 默认未播放，按钮显示"播放背景音乐"
      expect(wrapper.find('.bgm-btn').text()).toContain('播放背景音乐')
    })

    it('未播放时应显示播放图标与"播放"文字', async () => {
      const store = useBgmStore()
      store.setActiveWenId('WEN_01')
      store.pause()
      const wrapper = mount(RepeatBgm)
      await flushPromises()

      expect(wrapper.find('.fa-play').exists()).toBe(true)
      expect(wrapper.find('.bgm-btn').text()).toContain('播放')
    })

    it('播放中应显示暂停图标与"暂停"文字', async () => {
      const store = useBgmStore()
      store.setActiveWenId('WEN_01')
      store.play()
      const wrapper = mount(RepeatBgm)
      await flushPromises()

      expect(wrapper.find('.fa-pause').exists()).toBe(true)
      expect(wrapper.find('.bgm-btn').text()).toContain('暂停')
    })

    it('无 currentBgmFile 时不应渲染控制区', () => {
      const store = useBgmStore()
      // 不设置 wenId，currentBgmFile 为空
      store.setActiveWenId('')
      const wrapper = mount(RepeatBgm)

      expect(wrapper.find('.bgm-controls').exists()).toBe(false)
    })

    it('audio src 应由 getAssetUrl 拼接产生', async () => {
      const store = useBgmStore()
      store.setActiveWenId('WEN_01')
      const wrapper = mount(RepeatBgm)
      await flushPromises()

      // bgmMapping 中 WEN_01 -> WEN_01_bgm_guzheng.mp3
      const audio = wrapper.find('audio')
      expect(audio.attributes('src')).toBe('https://mock-oss/audio/WEN_01_bgm_guzheng.mp3')
    })
  })

  describe('交互测试', () => {
    it('点击播放按钮应触发 bgmStore.togglePlay', async () => {
      const store = useBgmStore()
      store.setActiveWenId('WEN_01')
      const spy = vi.spyOn(store, 'togglePlay')
      const wrapper = mount(RepeatBgm)
      await flushPromises()

      await wrapper.find('.bgm-btn').trigger('click')
      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('点击静音按钮应触发 bgmStore.toggleMute', async () => {
      const store = useBgmStore()
      store.setActiveWenId('WEN_01')
      const spy = vi.spyOn(store, 'toggleMute')
      const wrapper = mount(RepeatBgm)
      await flushPromises()

      await wrapper.find('.volume-btn').trigger('click')
      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('音量滑块 input 应触发 bgmStore.setVolume', async () => {
      const store = useBgmStore()
      store.setActiveWenId('WEN_01')
      const spy = vi.spyOn(store, 'setVolume')
      const wrapper = mount(RepeatBgm)
      await flushPromises()

      const slider = wrapper.find('.volume-slider')
      // 模拟用户拖动滑块到 60
      await slider.setValue(60)
      await slider.trigger('input')
      expect(spy).toHaveBeenCalledWith(60)
    })
  })

  describe('store 状态联动', () => {
    it('store isPlaying 变为 true 时应调用 audio.play', async () => {
      const store = useBgmStore()
      store.setActiveWenId('WEN_01')
      store.pause()
      mount(RepeatBgm)
      await flushPromises()

      store.play()
      await nextTick()
      await flushPromises()

      expect(mockPlay).toHaveBeenCalled()
    })

    it('store isPlaying 变为 false 时应调用 audio.pause', async () => {
      const store = useBgmStore()
      store.setActiveWenId('WEN_01')
      store.play()
      mount(RepeatBgm)
      await flushPromises()

      mockPause.mockClear()
      store.pause()
      await nextTick()

      expect(mockPause).toHaveBeenCalled()
    })

    it('store volume 变化应同步到 audio.volume', async () => {
      const store = useBgmStore()
      store.setActiveWenId('WEN_01')
      const wrapper = mount(RepeatBgm)
      await flushPromises()

      const audio = wrapper.find('audio').element as HTMLAudioElement
      // handleLoadedMetadata 会设置初始 volume，先记录
      audio.volume = 0.2

      store.setVolume(80)
      await nextTick()

      // 80 / 100 = 0.8
      expect(audio.volume).toBe(0.8)
    })

    it('store isMuted 变化应同步到 audio.muted', async () => {
      const store = useBgmStore()
      store.setActiveWenId('WEN_01')
      const wrapper = mount(RepeatBgm)
      await flushPromises()

      const audio = wrapper.find('audio').element as HTMLAudioElement
      audio.muted = false

      store.toggleMute()
      await nextTick()

      expect(audio.muted).toBe(true)
    })
  })

  describe('路由联动', () => {
    it('route.params.id 变化应触发 bgmStore.setActiveWenId', async () => {
      const store = useBgmStore()
      const spy = vi.spyOn(store, 'setActiveWenId')
      mount(RepeatBgm)
      await flushPromises()

      // 初始挂载时会立即触发一次（immediate: true）
      spy.mockClear()

      // 修改 route.params.id
      mockRoute.params.id = 'WEN_02'
      await nextTick()

      // getWenId mock: 'WEN_02' slice(-2) = '02' -> 'WEN_02'
      expect(spy).toHaveBeenCalledWith('WEN_02')
    })
  })

  describe('卸载清理', () => {
    it('组件卸载时应 pause audio 并清空 src', async () => {
      const store = useBgmStore()
      store.setActiveWenId('WEN_01')
      const wrapper = mount(RepeatBgm)
      await flushPromises()

      const audio = wrapper.find('audio').element as HTMLAudioElement
      mockPause.mockClear()

      wrapper.unmount()
      await nextTick()

      expect(mockPause).toHaveBeenCalled()
      expect(audio.src).toBe('')
    })
  })
})
