import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import MultiRoleReading from '@/components/MultiRoleReading.vue'
import { useDataLoader } from '@/composables/useDataLoader'
import {
  adaptMultiRoleReading,
  parseTimeRange,
  timeToSeconds,
  formatTime,
  getCurrentSegmentIndex,
  type RawMultiRoleData,
  type ProcessedMultiRoleSegment,
} from '@/adapters/multiPoleAdapter'

// Mock useDataLoader（jsdom 环境下无法实例化 Worker，统一 mock 整个组合式函数）
vi.mock('@/composables/useDataLoader')

// 测试数据
const mockMultiRoleData = {
  text_id: 'WEN_01',
  audio_file: 'test_audio.mp3',
  segments: [
    {
      sentence_index: 1,
      time_range: '00:00-00:10',
      role_name: '旁白📖',
      dialogue: '这是第一段',
    },
    {
      sentence_index: 2,
      time_range: '00:10-00:25',
      role_name: '角色A🎭',
      dialogue: '这是第二段',
    },
  ],
}

// 捕获传给 useDataLoader 的 options（用于后续触发 onLoadSuccess / onLoadError 回调）
let capturedOptions: {
  autoLoad?: boolean
  timeout?: number
  retryCount?: number
  cacheEnabled?: boolean
  cacheTTL?: number
  transform?: (raw: unknown) => unknown
  onLoadSuccess?: (data: unknown) => void
  onLoadError?: (err: string) => void
} = {}

// 默认 mock：返回"加载完成 + 有数据"状态
function mockUseDataLoaderLoaded(overrides: Record<string, unknown> = {}) {
  vi.mocked(useDataLoader).mockImplementation((_urlGetter, options) => {
    capturedOptions = options || {}
    return {
      loading: ref(false),
      error: ref<string | null>(null),
      isTimeout: ref(false),
      data: ref(mockMultiRoleData),
      retry: vi.fn(),
      load: vi.fn(),
      ...overrides,
    } as any
  })
}

afterEach(() => {
  vi.clearAllMocks()
  capturedOptions = {}
})

