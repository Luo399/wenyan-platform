import { describe, it, expect } from 'vitest'
import { getWenId, getPoemTitle, poemMap, getAllPoems } from '@/utils/wenUtils'

describe('wenUtils', () => {
  describe('getWenId', () => {
    it('should return formatted WEN_xx for numeric input', () => {
      expect(getWenId('1')).toBe('WEN_01')
      expect(getWenId('10')).toBe('WEN_10')
      expect(getWenId('99')).toBe('WEN_99')
    })

    it('should return input as-is if already formatted', () => {
      expect(getWenId('WEN_01')).toBe('WEN_01')
      expect(getWenId('WEN_10')).toBe('WEN_10')
    })

    it('should handle zero-padded input', () => {
      expect(getWenId('01')).toBe('WEN_01')
      expect(getWenId('007')).toBe('WEN_07')
    })

    it('should return default WEN_01 for invalid input', () => {
      expect(getWenId('')).toBe('WEN_01')
      expect(getWenId('abc')).toBe('WEN_01')
      expect(getWenId('WEN_abc')).toBe('WEN_abc') // Already starts with WEN_
    })

    it('should handle negative numbers', () => {
      expect(getWenId('-1')).toBe('WEN_-1') // 负数会被解析为数字
      expect(getWenId('-10')).toBe('WEN_-10')
    })

    it('should handle null-like input', () => {
      expect(getWenId('   ')).toBe('WEN_01')
    })

    it('should handle two-digit numbers correctly', () => {
      expect(getWenId('5')).toBe('WEN_05')
      expect(getWenId('12')).toBe('WEN_12')
    })
  })

  describe('getPoemTitle', () => {
    it('should return correct title for valid poemId', () => {
      expect(getPoemTitle('1')).toBe('陈涉世家')
      expect(getPoemTitle('2')).toBe('马说')
      expect(getPoemTitle('3')).toBe('岳阳楼记')
      expect(getPoemTitle('4')).toBe('庄子与惠子')
    })

    it('should handle WEN_xx format', () => {
      expect(getPoemTitle('WEN_01')).toBe('陈涉世家')
      expect(getPoemTitle('WEN_02')).toBe('马说')
    })

    it('should return default for unknown poemId', () => {
      expect(getPoemTitle('5')).toBe('未知篇目')
      expect(getPoemTitle('0')).toBe('未知篇目')
      expect(getPoemTitle('100')).toBe('未知篇目')
      expect(getPoemTitle('abc')).toBe('未知篇目')
    })

    it('should handle zero-padded ids', () => {
      expect(getPoemTitle('01')).toBe('陈涉世家')
      expect(getPoemTitle('002')).toBe('马说')
    })
  })

  describe('poemMap', () => {
    it('should contain all expected poems', () => {
      expect(poemMap).toHaveProperty('1')
      expect(poemMap).toHaveProperty('2')
      expect(poemMap).toHaveProperty('3')
      expect(poemMap).toHaveProperty('4')
    })

    it('should have correct structure', () => {
      expect(poemMap['1']).toHaveProperty('title')
      expect(typeof poemMap['1'].title).toBe('string')
    })

    it('should have correct title mapping (matching real data files)', () => {
      // 与真实 WEN_XX 数据文件保持一致：WEN_01=陈涉世家, WEN_02=马说
      expect(poemMap['1'].title).toBe('陈涉世家')
      expect(poemMap['2'].title).toBe('马说')
      expect(poemMap['3'].title).toBe('岳阳楼记')
      // WEN_04 标题做简写处理
      expect(poemMap['4'].title).toBe('庄子与惠子')
    })
  })

  describe('getAllPoems', () => {
    it('should return 4 poems', () => {
      const poems = getAllPoems()
      expect(poems.length).toBe(4)
    })

    it('should return poems sorted by poemId ascending', () => {
      const poems = getAllPoems()
      expect(poems[0].poemId).toBe('1')
      expect(poems[1].poemId).toBe('2')
      expect(poems[2].poemId).toBe('3')
      expect(poems[3].poemId).toBe('4')
    })

    it('should return correct wenId format', () => {
      const poems = getAllPoems()
      expect(poems[0].wenId).toBe('WEN_01')
      expect(poems[1].wenId).toBe('WEN_02')
      expect(poems[2].wenId).toBe('WEN_03')
      expect(poems[3].wenId).toBe('WEN_04')
    })

    it('should return poems with all 3 fields (wenId, title, poemId)', () => {
      const poems = getAllPoems()
      for (const p of poems) {
        expect(typeof p.wenId).toBe('string')
        expect(typeof p.title).toBe('string')
        expect(typeof p.poemId).toBe('string')
        expect(p.wenId.startsWith('WEN_')).toBe(true)
        expect(p.title.length).toBeGreaterThan(0)
      }
    })

    it('should have WEN_04 title as short form', () => {
      const poems = getAllPoems()
      const wen04 = poems.find((p) => p.wenId === 'WEN_04')
      expect(wen04).toBeDefined()
      expect(wen04!.title).toBe('庄子与惠子')
    })

    it('should return consistent title with poemMap', () => {
      const poems = getAllPoems()
      for (const p of poems) {
        expect(p.title).toBe(poemMap[p.poemId].title)
      }
    })
  })
})
