import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  adaptWordList,
  adaptWordListOnly,
  type RawTextBasicInfo,
  type RawWordItem,
} from '../wordListAdapter'
import { normalizeQuotes } from '@/utils/adapterUtils'

/**
 * WordList 数据适配器：把两份原始 JSON 变成组件直接可用的 contentHtml + wordList。
 *
 * 线上浮层故障要能在组件里修好，前提是这两件事成立：
 * 1. span 上带非空 data-def —— 组件只认这个属性，空就不弹浮层；
 * 2. 词表的 word 能和原文对上 —— 原文与词表都过 normalizeQuotes，弯引号才不至于匹配不上。
 * 因此除了夹具用例，下面还有一组直接读 public/data 的真实数据契约测试。
 */

const BASIC_INFO: RawTextBasicInfo = {
  text_id: 'WEN_90',
  title: '测试篇目',
  author: '司马迁',
  dynasty: '西汉',
  // / 是句读分隔符残留（真实数据里就有，线上要清掉）；“燕雀” 是弯引号，词表存的是直引号；
  // 阳夏/阳 是一对长短重叠词（阳只出现在阳夏内部）；\n\n 分段。
  original_text: '陈涉/阳夏人也，尝与人佣耕。\n\n“燕雀”安知鸿鹄之志哉。又败走阳夏。',
}

const WORD_LIST: RawWordItem[] = [
  {
    text_id: 'WEN_90',
    word: '阳夏',
    basic_meaning: '阳夏（jiǎ），今河南太康',
    follow_up_questions: [],
  },
  {
    text_id: 'WEN_90',
    word: '阳',
    basic_meaning: '短词，只应出现在长词内部',
    follow_up_questions: [],
  },
  { text_id: 'WEN_90', word: '"燕雀"', basic_meaning: '比喻见识短浅的人', follow_up_questions: [] },
  { text_id: 'WEN_90', word: '鸿鹄', basic_meaning: '比喻有远大抱负的人', follow_up_questions: [] },
  // 脏数据：缺 word 或缺释义的条目都不该进注释（否则 span 出现空 data-def，悬停没反应）
  { text_id: 'WEN_90', word: '', basic_meaning: '没有词形', follow_up_questions: [] },
  { text_id: 'WEN_90', word: '缺释义', basic_meaning: '', follow_up_questions: [] },
]

/** HTML 属性/文本反转义（与 escapeHtml 一一对应，&amp; 最后处理） */
function decodeEntities(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/** 从 contentHtml 里抽出所有注释 span 的 [属性串, 词文本] */
function spans(html: string): Array<[attrs: string, word: string]> {
  return [...html.matchAll(/<span class="annotated-word"([^>]*)>([^<]*)<\/span>/g)].map((m) => [
    m[1],
    m[2],
  ])
}

/** 取 span 的 data-def 原值（仍是转义态） */
function rawDef(attrs: string): string | null {
  return attrs.match(/ data-def="([^"]*)"/)?.[1] ?? null
}

