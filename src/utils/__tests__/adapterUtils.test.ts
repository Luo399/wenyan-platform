import { describe, it, expect } from 'vitest'
import {
  buildContentHtmlWithAnnotations,
  escapeHtml,
  escapeRegex,
  getSafe,
  normalizeQuotes,
} from '../adapterUtils'

/** 一条最简注释，减少测试里的噪音 */
function annotation(word: string, meaning: string, followUpQuestions?: string[]) {
  return { word, meaning, followUpQuestions }
}

describe('buildContentHtmlWithAnnotations 的注释 span 输出', () => {
  it('基本形态：class + data-def + 词文本', () => {
    const html = buildContentHtmlWithAnnotations('尝与人佣耕', [annotation('尝', '曾经')])
    expect(html).toContain('<span class="annotated-word" data-def="曾经">尝</span>')
  })

  it('data-def 里的引号与尖括号被转义，不会截断属性', () => {
    const meaning = '叫"阳"，读 yáng<script>'
    const html = buildContentHtmlWithAnnotations('阳夏', [annotation('阳夏', meaning)])
    expect(html).toContain(`data-def="${escapeHtml(meaning)}"`)
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('data-def="叫"阳"')
  })

  describe('follow_up_questions 结构预留（本轮不做追问 UI）', () => {
    it('字段缺失 → 不写 data-follow-up（当前 4 篇课文的真实形态）', () => {
      const html = buildContentHtmlWithAnnotations('燕雀安知鸿鹄之志', [
        annotation('鸿鹄', '比喻有远大抱负的人'),
      ])
      expect(html).not.toContain('data-follow-up')
    })

    it('空数组 → 不写 data-follow-up，保证 DOM 与线上现状逐字节一致', () => {
      const withEmpty = buildContentHtmlWithAnnotations('鸿鹄', [annotation('鸿鹄', '天鹅', [])])
      const withoutField = buildContentHtmlWithAnnotations('鸿鹄', [annotation('鸿鹄', '天鹅')])
      expect(withEmpty).toBe(withoutField)
      expect(withEmpty).not.toContain('data-follow-up')
    })

    it('非空数组 → 写入转义后的 JSON 列表', () => {
      const html = buildContentHtmlWithAnnotations('鸿鹄', [
        annotation('鸿鹄', '天鹅', ['鸿鹄具体指哪种鸟？', '为什么用它比喻志向？']),
      ])
      expect(html).toContain('data-follow-up=')
      // 属性值整体转义，内部不会出现裸引号
      const attr = html.match(/data-follow-up="([^"]*)"/)![1]
      expect(attr).not.toContain('"')
      const decoded = JSON.parse(
        attr
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>'),
      ) as string[]
      expect(decoded).toEqual(['鸿鹄具体指哪种鸟？', '为什么用它比喻志向？'])
    })

    it('空字符串/非字符串项被过滤，过滤后为空则不写属性', () => {
      const html = buildContentHtmlWithAnnotations('鸿鹄', [annotation('鸿鹄', '天鹅', ['', '  '])])
      expect(html).not.toContain('data-follow-up')
    })
  })

  it('超长注释不改变 HTML 结构，只影响 data-def 长度', () => {
    const long = '岳州巴陵郡，本楚之邑，后为岳阳楼。'.repeat(11)
    expect(long.length).toBeGreaterThan(150)
    const html = buildContentHtmlWithAnnotations('岳阳', [annotation('岳阳', long)])
    expect(html).toContain(`data-def="${long}"`)
    expect((html.match(/class="annotated-word"/g) || []).length).toBe(1)
  })

  it('注释词按词长降序替换，调用方给的顺序再乱也不会拆词', () => {
    const html = buildContentHtmlWithAnnotations('鸿鹄之志', [
      annotation('鹄', '天鹅'),
      annotation('鸿鹄', '比喻有远大抱负的人'),
      annotation('鸿鹄之志', '远大的抱负'),
    ])
    // 最长的那个先命中，短的不再有机会钻进已生成的 span 文本
    expect(html).toBe('<span class="annotated-word" data-def="远大的抱负">鸿鹄之志</span>')
  })

  it('content 为空 → 直接空串，不产生 span', () => {
    expect(buildContentHtmlWithAnnotations('', [annotation('鸿鹄', '天鹅')])).toBe('')
  })

  it('annotations 为 null/undefined/空数组 → 退化为纯转义输出', () => {
    const content = '燕雀安知鸿鹄之志哉'
    expect(buildContentHtmlWithAnnotations(content, null)).toBe(content)
    expect(buildContentHtmlWithAnnotations(content, undefined)).toBe(content)
    expect(buildContentHtmlWithAnnotations(content, [])).toBe(content)
  })

  it('removeSlashes 只吃半角 /（真实数据里的句读分隔符），全角／保留', () => {
    const content = '陈涉/阳夏人也，全角／不删'
    expect(buildContentHtmlWithAnnotations(content, null, { removeSlashes: true })).toBe(
      '陈涉阳夏人也，全角／不删',
    )
    expect(buildContentHtmlWithAnnotations(content, null)).toBe(content)
  })

  it('wrapParagraphs：\\n → <br>，\\n\\n → 新段落，且必须显式开启', () => {
    const content = '第一段上\n第一段下\n\n第二段'
    expect(buildContentHtmlWithAnnotations(content, null)).toBe(content)
    expect(buildContentHtmlWithAnnotations(content, null, { wrapParagraphs: true })).toBe(
      '<p>第一段上<br>第一段下</p><p>第二段</p>',
    )
  })

  it('removeSlashes + wrapParagraphs + 注释三者叠加时顺序正确（斜杠先删，再套注释，最后分段）', () => {
    const html = buildContentHtmlWithAnnotations(
      '陈涉/阳夏也\n\n燕雀安知',
      [annotation('阳夏', '今河南太康'), annotation('燕雀', '比喻见识短浅的人')],
      { removeSlashes: true, wrapParagraphs: true },
    )
    expect(html).toBe(
      '<p>陈涉<span class="annotated-word" data-def="今河南太康">阳夏</span>也</p>' +
        '<p><span class="annotated-word" data-def="比喻见识短浅的人">燕雀</span>安知</p>',
    )
  })

  it('注释词或释义里带 HTML/引号时全部转义，拼不出可执行标签', () => {
    const html = buildContentHtmlWithAnnotations('"><img src=x onerror=alert(1)>', [
      annotation('"><img', '叫"阳"，读 yáng<script>'),
    ])
    // span 只有注释词那一个，属性里也不允许出现裸引号/裸尖括号
    expect((html.match(/<span/g) || []).length).toBe(1)
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&quot;&gt;&lt;img')
    expect(html).toContain(`data-def="叫&quot;阳&quot;，读 yáng&lt;script&gt;"`)
  })

  it('同一份原文重复调用结果一致（无隐藏状态，组件里是 computed）', () => {
    const list = [annotation('鸿鹄', '天鹅')]
    expect(buildContentHtmlWithAnnotations('鸿鹄', list)).toBe(
      buildContentHtmlWithAnnotations('鸿鹄', list),
    )
  })
})