describe('readingAdapter', () => {
  describe('timeToSeconds', () => {
    it('应该正确转换时间字符串为秒数', () => {
      expect(timeToSeconds('01:30')).toBe(90)
      expect(timeToSeconds('00:00')).toBe(0)
      expect(timeToSeconds('1:05')).toBe(65)
      expect(timeToSeconds('120')).toBe(120)
      expect(timeToSeconds('invalid')).toBe(0)
    })
  })

  describe('formatTime', () => {
    it('应该正确格式化秒数为时间字符串', () => {
      expect(formatTime(90)).toBe('01:30')
      expect(formatTime(0)).toBe('00:00')
      expect(formatTime(65)).toBe('01:05')
      expect(formatTime(3661)).toBe('61:01')
    })
  })

  describe('parseTimeRange', () => {
    it('应该正确解析时间范围字符串', () => {
      expect(parseTimeRange('00:00-00:10')).toEqual([0, 10])
      expect(parseTimeRange('01:30-02:15')).toEqual([90, 135])
      expect(parseTimeRange('invalid')).toEqual([0, 0])
    })
  })

  describe('adaptMultiRoleReading', () => {
    it('应该正确转换原始数据为处理后的数据', () => {
      const rawData: RawMultiRoleData = {
        text_id: 'WEN_01',
        audio_file: 'test.mp3',
        segments: [
          {
            sentence_index: 1,
            time_range: '00:00-00:10',
            role_name: '旁白📖',
            dialogue: '测试文本',
          },
        ],
      }

      const result = adaptMultiRoleReading(rawData)

      expect(result.text_id).toBe('WEN_01')
      expect(result.segments.length).toBe(1)
      expect(result.segments[0].startTime).toBe(0)
      expect(result.segments[0].endTime).toBe(10)
      expect(result.segments[0].duration).toBe(10)
      expect(result.totalDuration).toBe(10)
    })

    it('应该正确计算总时长', () => {
      const rawData: RawMultiRoleData = {
        text_id: 'WEN_01',
        audio_file: 'test.mp3',
        segments: [
          { sentence_index: 1, time_range: '00:00-00:10', role_name: '旁白', dialogue: '1' },
          { sentence_index: 2, time_range: '00:10-00:25', role_name: '角色', dialogue: '2' },
        ],
      }

      const result = adaptMultiRoleReading(rawData)
      expect(result.totalDuration).toBe(25)
    })

    it('应该正确处理 null 值并填充默认值', () => {
      const rawData: RawMultiRoleData = {
        text_id: null,
        audio_file: null,
        segments: [
          {
            sentence_index: null,
            time_range: null,
            role_name: null,
            dialogue: null,
            role_icon: null,
            emotion: null,
            subtitle: null,
          },
        ],
        title: null,
        author: null,
        bgm_file: null,
      }

      const result = adaptMultiRoleReading(rawData)

      expect(result.text_id).toBe('')
      expect(result.audio_file).toBe('')
      expect(result.title).toBe('')
      expect(result.author).toBe('')
      expect(result.bgm_file).toBe('')
      expect(result.segments.length).toBe(1)
      expect(result.segments[0].sentence_index).toBe(0)
      expect(result.segments[0].time_range).toBe('00:00-00:00')
      expect(result.segments[0].role_name).toBe('未知角色')
      expect(result.segments[0].dialogue).toBe('')
      expect(result.segments[0].role_icon).toBe('')
      expect(result.segments[0].emotion).toBe('')
      expect(result.segments[0].subtitle).toBe('')
      expect(result.segments[0].startTime).toBe(0)
      expect(result.segments[0].endTime).toBe(0)
      expect(result.segments[0].duration).toBe(0)
    })

    it('应该正确处理 segments 为 null 的情况', () => {
      const rawData: RawMultiRoleData = {
        text_id: 'WEN_01',
        audio_file: 'test.mp3',
        segments: null,
      }

      const result = adaptMultiRoleReading(rawData)

      expect(result.segments).toEqual([])
      expect(result.totalDuration).toBe(0)
    })

    it('应该正确处理 rawData 为 null 的情况', () => {
      const result = adaptMultiRoleReading(null)

      expect(result.text_id).toBe('')
      expect(result.audio_file).toBe('')
      expect(result.segments).toEqual([])
      expect(result.totalDuration).toBe(0)
      expect(result.title).toBe('')
      expect(result.author).toBe('')
      expect(result.bgm_file).toBe('')
    })

    it('应该正确处理预留字段有值的情况', () => {
      const rawData: RawMultiRoleData = {
        text_id: 'WEN_01',
        audio_file: 'test.mp3',
        segments: [
          {
            sentence_index: 1,
            time_range: '00:00-00:10',
            role_name: '角色A',
            dialogue: '对话内容',
            role_icon: '🎭',
            emotion: 'happy',
            subtitle: '字幕内容',
          },
        ],
        title: '测试标题',
        author: '测试作者',
        bgm_file: 'bgm.mp3',
      }

      const result = adaptMultiRoleReading(rawData)

      expect(result.title).toBe('测试标题')
      expect(result.author).toBe('测试作者')
      expect(result.bgm_file).toBe('bgm.mp3')
      expect(result.segments[0].role_icon).toBe('🎭')
      expect(result.segments[0].emotion).toBe('happy')
      expect(result.segments[0].subtitle).toBe('字幕内容')
    })
  })

  describe('getCurrentSegmentIndex', () => {
    const processedSegments: ProcessedMultiRoleSegment[] = [
      {
        sentence_index: 1,
        time_range: '00:00-00:10',
        role_name: '旁白',
        dialogue: '1',
        startTime: 0,
        endTime: 10,
        duration: 10,
        role_icon: '',
        emotion: '',
        subtitle: '',
      },
      {
        sentence_index: 2,
        time_range: '00:10-00:25',
        role_name: '角色',
        dialogue: '2',
        startTime: 10,
        endTime: 25,
        duration: 15,
        role_icon: '',
        emotion: '',
        subtitle: '',
      },
    ]

    it('应该返回正确的片段索引', () => {
      expect(getCurrentSegmentIndex(5, processedSegments)).toBe(0)
      expect(getCurrentSegmentIndex(10, processedSegments)).toBe(1)
      expect(getCurrentSegmentIndex(20, processedSegments)).toBe(1)
      expect(getCurrentSegmentIndex(25, processedSegments)).toBe(1)
    })

    it('应该在没有找到时返回 -1', () => {
      expect(getCurrentSegmentIndex(-1, processedSegments)).toBe(-1)
      expect(getCurrentSegmentIndex(0, [])).toBe(-1)
    })
  })
})

