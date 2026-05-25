import { describe, it, expect } from 'vitest'
import { getWenId, getPoemTitle, poemMap } from '@/utils/wenUtils'

describe('wenUtils', () => {
  describe('getWenId 函数', () => {
    it('应该返回默认的 WEN_01 当输入为空时', () => {
      expect(getWenId('')).toBe('WEN_01')
    })

    it('应该原样返回已经是 WEN_xx 格式的输入', () => {
      expect(getWenId('WEN_01')).toBe('WEN_01')
      expect(getWenId('WEN_99')).toBe('WEN_99')
    })

    it('应该转换数字输入为 WEN_xx 格式', () => {
      expect(getWenId('1')).toBe('WEN_01')
      expect(getWenId('5')).toBe('WEN_05')
      expect(getWenId('12')).toBe('WEN_12')
    })

    it('应该处理无效输入返回默认值', () => {
      expect(getWenId('abc')).toBe('WEN_01')
      expect(getWenId('!@#$')).toBe('WEN_01')
    })

    it('应该处理数值类型的输入', () => {
      // 注意：函数签名是 string 类型，这里测试边界情况
      expect(getWenId('10')).toBe('WEN_10')
    })
  })

  describe('getPoemTitle 函数', () => {
    it('应该返回正确的篇目标题', () => {
      Object.keys(poemMap).forEach((key) => {
        expect(getPoemTitle(key)).toBe(poemMap[key].title)
      })
    })

    it('应该返回未知篇目当输入不存在的 key', () => {
      expect(getPoemTitle('nonexistent')).toBe('未知篇目')
    })

    it('应该正确处理空字符串输入', () => {
      expect(getPoemTitle('')).toBe('未知篇目')
    })
  })

  describe('poemMap 对象', () => {
    it('应该包含预定义的篇目信息', () => {
      expect(poemMap).toBeDefined()
      expect(typeof poemMap).toBe('object')
    })

    it('每个篇目的应该有 title 属性', () => {
      Object.values(poemMap).forEach((poem) => {
        expect(poem).toHaveProperty('title')
        expect(typeof poem.title).toBe('string')
      })
    })

    it('应该至少有一个篇目', () => {
      expect(Object.keys(poemMap).length).toBeGreaterThan(0)
    })
  })
})