/** 与适配器一致的前处理：规范化引号 + 去斜杠 */
function adapterText(text: string): string {
  return normalizeQuotes(text).replace(/\//g, '')
}

describe('adaptWordList 的词汇表处理', () => {
  it('过滤掉缺 word 或缺 basic_meaning 的条目，并给留下的条目加 highlighted', () => {
    const { wordList } = adaptWordList(BASIC_INFO, WORD_LIST)
    expect(wordList.map((w) => w.word)).toEqual(['"燕雀"', '阳夏', '鸿鹄', '阳'])
    expect(wordList.every((w) => w.highlighted === true)).toBe(true)
  })

  it('按词长降序排列，保证长词优先匹配（否则「阳」会先把「阳夏」拆掉）', () => {
    const { wordList } = adaptWordList(BASIC_INFO, WORD_LIST)
    const lens = wordList.map((w) => w.word.length)
    expect(lens).toEqual([...lens].sort((a, b) => b - a))
  })

  it('长词命中后短词不再单独成 span，注释结构不被二次替换破坏', () => {
    const { basicInfo } = adaptWordList(BASIC_INFO, WORD_LIST)
    expect(spans(basicInfo.contentHtml).map(([, word]) => word)).not.toContain('阳')
    expect(basicInfo.contentHtml).toContain(
      '<span class="annotated-word" data-def="阳夏（jiǎ），今河南太康">阳夏</span>',
    )
  })

  it('basicInfo 原字段原样透传，只追加 contentHtml', () => {
    const { basicInfo } = adaptWordList(BASIC_INFO, WORD_LIST)
    expect(basicInfo).toMatchObject({ ...BASIC_INFO })
    expect(typeof basicInfo.contentHtml).toBe('string')
  })
})

describe('adaptWordList 生成 contentHtml 的契约', () => {
  it('每次命中都产出一个带非空 data-def 的 span（阳夏出现两次 ⇒ 两个 span）', () => {
    const { basicInfo } = adaptWordList(BASIC_INFO, WORD_LIST)
    const list = spans(basicInfo.contentHtml)
    expect(list).toHaveLength(4)
    expect(new Set(list.map(([, word]) => word))).toEqual(
      new Set(['阳夏', '&quot;燕雀&quot;', '鸿鹄']),
    )
    for (const [attrs, word] of list) {
      const def = rawDef(attrs)
      expect(def, `${word} 没有 data-def`).not.toBeNull()
      expect(def!.length, `${word} 的 data-def 是空的`).toBeGreaterThan(0)
    }
  })

  it('原文弯引号与词表直引号能对上（normalizeQuotes 是注释命中的前提）', () => {
    const { basicInfo } = adaptWordList(BASIC_INFO, WORD_LIST)
    expect(basicInfo.contentHtml).toContain('data-def="比喻见识短浅的人">&quot;燕雀&quot;</span>')
    expect(basicInfo.contentHtml).not.toContain('“')
  })

  it('适配器固定开了 removeSlashes + wrapParagraphs', () => {
    const { basicInfo } = adaptWordList(BASIC_INFO, WORD_LIST)
    const textOnly = basicInfo.contentHtml.replace(/<[^>]*>/g, '')
    expect(textOnly).not.toContain('/')
    expect(textOnly).toContain('陈涉阳夏人也')
    // \n\n → 新段落；组件用 v-html 直出，段落标签必须在适配器里就已生成
    expect(basicInfo.contentHtml).toContain('</p><p>')
    expect(basicInfo.contentHtml.startsWith('<p>')).toBe(true)
    expect(basicInfo.contentHtml).toContain('<p><span class="annotated-word"')
  })

  it('follow_up_questions 非空才写 data-follow-up，空数组保持与线上一致的字节形态', () => {
    const list: RawWordItem[] = [
      { ...WORD_LIST[0], follow_up_questions: [] },
      { ...WORD_LIST[3], follow_up_questions: ['为什么用它比喻志向？', '  '] },
    ]
    const { basicInfo } = adaptWordList(BASIC_INFO, list)
    const html = basicInfo.contentHtml
    const attrs = spans(html).find(([, word]) => word === '鸿鹄')![0]
    const attr = attrs.match(/ data-follow-up="([^"]*)"/)?.[1]
    expect(attr).toBeDefined()
    expect(JSON.parse(decodeEntities(attr!))).toEqual(['为什么用它比喻志向？'])
    // 另一条是空数组 ⇒ 整份 HTML 只该有一个 data-follow-up
    expect((html.match(/data-follow-up=/g) || []).length).toBe(1)
  })

  it('没有注释时退化为纯转义，不产生任何 span', () => {
    const { basicInfo } = adaptWordList({ ...BASIC_INFO, original_text: 'a/b\nc' }, [])
    expect(basicInfo.contentHtml).toBe('<p>ab<br>c</p>')
  })
})