describe('adapterUtils 的基础工具函数', () => {
  it('escapeHtml：五个字符全转，& 优先所以不会产生二次转义', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;')
    expect(escapeHtml('&amp;')).toBe('&amp;amp;')
    expect(escapeHtml('普通中文')).toBe('普通中文')
  })

  it('escapeHtml：空串与非字符串入参都返回空串（注释里缺字段时不会崩）', () => {
    expect(escapeHtml('')).toBe('')
    expect(escapeHtml(null as unknown as string)).toBe('')
    expect(escapeHtml(undefined as unknown as string)).toBe('')
    expect(escapeHtml(123 as unknown as string)).toBe('')
  })

  it('escapeRegex：正则元字符被转义，可以安全拼进 RegExp', () => {
    const raw = 'a.b*c(d)+e?f^g$h|i[j]{k}\\m'
    const escaped = escapeRegex(raw)
    expect(new RegExp(escaped).test(`前缀${raw}后缀`)).toBe(true)
    // 不转义的话 . * 会把别的文本也匹配上
    expect(new RegExp(escaped).test('aXbYczd')).toBe(false)
    expect(escapeRegex('')).toBe('')
  })

  it('normalizeQuotes：弯引号/中式引号/反引号统一成直引号', () => {
    // 「」是外层双引号 ⇒ "；『』是内层 ⇒ '（与实现一致，英文排版同理）
    expect(normalizeQuotes('“甲”乙「丙」丁')).toBe('"甲"乙"丙"丁')
    expect(normalizeQuotes('『戊』')).toBe(`'戊'`)
    expect(normalizeQuotes('‘’')).toBe(`''`)
    expect(normalizeQuotes('`´')).toBe(`''`)
  })

  it('normalizeQuotes：已经是直引号/普通文本时保持不变，非法入参返回空串', () => {
    expect(normalizeQuotes('"已规范"')).toBe('"已规范"')
    expect(normalizeQuotes('鸿鹄')).toBe('鸿鹄')
    expect(normalizeQuotes('')).toBe('')
    expect(normalizeQuotes(null as unknown as string)).toBe('')
  })

  it('getSafe：键缺失或值为 undefined 才回退默认值，falsy 的既有值原样返回', () => {
    const obj = { a: 1, b: '', c: 0, d: undefined }
    expect(getSafe(obj, 'a', 9)).toBe(1)
    expect(getSafe(obj, 'b', '默认')).toBe('')
    expect(getSafe(obj, 'c', 9)).toBe(0)
    expect(getSafe(obj, 'd', 9)).toBe(9)
    expect(getSafe(obj, 'missing', 9)).toBe(9)
  })

  it('getSafe：入参不是对象时不抛错，直接给默认值', () => {
    expect(getSafe(null, 'a', 9)).toBe(9)
    expect(getSafe(undefined, 'a', 9)).toBe(9)
    expect(getSafe('字符串', 'a', 9)).toBe(9)
    expect(getSafe(42, 'a', 9)).toBe(9)
  })
})
