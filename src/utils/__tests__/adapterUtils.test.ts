import { describe, it, expect } from 'vitest'
import { buildContentHtmlWithAnnotations, escapeHtml } from '../adapterUtils'

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

  it('长注释（WEN_03 那条 174 字）不改变 HTML 结构，只影响 data-def 长度', () => {
    const long = '岳州巴陵郡，本楚之邑，后为岳阳楼。'.repeat(11)
    expect(long.length).toBeGreaterThan(150)
    const html = buildContentHtmlWithAnnotations('岳阳', [annotation('岳阳', long)])
    expect(html).toContain(`data-def="${long}"`)
    expect((html.match(/class="annotated-word"/g) || []).length).toBe(1)
  })
})