describe('adaptWordListOnly', () => {
  it('只做过滤与排序，不生成 HTML（供其他场景复用）', () => {
    const result = adaptWordListOnly(WORD_LIST)
    expect(result.map((w) => w.word)).toEqual(['"燕雀"', '阳夏', '鸿鹄', '阳'])
    expect(result.every((w) => w.highlighted === true)).toBe(true)
  })
})

// ============================================================
// 真实数据契约
//   读 public/data 里已入库的 WEN_xx.json。只断言"结构 + 转义完整性"这类与
//   篇目内容无关的不变量：素材会被管线继续补，硬编码条数一定会脆。
// ============================================================
// happy-dom 下 import.meta.url 不是 file: 协议，__dirname 在 ESM 里也不存在，
// 所以从 cwd 往上找仓库根，保证从任意子目录跑 vitest 都能定位到数据目录
function findRepoRoot(): string {
  let dir = process.cwd()
  for (let i = 0; i < 6; i++) {
    if (existsSync(`${dir}/public/data/word_list`)) return dir
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  throw new Error('没找到 public/data/word_list，测试需要从仓库内运行')
}

const DATA_DIR = `${findRepoRoot()}/public/data`
const WORD_LIST_DIR = `${DATA_DIR}/word_list`
const BASIC_INFO_DIR = `${DATA_DIR}/text_basic_info`

function realTextIds(): string[] {
  return readdirSync(WORD_LIST_DIR)
    .map((f) => f.match(/^(WEN_\d+)\.json$/)?.[1])
    .filter((id): id is string => !!id)
    .filter((id) => existsSync(`${BASIC_INFO_DIR}/${id}.json`))
    .sort()
}

function loadReal(id: string): { rawWords: RawWordItem[]; rawInfo: RawTextBasicInfo } {
  return {
    rawWords: JSON.parse(readFileSync(`${WORD_LIST_DIR}/${id}.json`, 'utf8')) as RawWordItem[],
    rawInfo: JSON.parse(readFileSync(`${BASIC_INFO_DIR}/${id}.json`, 'utf8')) as RawTextBasicInfo,
  }
}

/** 非空追问条数（过滤规则与 adapterUtils.buildFollowUpAttribute 一致） */
function followUpCount(item: RawWordItem): number {
  return (item.follow_up_questions ?? []).filter((q) => typeof q === 'string' && q.trim() !== '')
    .length
}

const REAL_IDS = realTextIds()

describe('真实数据契约（public/data/**）', () => {
  it('至少存在一篇 WEN_xx 且两份 JSON 成对，否则这套测试失去意义', () => {
    expect(REAL_IDS.length).toBeGreaterThan(0)
  })

  it.each(REAL_IDS)('%s：词表条目齐字段，注释 span 完整且 data-def 非空', (id) => {
    const { rawWords, rawInfo } = loadReal(id)

    // 缺字段的条目会被适配器丢掉；素材真写坏了就该在这里被拦下
    for (const item of rawWords) {
      expect(item.word, `${id} 存在空 word`).toBeTruthy()
      expect(item.basic_meaning, `${id}/${item.word} 存在空 basic_meaning`).toBeTruthy()
    }

    const html = adaptWordList(rawInfo, rawWords).basicInfo.contentHtml
    const list = spans(html)
    expect(list.length, `${id} 一个注释都没生成`).toBeGreaterThan(0)

    const meanings = new Set(rawWords.map((w) => w.basic_meaning))
    const knownWords = new Set(rawWords.map((w) => normalizeQuotes(w.word)))

    for (const [attrs, wordText] of list) {
      const word = decodeEntities(wordText)
      const def = rawDef(attrs)
      expect(def, `${id}/${word} 有 span 缺 data-def`).not.toBeNull()
      expect(def!.length, `${id}/${word} 的注释是空的`).toBeGreaterThan(0)
      // 属性值里没有裸引号/裸尖括号 ⇒ 转义生效，注释再长也不会截断属性
      expect(def).not.toContain('"')
      expect(def).not.toContain('<')
      expect(knownWords.has(word), `${id} span 文本「${word}」不在词表里`).toBe(true)
      // data-def 解码后必须逐字等于某条原始释义（长注释不允许被改）
      expect(meanings.has(decodeEntities(def!)), `${id}/${word} 注释解码后与释义不一致`).toBe(true)
    }

    // 有追问才写属性：现在 4 篇全是空数组 ⇒ 一个都不该出现；哪天填上，DOM 自动跟上
    const followUpInData = rawWords.reduce((n, w) => n + (followUpCount(w) > 0 ? 1 : 0), 0)
    expect((html.match(/data-follow-up=/g) || []).length).toBe(followUpInData)
  })

  it.each(REAL_IDS)('%s：原文里独立出现的词都会成为可悬停的注释，且不残留占位符', (id) => {
    const { rawWords, rawInfo } = loadReal(id)
    const html = adaptWordList(rawInfo, rawWords).basicInfo.contentHtml
    const rendered = new Set(spans(html).map(([, word]) => decodeEntities(word)))

    expect(html).not.toContain('__ANNOTATION_')
    // 转义后的 span 不允许以文本形式漏出（v-html 里出现就是双重转义）
    expect(html).not.toContain('&lt;span')

    const normalized = rawWords.map((w) => normalizeQuotes(w.word))
    const text = adapterText(rawInfo.original_text)
    const standalone = normalized.filter((word) => {
      if (!word || !text.includes(word)) return false
      // 被更长的注释词整段包住的短词，按"长词优先"规则不再单独成 span
      return !normalized.some(
        (other) => other !== word && other.length > word.length && other.includes(word),
      )
    })
    expect(standalone.length, `${id} 没有任何可校验的独立注释词`).toBeGreaterThan(0)
    for (const word of standalone) {
      expect(rendered.has(word), `${id}「${word}」在原文里却没有注释 span`).toBe(true)
    }
  })

  it.each(REAL_IDS)('%s：已渲染的最长注释整条落在一个 data-def 里、解码后与释义逐字一致', (id) => {
    const { rawWords, rawInfo } = loadReal(id)
    const html = adaptWordList(rawInfo, rawWords).basicInfo.contentHtml
    const rendered = spans(html)
      .map(([attrs]) => rawDef(attrs) ?? '')
      .filter((def) => def.length > 0)
    expect(rendered.length, `${id} 没有可校验的 data-def`).toBeGreaterThan(0)

    const longest = rendered.reduce((a, b) => (b.length > a.length ? b : a), rendered[0])
    const decoded = decodeEntities(longest)
    expect(longest).not.toContain('"')
    expect(
      rawWords.some((w) => w.basic_meaning === decoded),
      `${id} 最长注释解码后找不到对应释义（可能被截断）`,
    ).toBe(true)
    // 词形没出现在原文的条目（如 WEN_03 的「岳阳楼记」那条 174 字）本就不该有 span，
    // 所以这里校验的是"渲染出来的最长"，不是"数据里的最长"。
  })

  it('语料里确有长注释：限宽换行 + 翻转定位不是纸上谈兵', () => {
    let maxRendered = 0
    for (const id of REAL_IDS) {
      const { rawWords, rawInfo } = loadReal(id)
      const html = adaptWordList(rawInfo, rawWords).basicInfo.contentHtml
      for (const [attrs] of spans(html)) {
        maxRendered = Math.max(maxRendered, (rawDef(attrs) ?? '').length)
      }
    }
    // 短注释（几字）根本不会触发 max-width/clamp；≥60 字才需要限宽换行
    expect(maxRendered).toBeGreaterThanOrEqual(60)
  })
})
