import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getAssetUrl, ossBase } from '@/utils/asset'

describe('utils/asset', () => {
  const originalEnv = import.meta.env

  beforeEach(() => {
    // 重置环境变量快照
    vi.stubEnv('VITE_OSS_BASE_URL', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('ossBase 常量', () => {
    it('VITE_OSS_BASE_URL 未配置时为空字符串（R96: 不出现 undefined）', () => {
      // 用 getAssetUrl 间接验证：ossBase 为空时拼出的 URL 不以 undefined 开头
      const url = getAssetUrl('audio', 'test.mp3')
      expect(url).not.toContain('undefined')
      expect(url).toBe('/audio/test.mp3')
    })
  })

  describe('getAssetUrl', () => {
    it('未配置 OSS 基础路径时返回相对路径', () => {
      vi.stubEnv('VITE_OSS_BASE_URL', '')
      expect(getAssetUrl('audio', 'WEN_01.mp3')).toBe('/audio/WEN_01.mp3')
      expect(getAssetUrl('images', 'WEN_01.jpg')).toBe('/images/WEN_01.jpg')
      expect(getAssetUrl('video', 'WEN_01.mp4')).toBe('/video/WEN_01.mp4')
    })

    it('配置 OSS 基础路径时拼接完整 URL', () => {
      vi.stubEnv('VITE_OSS_BASE_URL', 'https://oss.example.com')
      expect(getAssetUrl('audio', 'WEN_01.mp3')).toBe(
        'https://oss.example.com/audio/WEN_01.mp3',
      )
      expect(getAssetUrl('images', 'WEN_01.jpg')).toBe(
        'https://oss.example.com/images/WEN_01.jpg',
      )
    })

    it('R97: 文件名含空格时进行 URL 编码', () => {
      expect(getAssetUrl('audio', 'WEN 01 read full.mp3')).toBe(
        '/audio/WEN%2001%20read%20full.mp3',
      )
    })

    it('R97: 文件名含中文字符时进行 URL 编码', () => {
      const result = getAssetUrl('images', '陋室铭_插画.jpg')
      expect(result).toContain(encodeURIComponent('陋室铭_插画.jpg'))
    })

    it('R97: 文件名含特殊字符 # / ? 时进行 URL 编码', () => {
      const result = getAssetUrl('video', 'intro#part1?version=2/2024.mp4')
      expect(result).toBe(
        `/video/${encodeURIComponent('intro#part1?version=2/2024.mp4')}`,
      )
      // 编码后不能保留原始的 # / ?
      expect(result).not.toMatch(/\/video\/.*[#?].*\.mp4$/)
    })

    it('文件名已经是普通字母数字时不改变内容', () => {
      expect(getAssetUrl('audio', 'abc123.mp3')).toBe('/audio/abc123.mp3')
    })
  })
})
