/**
 * adapterUtils 单元测试
 *
 * 覆盖范围：
 * 1. escapeHtml - XSS 防护，转义 5 种 HTML 特殊字符
 * 2. escapeRegex - 正则转义，防止用户输入被当作正则模式
 * 3. normalizeQuotes - 引号规范化，统一弯引号→直引号
 * 4. buildContentHtmlWithAnnotations - 核心渲染函数：
 *    - 无注释 / 有注释路径
 *    - removeSlashes / wrapParagraphs 选项
 *    - 占位符策略防止交叉匹配
 * 5. getSafe - 安全属性访问
 */
import { describe, it, expect } from 'vitest'
import {
  escapeHtml,
  escapeRegex,
  normalizeQuotes,
  buildContentHtmlWithAnnotations,
  getSafe,
} from '@/utils/adapterUtils'

// ============================================================
// escapeHtml
// ============================================================
describe('escapeHtml', () => {
  it('转义 & 为 &amp;', () => {
    expect(escapeHtml('a&b')).toBe('a&amp;b')
  })

  it('转义 < 为 &lt;', () => {
    expect(escapeHtml('a<b')).toBe('a&lt;b')
  })

  it('转义 > 为 &gt;', () => {
    expect(escapeHtml('a>b')).toBe('a&gt;b')
  })

  it('转义 " 为 &quot;', () => {
    expect(escapeHtml('a"b')).toBe('a&quot;b')
  })

  it("转义 ' 为 &#39;", () => {
    expect(escapeHtml("a'b")).toBe('a&#39;b')
  })

  it('同时包含所有特殊字符时全部转义', () => {
    expect(escapeHtml('<script>alert("xss")&\'</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&amp;&#39;&lt;/script&gt;',
    )
  })

  it('空字符串返回空字符串', () => {
    expect(escapeHtml('')).toBe('')
  })

  it('非字符串输入返回空字符串', () => {
    expect(escapeHtml(null as unknown as string)).toBe('')
    expect(escapeHtml(undefined as unknown as string)).toBe('')
    expect(escapeHtml(123 as unknown as string)).toBe('')
  })

  it('无特殊字符的字符串原样返回', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })
})

// ============================================================
// escapeRegex
// ============================================================
describe('escapeRegex', () => {
  it('转义 . * + ? ^ $ ( ) | [ ] { } \\', () => {
    expect(escapeRegex('a.b*c+d?e^f$g(h)i|j[k]l{m}n\\o')).toBe(
      'a\\.b\\*c\\+d\\?e\\^f\\$g\\(h\\)i\\|j\\[k\\]l\\{m\\}n\\\\o',
    )
  })

  it('空字符串返回空字符串', () => {
    expect(escapeRegex('')).toBe('')
  })

  it('非字符串输入返回空字符串', () => {
    expect(escapeRegex(null as unknown as string)).toBe('')
  })

  it('普通文本不受影响', () => {
    expect(escapeRegex('hello')).toBe('hello')
  })
})

// ============================================================
// normalizeQuotes
// ============================================================
describe('normalizeQuotes', () => {
  it('中文双引号 \u201C\u201D → 直双引号', () => {
    expect(normalizeQuotes('\u201C你好\u201D')).toBe('"你好"')
  })

  it('中文单引号 \u2018\u2019 → 直单引号', () => {
    expect(normalizeQuotes('\u2018你好\u2019')).toBe("'你好'")
  })

  it('日文括号 \u300C\u300D → 直双引号', () => {
    expect(normalizeQuotes('\u300C你好\u300D')).toBe('"你好"')
  })

  it('日文双括号 \u300E\u300F → 直单引号', () => {
    expect(normalizeQuotes('\u300E你好\u300F')).toBe("'你好'")
  })

  it('反引号 ` → 直单引号', () => {
    expect(normalizeQuotes('`code`')).toBe("'code'")
  })

  it('尖音符 ´ → 直单引号', () => {
    expect(normalizeQuotes('caf\u00B4')).toBe("caf'")
  })

  it('空字符串返回空字符串', () => {
    expect(normalizeQuotes('')).toBe('')
  })

  it('非字符串输入返回空字符串', () => {
    expect(normalizeQuotes(null as unknown as string)).toBe('')
  })

  it('无引号文本不受影响', () => {
    expect(normalizeQuotes('普通文本')).toBe('普通文本')
  })

  it('混合引号全部规范化', () => {
    const input = '\u201C引号\u201D\u2018单引\u2019`代码`'
    expect(normalizeQuotes(input)).toBe('"引号"\'单引\'\'代码\'')
  })
})

