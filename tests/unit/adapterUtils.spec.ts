import { describe, it, expect } from 'vitest'
import { escapeHtml, escapeRegex, parseTimeToSeconds, parseTimeRange, buildContentHtmlWithAnnotations, getSafe } from '@/utils/adapterUtils'

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

  describe('buildContentHtmlWithAnnotations', () => {
    it('should build HTML with annotations', () => {
      const content = '学而时习之'
      const annotations = [{ word: '学', meaning: '学习' }, { word: '习', meaning: '练习' }]
      const result = buildContentHtmlWithAnnotations(content, annotations)
      expect(result).toContain('<span class="annotated-word" data-def="学习">学</span>')
      expect(result).toContain('<span class="annotated-word" data-def="练习">习</span>')
    })

    it('should handle empty content', () => {
      expect(buildContentHtmlWithAnnotations('', [{ word: 'test', meaning: '测试' }])).toBe('')
    })

    it('should handle empty annotations', () => {
      expect(buildContentHtmlWithAnnotations('hello', [])).toBe('hello')
    })

    it('should handle null or undefined', () => {
      expect(buildContentHtmlWithAnnotations(null as any, null as any)).toBe('')
      expect(buildContentHtmlWithAnnotations(undefined as any, undefined as any)).toBe('')
    })

    it('should escape special characters in annotations', () => {
      const content = 'test <script>'
      const annotations = [{ word: '<script>', meaning: 'alert("xss")' }]
      const result = buildContentHtmlWithAnnotations(content, annotations)
      expect(result).toContain('&lt;script&gt;')
      expect(result).not.toContain('<script>')
    })

    it('should prioritize longer words', () => {
      const content = '北京大学'
      const annotations = [{ word: '北京', meaning: '城市' }, { word: '北京大学', meaning: '大学' }]
      const result = buildContentHtmlWithAnnotations(content, annotations)
      expect(result).toContain('北京大学')
      expect(result).not.toMatch(/<span.*北京.*<\/span>.*大学/)
    })

    it('应替换同一词语的所有出现位置', () => {
      const content = '学者学而时习之，学者不思则罔'
      const annotations = [{ word: '学', meaning: '学习' }]
      const result = buildContentHtmlWithAnnotations(content, annotations)
      const matches = result.match(/<span class="annotated-word" data-def="学习">学<\/span>/g)
      expect(matches).not.toBeNull()
      expect(matches?.length).toBe(3)
    })

    it('应避免注释释义包含被注释词时的递归替换', () => {
      // 核心回归用例：旧实现采用 result.replace 正则替换，若释义文本中包含被注释词，
      // 已注入的 span 会被再次匹配并破坏输出。占位符策略应避免该问题。
      const content = '经典'
      const annotations = [{ word: '经', meaning: '经常引用的典' }]
      const result = buildContentHtmlWithAnnotations(content, annotations)
      expect(result).toContain('data-def="经常引用的典"')
      expect(result).toContain('>经</span>')
      // 释义里的"典"不应被重复处理为带 span 的内容
      expect(result).not.toContain('>经常引用')
      expect(result).not.toContain('>引用的典</span>')
    })

    it('应避免释义中包含被注释词导致 span 标签被破坏', () => {
      // 旧实现下：第一步把 content 中的"学"替换为 <span>学</span>；
      // 第二步若释义包含"学"，会再次匹配并把 span 内的"学"再次包一层 span。
      // 占位符策略应保证只有最外层 span。
      const content = '仁者爱人'
      const annotations = [{ word: '爱', meaning: '喜爱与仁爱之心' }]
      const result = buildContentHtmlWithAnnotations(content, annotations)
      const spanCount = (result.match(/<span class="annotated-word"/g) || []).length
      expect(spanCount).toBe(1)
      expect(result).toContain('data-def="喜爱与仁爱之心"')
    })

    it('应正确处理相邻出现的同一词语', () => {
      const content = '学习学习'
      const annotations = [{ word: '学习', meaning: '学而时习之' }]
      const result = buildContentHtmlWithAnnotations(content, annotations)
      const matches = result.match(/<span class="annotated-word" data-def="学而时习之">学习<\/span>/g)
      expect(matches).not.toBeNull()
      expect(matches?.length).toBe(2)
    })

    it('应正确处理短词被长词包含时的边界情况', () => {
      const content = '学习学而时习之'
      const annotations = [
        { word: '学', meaning: '学习行为' },
        { word: '学习', meaning: '学而时习之的过程' },
      ]
      const result = buildContentHtmlWithAnnotations(content, annotations)
      // 长词应优先匹配
      expect(result).toContain('学而时习之的过程')
      expect(result).toContain('学习行为')
      // 只应有一个完整的"学习"span
      const learnSpans = (result.match(/data-def="学而时习之的过程">学习<\/span>/g) || []).length
      expect(learnSpans).toBe(1)
    })
  })

  describe('getSafe', () => {
    it('should get existing property', () => {
      const obj = { name: '张三', age: 18 }
      expect(getSafe(obj, 'name', 'default')).toBe('张三')
      expect(getSafe(obj, 'age', 0)).toBe(18)
    })

    it('should return default value for missing property', () => {
      const obj = { name: '张三' }
      expect(getSafe(obj, 'age', 0)).toBe(0)
      expect(getSafe(obj, 'address', 'unknown')).toBe('unknown')
    })

    it('should return default value for null or undefined', () => {
      expect(getSafe(null as any, 'name', 'default')).toBe('default')
      expect(getSafe(undefined as any, 'name', 'default')).toBe('default')
    })

    it('should return default value for non-object types', () => {
      expect(getSafe('string' as any, 'length', 0)).toBe(0)
      expect(getSafe(123 as any, 'toString', 'default')).toBe('default')
    })

    it('should handle undefined property value', () => {
      const obj = { name: undefined }
      expect(getSafe(obj, 'name', 'default')).toBe('default')
    })
  })
})