describe('MultiRoleReading.vue', () => {
  const testWenId = 'WEN_01'

  beforeEach(() => {
    vi.clearAllMocks()
    capturedOptions = {}
    mockUseDataLoaderLoaded()
  })

  describe('基础渲染测试', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(MultiRoleReading, {
        props: { wenId: testWenId },
        global: { stubs: ['MultiRoleReadingItem'] },
      })
      expect(wrapper.exists()).toBe(true)
      // 加载完成且有数据时应渲染播放器内容
      expect(wrapper.find('.player-content').exists()).toBe(true)
    })
  })

  describe('Props 测试', () => {
    it('应该正确接收 wenId prop', () => {
      const wrapper = mount(MultiRoleReading, {
        props: { wenId: testWenId },
        global: { stubs: ['MultiRoleReadingItem'] },
      })
      expect(wrapper.props('wenId')).toBe(testWenId)
    })

    it('应该正确接收自定义 baseUrl props', () => {
      const wrapper = mount(MultiRoleReading, {
        props: {
          wenId: testWenId,
          audioBaseUrl: '/custom-audio/',
          dataBaseUrl: '/custom-data/',
        },
        global: { stubs: ['MultiRoleReadingItem'] },
      })
      expect(wrapper.props('audioBaseUrl')).toBe('/custom-audio/')
      expect(wrapper.props('dataBaseUrl')).toBe('/custom-data/')
    })

    it('应该把 props.autoLoad 透传给 useDataLoader', () => {
      mount(MultiRoleReading, {
        props: { wenId: testWenId, autoLoad: false },
        global: { stubs: ['MultiRoleReadingItem'] },
      })
      expect(capturedOptions.autoLoad).toBe(false)
    })

    it('应该把 props.requestTimeout 透传给 useDataLoader', () => {
      mount(MultiRoleReading, {
        props: { wenId: testWenId, requestTimeout: 5000 },
        global: { stubs: ['MultiRoleReadingItem'] },
      })
      expect(capturedOptions.timeout).toBe(5000)
    })

    it('应该把 props.cacheEnabled 透传给 useDataLoader', () => {
      mount(MultiRoleReading, {
        props: { wenId: testWenId, cacheEnabled: false },
        global: { stubs: ['MultiRoleReadingItem'] },
      })
      expect(capturedOptions.cacheEnabled).toBe(false)
    })
  })

  describe('状态渲染测试', () => {
    it('应该在加载中显示 BaseLoader', () => {
      mockUseDataLoaderLoaded({ loading: ref(true), data: ref(null) })
      const wrapper = mount(MultiRoleReading, {
        props: { wenId: testWenId },
        global: { stubs: ['MultiRoleReadingItem'] },
      })
      expect(wrapper.findComponent({ name: 'BaseLoader' }).exists()).toBe(true)
      expect(wrapper.find('.player-content').exists()).toBe(false)
    })

    it('应该在超时时显示 BaseTimeout', () => {
      mockUseDataLoaderLoaded({ isTimeout: ref(true), data: ref(null) })
      const wrapper = mount(MultiRoleReading, {
        props: { wenId: testWenId },
        global: { stubs: ['MultiRoleReadingItem'] },
      })
      expect(wrapper.findComponent({ name: 'BaseTimeout' }).exists()).toBe(true)
    })

    it('应该在数据为空时显示 BaseEmpty', () => {
      mockUseDataLoaderLoaded({
        data: ref({ text_id: '', audio_file: '', segments: [] }),
      })
      const wrapper = mount(MultiRoleReading, {
        props: { wenId: testWenId },
        global: { stubs: ['MultiRoleReadingItem'] },
      })
      expect(wrapper.findComponent({ name: 'BaseEmpty' }).exists()).toBe(true)
    })

    it('应该在错误时显示 BaseError', async () => {
      mockUseDataLoaderLoaded({ data: ref(null) })
      const wrapper = mount(MultiRoleReading, {
        props: { wenId: testWenId },
        global: { stubs: ['MultiRoleReadingItem'] },
      })

      // 触发 onLoadError 回调（模拟 useDataLoader 调用）
      capturedOptions.onLoadError?.('加载失败')
      await nextTick()

      expect(wrapper.findComponent({ name: 'BaseError' }).exists()).toBe(true)
      expect(wrapper.text()).toContain('加载失败')
    })
  })

  describe('音频控制测试', () => {
    it('应该显示音频元素', () => {
      const wrapper = mount(MultiRoleReading, {
        props: { wenId: testWenId },
        global: { stubs: ['MultiRoleReadingItem'] },
      })
      expect(wrapper.find('audio').exists()).toBe(true)
    })
  })

  describe('事件发射测试', () => {
    it('应该在 loading 变 true 时发射 load-start 事件', async () => {
      // 使用动态 ref 以便后续切换
      const loadingRef = ref(false)
      mockUseDataLoaderLoaded({ loading: loadingRef, data: ref(null) })
      const wrapper = mount(MultiRoleReading, {
        props: { wenId: testWenId },
        global: { stubs: ['MultiRoleReadingItem'] },
      })

      // 初始状态（loading=false）不应发射 load-start
      expect(wrapper.emitted('load-start')).toBeFalsy()

      // 切换到 loading=true 应发射 load-start
      loadingRef.value = true
      await nextTick()
      expect(wrapper.emitted('load-start')).toBeTruthy()
      expect(wrapper.emitted('load-start')!.length).toBe(1)
    })

    it('应该在 onLoadSuccess 时发射 load-success 事件', async () => {
      mockUseDataLoaderLoaded({ data: ref(null) })
      const wrapper = mount(MultiRoleReading, {
        props: { wenId: testWenId },
        global: { stubs: ['MultiRoleReadingItem'] },
      })

      capturedOptions.onLoadSuccess?.(mockMultiRoleData)
      await nextTick()

      const events = wrapper.emitted('load-success')
      expect(events).toBeTruthy()
      expect(events![0]).toEqual([mockMultiRoleData])
    })

    it('应该在 onLoadError 时发射 load-error 事件', async () => {
      mockUseDataLoaderLoaded({ data: ref(null) })
      const wrapper = mount(MultiRoleReading, {
        props: { wenId: testWenId },
        global: { stubs: ['MultiRoleReadingItem'] },
      })

      capturedOptions.onLoadError?.('网络错误')
      await nextTick()

      const events = wrapper.emitted('load-error')
      expect(events).toBeTruthy()
      expect(events![0]).toEqual(['网络错误'])
    })

    it('应该把 404 错误格式化为友好提示', async () => {
      mockUseDataLoaderLoaded({ data: ref(null) })
      const wrapper = mount(MultiRoleReading, {
        props: { wenId: testWenId },
        global: { stubs: ['MultiRoleReadingItem'] },
      })

      capturedOptions.onLoadError?.('HTTP 404')
      await nextTick()

      const events = wrapper.emitted('load-error')
      expect(events).toBeTruthy()
      expect(events![0]).toEqual(['【404正在加班加点中】'])
      expect(wrapper.text()).toContain('【404正在加班加点中】')
    })

    it('应该把空 URL 错误格式化为"请提供课文ID"', async () => {
      mockUseDataLoaderLoaded({ data: ref(null) })
      const wrapper = mount(MultiRoleReading, {
        props: { wenId: testWenId },
        global: { stubs: ['MultiRoleReadingItem'] },
      })

      capturedOptions.onLoadError?.('请提供有效的URL')
      await nextTick()

      const events = wrapper.emitted('load-error')
      expect(events).toBeTruthy()
      expect(events![0]).toEqual(['请提供课文ID'])
    })
  })

  describe('transform 校验测试', () => {
    it('应该接收 transform 函数用于数据校验', () => {
      mount(MultiRoleReading, {
        props: { wenId: testWenId },
        global: { stubs: ['MultiRoleReadingItem'] },
      })
      expect(typeof capturedOptions.transform).toBe('function')
    })

    it('transform 校验合法数据时应返回原数据', () => {
      mount(MultiRoleReading, {
        props: { wenId: testWenId },
        global: { stubs: ['MultiRoleReadingItem'] },
      })

      const result = capturedOptions.transform?.(mockMultiRoleData)
      expect(result).toEqual(mockMultiRoleData)
    })

    it('transform 校验非法数据时应抛错', () => {
      mount(MultiRoleReading, {
        props: { wenId: testWenId },
        global: { stubs: ['MultiRoleReadingItem'] },
      })

      // 缺少 segments 字段
      expect(() => capturedOptions.transform?.({ text_id: 'x', audio_file: 'y' })).toThrow()
      // segments 中缺少必填字段
      expect(() =>
        capturedOptions.transform?.({
          text_id: 'x',
          audio_file: 'y',
          segments: [{ sentence_index: 1 }],
        }),
      ).toThrow()
    })
  })

  describe('导出方法测试', () => {
    it('应该导出正确的方法', () => {
      const wrapper = mount(MultiRoleReading, {
        props: { wenId: testWenId },
        global: { stubs: ['MultiRoleReadingItem'] },
      })

      const exposed = wrapper.vm as any
      expect(typeof exposed.loadData).toBe('function')
      expect(typeof exposed.play).toBe('function')
      expect(typeof exposed.pause).toBe('function')
      expect(typeof exposed.seek).toBe('function')
      expect(typeof exposed.getCurrentSegment).toBe('function')
    })

    it('loadData 应该调用 useDataLoader 的 retry', () => {
      const mockRetry = vi.fn()
      mockUseDataLoaderLoaded({ retry: mockRetry })

      const wrapper = mount(MultiRoleReading, {
        props: { wenId: testWenId },
        global: { stubs: ['MultiRoleReadingItem'] },
      })

      ;(wrapper.vm as any).loadData()
      expect(mockRetry).toHaveBeenCalledTimes(1)
    })
  })

  describe('分层规则验证', () => {
    it('组件内不应直接调用 fetch（应通过 useDataLoader）', () => {
      const fetchSpy = vi.spyOn(global, 'fetch')
      mount(MultiRoleReading, {
        props: { wenId: testWenId },
        global: { stubs: ['MultiRoleReadingItem'] },
      })
      expect(fetchSpy).not.toHaveBeenCalled()
      fetchSpy.mockRestore()
    })
  })
})