// ============================================================
// buildContentHtmlWithAnnotations
// ============================================================
describe('buildContentHtmlWithAnnotations', () => {
  describe('空内容处理', () => {
    it('content 为空字符串返回空字符串', () => {
      expect(buildContentHtmlWithAnnotations('', [])).toBe('')
    })

    it('content 为空字符串且有注释也返回空字符串', () => {
      expect(buildContentHtmlWithAnnotations('', [{ word: '之', meaning: '的' }])).toBe('')
    })
  })

  describe('无注释路径', () => {
    it('纯文本不做 HTML 转义外的处理', () => {
      expect(buildContentHtmlWithAnnotations('静夜思', null)).toBe('静夜思')
    })

    it('HTML 特殊字符被转义', () => {
      expect(buildContentHtmlWithAnnotations('a<b>c&d', null)).toBe('a&lt;b&gt;c&amp;d')
    })

    it('removeSlashes=true 移除斜杠', () => {
      expect(buildContentHtmlWithAnnotations('床前/明月', null, { removeSlashes: true })).toBe('床前明月')
    })

    it('wrapParagraphs=true 将换行转为 <p>/<br> 标签', () => {
      const result = buildContentHtmlWithAnnotations('第一行\n第二行', null, { wrapParagraphs: true })
      expect(result).toBe('<p>第一行<br>第二行</p>')
    })

    it('双换行转为段落分隔', () => {
      const result = buildContentHtmlWithAnnotations('第一段\n\n第二段', null, { wrapParagraphs: true })
      expect(result).toBe('<p>第一段</p><p>第二段</p>')
    })

    it('removeSlashes + wrapParagraphs 组合', () => {
      const result = buildContentHtmlWithAnnotations('床前/明月\n疑是/地上霜', null, {
        removeSlashes: true,
        wrapParagraphs: true,
      })
      expect(result).toBe('<p>床前明月<br>疑是地上霜</p>')
    })
  })

  describe('有注释路径', () => {
    it('单个注释词被 span 包裹', () => {
      const result = buildContentHtmlWithAnnotations('之', [{ word: '之', meaning: '的' }])
      expect(result).toContain('class="annotated-word"')
      expect(result).toContain('data-def="的"')
      expect(result).toContain('>之<')
    })

    it('多个注释词各自独立包裹', () => {
      const result = buildContentHtmlWithAnnotations(
        '之乎者也',
        [
          { word: '之', meaning: '的' },
          { word: '乎', meaning: '语气词' },
        ],
      )
      expect(result).toContain('data-def="的"')
      expect(result).toContain('data-def="语气词"')
    })

    it('长词优先匹配（避免短词破坏长词）', () => {
      const result = buildContentHtmlWithAnnotations(
        '君子',
        [
          { word: '君', meaning: '君主' },
          { word: '君子', meaning: '有德之人' },
        ],
      )
      // "君子"作为整体应被匹配，"君"不应单独拆出
      expect(result).toContain('data-def="有德之人"')
      expect(result).not.toContain('data-def="君主"')
    })

    it('注释中的 HTML 特殊字符被转义', () => {
      const result = buildContentHtmlWithAnnotations('词', [
        { word: '词', meaning: '<script>alert("xss")</script>' },
      ])
      // meaning 中的 HTML 应被转义
      expect(result).toContain('data-def="&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"')
      expect(result).not.toContain('<script>')
    })

    it('有注释 + removeSlashes=true 移除非注释词中的斜杠', () => {
      const result = buildContentHtmlWithAnnotations(
        '之/乎',
        [{ word: '之', meaning: '的' }],
        { removeSlashes: true },
      )
      // 斜杠被移除后，"之"仍能匹配注释，"乎"紧随其后
      expect(result).toContain('data-def="的"')
      expect(result).toContain('>之<')
    })

    it('有注释 + wrapParagraphs=true', () => {
      const result = buildContentHtmlWithAnnotations(
        '之\n乎',
        [{ word: '之', meaning: '的' }],
        { wrapParagraphs: true },
      )
      expect(result).toContain('<p>')
      expect(result).toContain('<br>')
      expect(result).toContain('data-def="的"')
    })

    it('相同词出现多次均被注释', () => {
      const result = buildContentHtmlWithAnnotations(
        '之行之人',
        [{ word: '之', meaning: '的' }],
      )
      // "之"出现两次，都应被注释
      const matchCount = (result.match(/data-def="的"/g) || []).length
      expect(matchCount).toBe(2)
    })

    it('弯引号先被规范化再匹配注释', () => {
      const result = buildContentHtmlWithAnnotations(
        '\u201C之\u201D',
        [{ word: '"之"', meaning: '的' }],
      )
      // 原文弯引号规范化为直引号后，应与注释词匹配
      expect(result).toContain('data-def="的"')
    })
  })
})

// ============================================================
// getSafe
// ============================================================
describe('getSafe', () => {
  it('对象有指定 key 返回对应值', () => {
    expect(getSafe({ name: 'test' }, 'name', 'default')).toBe('test')
  })

  it('对象没有指定 key 返回默认值', () => {
    expect(getSafe({ name: 'test' }, 'age', 18)).toBe(18)
  })

  it('值为 undefined 时返回默认值', () => {
    expect(getSafe({ name: undefined }, 'name', 'default')).toBe('default')
  })

  it('null 对象返回默认值', () => {
    expect(getSafe(null, 'name', 'default')).toBe('default')
  })

  it('undefined 对象返回默认值', () => {
    expect(getSafe(undefined, 'name', 'default')).toBe('default')
  })

  it('非对象原始值返回默认值', () => {
    expect(getSafe('string', 'length', 0)).toBe(0)
  })
})
