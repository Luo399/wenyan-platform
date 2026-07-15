import { describe, it, expect } from 'vitest'
import { escapeHtml, escapeRegex, parseTimeToSeconds, parseTimeRange } from '@/utils/adapterUtils'

describe('adapterUtils', () => {
  describe('escapeHtml', () => {
    it('should escape special HTML characters', () => {
      expect(escapeHtml('<script>alert("XSS")</script>')).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;')
      expect(escapeHtml('& < > " \'')).toBe('&amp; &lt; &gt; &quot; &#39;')
    })

    it('should return empty string for null or undefined', () => {
      expect(escapeHtml(null as any)).toBe('')
      expect(escapeHtml(undefined as any)).toBe('')
    })

    it('should handle empty string', () => {
      expect(escapeHtml('')).toBe('')
    })
  })

  describe('escapeRegex', () => {
    it('should escape regex special characters', () => {
      expect(escapeRegex('test.')).toBe('test\\.')
      expect(escapeRegex('test*')).toBe('test\\*')
      expect(escapeRegex('test?')).toBe('test\\?')
      expect(escapeRegex('test[]')).toBe('test\\[\\]')
      expect(escapeRegex('test()')).toBe('test\\(\\)')
      expect(escapeRegex('test{}')).toBe('test\\{\\}')
      expect(escapeRegex('test|')).toBe('test\\|')
      expect(escapeRegex('test\\')).toBe('test\\\\')
      expect(escapeRegex('test^$')).toBe('test\\^\\$')
    })

    it('should return empty string for null or undefined', () => {
      expect(escapeRegex(null as any)).toBe('')
      expect(escapeRegex(undefined as any)).toBe('')
    })

    it('should handle empty string', () => {
      expect(escapeRegex('')).toBe('')
    })

    it('should handle strings without special characters', () => {
      expect(escapeRegex('hello world')).toBe('hello world')
    })
  })

  describe('parseTimeToSeconds', () => {
    it('should parse MM:SS format', () => {
      expect(parseTimeToSeconds('01:30')).toBe(90)
      expect(parseTimeToSeconds('00:15')).toBe(15)
      expect(parseTimeToSeconds('10:00')).toBe(600)
    })

    it('should parse HH:MM:SS format', () => {
      expect(parseTimeToSeconds('01:02:30')).toBe(3750)
      expect(parseTimeToSeconds('00:01:00')).toBe(60)
    })

    it('should handle invalid formats', () => {
      expect(parseTimeToSeconds('invalid')).toBe(0)
      expect(parseTimeToSeconds('')).toBe(0)
      expect(parseTimeToSeconds(null as any)).toBe(0)
    })
  })

  describe('parseTimeRange', () => {
    it('should parse time range', () => {
      const result = parseTimeRange('00:00-00:15')
      expect(result.start).toBe(0)
      expect(result.end).toBe(15)
    })

    it('should handle invalid formats', () => {
      const result = parseTimeRange('invalid')
      expect(result.start).toBe(0)
      expect(result.end).toBe(0)
    })
  })
})