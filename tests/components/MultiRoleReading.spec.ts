import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MultiRoleReading from '@/components/MultiRoleReading.vue'
import {
  adaptMultiRoleReading,
  parseTimeRange,
  timeToSeconds,
  formatTime,
  getCurrentSegmentIndex,
  type RawMultiRoleData,
  type ProcessedMultiRoleData,
} from '@/adapters/readingAdapter'

// Mock fetch
beforeEach(() => {
  vi.restoreAllMocks()
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
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
      }),
  })
})

afterEach(() => {
  vi.clearAllMocks()
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

  describe('基础渲染测试', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(MultiRoleReading, {
        props: {
          wenId: testWenId,
        },
        global: {
          stubs: ['MultiRoleReadingItem', 'BaseLoader', 'BaseError', 'BaseEmpty', 'BaseTimeout'],
        },
      })
      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('Props 测试', () => {
    it('应该正确接收 wenId prop', () => {
      const wrapper = mount(MultiRoleReading, {
        props: {
          wenId: testWenId,
        },
        global: {
          stubs: ['MultiRoleReadingItem', 'BaseLoader', 'BaseError', 'BaseEmpty', 'BaseTimeout'],
        },
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
        global: {
          stubs: ['MultiRoleReadingItem', 'BaseLoader', 'BaseError', 'BaseEmpty', 'BaseTimeout'],
        },
      })
      expect(wrapper.props('audioBaseUrl')).toBe('/custom-audio/')
      expect(wrapper.props('dataBaseUrl')).toBe('/custom-data/')
    })
  })

  describe('音频控制测试', () => {
    it('应该显示音频元素', () => {
      const wrapper = mount(MultiRoleReading, {
        props: {
          wenId: testWenId,
        },
        global: {
          stubs: ['MultiRoleReadingItem', 'BaseLoader', 'BaseError', 'BaseEmpty', 'BaseTimeout'],
        },
      })
      expect(wrapper.find('audio').exists()).toBe(true)
    })

    it('应该显示加载状态', () => {
      const wrapper = mount(MultiRoleReading, {
        props: {
          wenId: testWenId,
        },
        global: {
          stubs: ['MultiRoleReadingItem', 'BaseLoader', 'BaseError', 'BaseEmpty', 'BaseTimeout'],
        },
      })
      expect(wrapper.findComponent({ name: 'BaseLoader' }).exists()).toBe(true)
    })
  })

  describe('导出方法测试', () => {
    it('应该导出正确的方法', () => {
      const wrapper = mount(MultiRoleReading, {
        props: {
          wenId: testWenId,
        },
        global: {
          stubs: ['MultiRoleReadingItem', 'BaseLoader', 'BaseError', 'BaseEmpty', 'BaseTimeout'],
        },
      })

      const exposed = wrapper.vm as any
      expect(typeof exposed.loadData).toBe('function')
      expect(typeof exposed.play).toBe('function')
      expect(typeof exposed.pause).toBe('function')
      expect(typeof exposed.seek).toBe('function')
      expect(typeof exposed.getCurrentSegment).toBe('function')
    })
  })
})
