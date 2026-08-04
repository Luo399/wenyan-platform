import { describe, it, expect } from 'vitest'
import { formatDate, formatAnswer } from '@/utils/format'

describe('utils/format', () => {
  describe('formatDate', () => {
    it('空值返回 "-"', () => {
      expect(formatDate(undefined)).toBe('-')
      expect(formatDate('')).toBe('-')
    })

    it('无效日期字符串返回 "-"（R100: 避免展示 Invalid Date）', () => {
      expect(formatDate('not-a-date')).toBe('-')
      expect(formatDate('2024-13-45')).toBe('-')
    })

    it('合法 ISO 日期字符串格式化成功', () => {
      const result = formatDate('2024-01-15T10:30:00Z')
      // 格式化为 zh-CN 本地化字符串，至少不返回 '-' 或 'Invalid Date'
      expect(result).not.toBe('-')
      expect(result).not.toContain('Invalid')
    })

    it('普通日期字符串（非 ISO）可正常解析', () => {
      const result = formatDate('2024-06-01 08:00:00')
      expect(result).not.toBe('-')
    })
  })

  describe('formatAnswer', () => {
    it('null/undefined 返回 "-"', () => {
      expect(formatAnswer(null)).toBe('-')
      expect(formatAnswer(undefined)).toBe('-')
    })

    it('字符串数组用逗号拼接', () => {
      expect(formatAnswer(['A', 'B', 'C'])).toBe('A, B, C')
      expect(formatAnswer(['正确'])).toBe('正确')
      expect(formatAnswer([])).toBe('')
    })

    it('数字数组用逗号拼接', () => {
      expect(formatAnswer([0, 1, 2])).toBe('0, 1, 2')
    })

    it('混合类型数组正常拼接', () => {
      expect(formatAnswer(['A', 1, true])).toBe('A, 1, true')
    })

    it('普通字符串直接返回（不做额外处理）', () => {
      expect(formatAnswer('正确答案')).toBe('正确答案')
      expect(formatAnswer('')).toBe('')
    })

    it('数字转字符串', () => {
      expect(formatAnswer(0)).toBe('0')
      expect(formatAnswer(100)).toBe('100')
      expect(formatAnswer(-1)).toBe('-1')
    })

    it('布尔值转字符串', () => {
      expect(formatAnswer(true)).toBe('true')
      expect(formatAnswer(false)).toBe('false')
    })

    it('对象调用 toString 转字符串', () => {
      const obj = { key: 'value', toString: () => 'custom-tostring' }
      expect(formatAnswer(obj)).toBe('custom-tostring')
    })
  })
})
