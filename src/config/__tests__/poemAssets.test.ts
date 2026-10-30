/**
 * 编号 ↔ 篇目对照 + 放行判据 单元测试
 *
 * 背景：poemMap 原先 37 条里有 33 条是按教材顺序**推测**的，实测与美术/内容侧
 * 在 OSS 上用的编号从 05 起整体错位（旧表把《湖心亭看雪》排在 23，确认表里它是 10）。
 * 首页选篇按编号取素材、按 poemMap 显示标题，推测值一旦上线就是张冠李戴。
 *
 * 所以这里锁三件事：
 * 1. poemMap 只收录已确认的号，且和 NUMBERING_CONFIRMED_POEM_IDS 不漂移；
 * 2. 未确认的号不能放行（isPoemReady = false），即使 OSS 上素材齐全；
 * 3. 已确认篇目对应到正确的标题（防旧推测表回归）。
 *
 * 运行方式：npm run test（vitest 的 include 只吃 src 目录下的 .test.ts）
 */

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  ALL_POEM_IDS,
  CULTURE_CARD_DATA_POEM_IDS,
  LEVEL2_PAGE_DATA_POEM_IDS,
  LEVEL3_PAGE_DATA_POEM_IDS,
  NUMBERING_CONFIRMED_POEM_IDS,
  ORPHAN_CARD_VIDEO_POEM_IDS,
  TEXT_DATA_POEM_IDS,
  canPlayRuleVideo,
  hasCultureCardData,
  hasLevel2PageData,
  hasLevel3PageData,
  hasRuleVideo,
  hasTextData,
  isNumberingConfirmed,
  isPoemReady,
} from '@/config/poemAssets'
import { getAllPoemSlots, getAllPoems, getPoemTitle, poemMap } from '@/utils/wenUtils'

describe('poemAssets 编号确认表', () => {
  it('已确认 25 个号：01–19 连续 + 22–27', () => {
    expect(NUMBERING_CONFIRMED_POEM_IDS).toHaveLength(25)
    expect([...NUMBERING_CONFIRMED_POEM_IDS].sort((a, b) => Number(a) - Number(b))).toEqual([
      '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
      '11', '12', '13', '14', '15', '16', '17', '18', '19', '22',
      '23', '24', '25', '26', '27',
    ])
  })

  it('poemMap 的 key 与已确认号位完全一致（两张表不许漂移）', () => {
    expect(Object.keys(poemMap).sort((a, b) => Number(a) - Number(b))).toEqual(
      NUMBERING_CONFIRMED_POEM_IDS
    )
  })

  it('号位总表覆盖 1–37', () => {
    expect(ALL_POEM_IDS).toHaveLength(37)
    expect(ALL_POEM_IDS[0]).toBe('1')
    expect(ALL_POEM_IDS[36]).toBe('37')
  })

  it('isNumberingConfirmed 认得三种 ID 口径', () => {
    expect(isNumberingConfirmed('8')).toBe(true)
    expect(isNumberingConfirmed('08')).toBe(true)
    expect(isNumberingConfirmed('WEN_08')).toBe(true)
    expect(isNumberingConfirmed('20')).toBe(false)
    expect(isNumberingConfirmed(undefined)).toBe(false)
  })
})

describe('isPoemReady 放行判据', () => {
  it('文本数据表当前只有 01–04（2026-10-30 线上逐号探测）', () => {
    expect(TEXT_DATA_POEM_IDS).toEqual(['1', '2', '3', '4'])
    expect(hasTextData('1')).toBe(true)
    expect(hasTextData('WEN_04')).toBe(true)
    expect(hasTextData('05')).toBe(false)
    expect(hasTextData(undefined)).toBe(false)
  })

  it('第二、三关页面数据已覆盖全部 25 个已确认号位', () => {
    expect([...LEVEL2_PAGE_DATA_POEM_IDS].sort((a, b) => Number(a) - Number(b))).toEqual(
      NUMBERING_CONFIRMED_POEM_IDS,
    )
    expect([...LEVEL3_PAGE_DATA_POEM_IDS].sort((a, b) => Number(a) - Number(b))).toEqual(
      NUMBERING_CONFIRMED_POEM_IDS,
    )
    expect(hasLevel2PageData('WEN_05')).toBe(true)
    expect(hasLevel3PageData('WEN_05')).toBe(true)
    expect(hasLevel2PageData('WEN_20')).toBe(false)
    expect(hasLevel3PageData(undefined)).toBe(false)
  })

  it('页面数据清单里的每个号位都有可解析的 JSON，且 pageId 对得上', () => {
    for (const [dir, ids] of [
      ['pages_level2_dialog_quiz', LEVEL2_PAGE_DATA_POEM_IDS],
      ['pages_level3_adaptive_quiz', LEVEL3_PAGE_DATA_POEM_IDS],
    ] as const) {
      for (const id of ids) {
        const file = resolve(process.cwd(), 'public/data', dir, `WEN_${id.padStart(2, '0')}.json`)
        expect(existsSync(file), `${dir}/WEN_${id} 缺失`).toBe(true)
        const page = JSON.parse(readFileSync(file, 'utf8'))
        expect(page.pageId).toBe(`WEN_${id.padStart(2, '0')}`)
      }
    }
  })

  it('编号确认 + rule 视频齐备即放行：1–4 可走完整流程', () => {
    for (const id of ['1', '2', '3', '4']) {
      expect(hasRuleVideo(id)).toBe(true)
      expect(isNumberingConfirmed(id)).toBe(true)
      expect(hasTextData(id)).toBe(true)
      expect(isPoemReady(id)).toBe(true)
    }
  })

  it('文本数据没交付不挡入口（用户 2026-10-30 口径：制作中只拦未确认编号）', () => {
    for (const id of ['5', '6', '10', '18', '22', '27']) {
      expect(hasRuleVideo(id)).toBe(true)
      expect(isNumberingConfirmed(id)).toBe(true)
      expect(hasTextData(id)).toBe(false)
      // 首页照常可点，进入步骤页/详情页后由 hasTextData 换成「制作中」占位
      expect(isPoemReady(id)).toBe(true)
      expect(canPlayRuleVideo(id)).toBe(true)
    }
  })

  it('编号未确认即素材齐全也不放行（20、21、28–37 里 OSS 有 rule 视频）', () => {
    expect(hasRuleVideo('20')).toBe(true)
    expect(isNumberingConfirmed('20')).toBe(false)
    expect(isPoemReady('20')).toBe(false)
    expect(canPlayRuleVideo('20')).toBe(false)
    expect(isPoemReady('28')).toBe(false)
  })

  it('rule 视频缺的号不放行（13/16/17 编号已确认但没视频）', () => {
    for (const id of ['13', '16', '17']) {
      expect(isNumberingConfirmed(id)).toBe(true)
      expect(hasRuleVideo(id)).toBe(false)
      expect(isPoemReady(id)).toBe(false)
      expect(canPlayRuleVideo(id)).toBe(false)
    }
  })
})

describe('编号 ↔ 篇目映射', () => {
  it('已确认的号给出正确篇名', () => {
    expect(getPoemTitle('WEN_05')).toBe('唐雎不辱使命')
    expect(getPoemTitle('WEN_06')).toBe('醉翁亭记')
    expect(getPoemTitle('WEN_08')).toBe('咏雪')
    expect(getPoemTitle('WEN_10')).toBe('湖心亭看雪')
    expect(getPoemTitle('WEN_13')).toBe('曹刿论战')
    expect(getPoemTitle('WEN_14')).toBe('《论语》十二章')
    expect(getPoemTitle('WEN_22')).toBe('狼')
    expect(getPoemTitle('WEN_24')).toBe('送东阳马生序')
    expect(getPoemTitle('WEN_25')).toBe('出师表')
    expect(getPoemTitle('WEN_26')).toBe('三峡')
    expect(getPoemTitle('WEN_27')).toBe('答谢中书书')
  })

  it('旧的按教材顺序推测的表已整体废除（防止回归）', () => {
    // 旧 poemMap：'8' 爱莲说 / '10' 虽有嘉肴 / '22' 醉翁亭记 / '23' 湖心亭看雪 /
    // '24' 孙权劝学 / '25' 卖油翁 / '26' 周亚夫军细柳 / '27' 唐雎不辱使命
    expect(getPoemTitle('8')).not.toBe('爱莲说')
    expect(getPoemTitle('10')).not.toBe('虽有嘉肴')
    expect(getPoemTitle('22')).not.toBe('醉翁亭记')
    expect(getPoemTitle('23')).not.toBe('湖心亭看雪')
    expect(getPoemTitle('37')).not.toBe('活板')
    expect(getPoemTitle('24')).not.toBe('孙权劝学')
    expect(getPoemTitle('25')).not.toBe('卖油翁')
    expect(getPoemTitle('26')).not.toBe('周亚夫军细柳')
    expect(getPoemTitle('27')).not.toBe('唐雎不辱使命')
  })

  it('23 号位＝《活板》（用户 2026-10-29 确认，非按教材顺序推测）', () => {
    expect(isNumberingConfirmed('23')).toBe(true)
    expect(getPoemTitle('WEN_23')).toBe('活板')
    // 该号 4 段 rule 视频线上都在（实测 /video/WEN_23_rule_bg|1|2|3.mp4 全 200），
    // 所以首页可点、规则页可播；文本数据 JSON 还没交付，进页后显示「制作中」占位。
    expect(canPlayRuleVideo('23')).toBe(true)
    expect(hasTextData('23')).toBe(false)
    expect(isPoemReady('23')).toBe(true)
  })

  it('未确认的号不配任何篇名', () => {
    for (const id of ['20', '21', '33', '37']) {
      expect(getPoemTitle(id)).toBe('未知篇目')
      expect(poemMap[id]).toBeUndefined()
    }
  })

  it('WEN_04 沿用 UI 简写', () => {
    expect(getPoemTitle('4')).toBe('庄子与惠子')
  })
})

describe('选篇列表与号位列表', () => {
  it('getAllPoems 只返回已确认的 25 篇，按编号升序', () => {
    const poems = getAllPoems()
    expect(poems).toHaveLength(25)
    expect(poems.map((p) => p.poemId)).toEqual([...NUMBERING_CONFIRMED_POEM_IDS].sort((a, b) => Number(a) - Number(b)))
    expect(poems[0].wenId).toBe('WEN_01')
    expect(poems.every((p) => isNumberingConfirmed(p.poemId))).toBe(true)
  })

  it('getAllPoems 的 ready 与 isPoemReady 一致', () => {
    for (const p of getAllPoems()) {
      expect(p.ready).toBe(isPoemReady(p.poemId))
    }
    // 学生侧可见入口 = 编号已确认 ∩ rule 视频齐备。
    // 文本数据缺失不挡入口（05–27 第一关/详情页显示「制作中」，第二、三关按页面数据独立放行）；
    // 13/16/17 因 rule 视频未交付被挡。补齐视频后要同步更新这条名单。
    expect(getAllPoems().filter((p) => p.ready).map((p) => p.wenId)).toEqual([
      'WEN_01', 'WEN_02', 'WEN_03', 'WEN_04', 'WEN_05', 'WEN_06', 'WEN_07', 'WEN_08',
      'WEN_09', 'WEN_10', 'WEN_11', 'WEN_12', 'WEN_14', 'WEN_15', 'WEN_18', 'WEN_19',
      'WEN_22', 'WEN_23', 'WEN_24', 'WEN_25', 'WEN_26', 'WEN_27',
    ])
  })

  it('getAllPoemSlots 覆盖 37 个号位，未确认的显示占位标题', () => {
    const slots = getAllPoemSlots()
    expect(slots).toHaveLength(37)
    expect(slots[19]).toEqual({
      poemId: '20',
      wenId: 'WEN_20',
      title: '编号待确认',
      ready: false,
    })
    expect(slots[0].title).toBe('陈涉世家')
    // 素材上传工具要能选到未交付/未确认的号：37 个号位里 22 个首页可点
    expect(slots.filter((s) => !s.ready).length).toBe(37 - 22)
  })
})

/**
 * 文化卡片挂载契约（2026-10-28 补）。
 * 卡片视频全部平铺在 OSS 的 /video/ 下，文件名 `WEN_nn_card_<标识>.mp4` 里的 nn 就是号位，
 * 所以「挂载」本该是机械动作。历史上出过两类事故：一是素材传了没 JSON 引用（孤儿），
 * 二是 JSON 之间互相拷来拷去把引用拷没了（WEN_04 的 yuyan 就是被 backend 整份覆盖冲掉的）。
 * 这里锁六条机械约束，让这两类回归在 CI 里就红。
 * ⚠ 前提是这些测试文件真的入库：本文件所在的 src/config 下 __tests__ 目录目前仍是未跟踪状态
 *   （git ls-files 查不到），没提交就等于 CI 一条都没跑。另外 tsconfig.app.json 把
 *   src 下所有 __tests__ 目录排除了，这个文件不在 vue-tsc 的任何一个 project 里，只有 vitest 会执行它。
 */
describe('culture_cards 数据 JSON 的挂载契约', () => {
  interface RawCard {
    text_id?: string
    card_id?: number
    card_name?: string
    image_file?: string
    poster_file?: string
    knowledge_text?: string
  }
  interface RawData {
    text_id?: string
    cards?: RawCard[]
  }

  /**
   * 读 public/data/culture_cards/ 下待发出的 JSON。
   * 用 process.cwd() 而不是 import.meta.url：浏览器态 environment（happy-dom/jsdom）下
   * import.meta.url 不保证是 file: scheme，fileURLToPath 会在 describe 作用域直接抛
   * 「The URL must be of scheme file」，把整个文件的用例一起带崩。
   * 读取动作放在每个 it 里面，目录找不到也只炸这一组，不连累同文件的编号用例。
   */
  function loadCards(): Array<{ stem: string; data: RawData }> {
    const candidates = [
      resolve(process.cwd(), 'public/data/culture_cards'),
      resolve(process.cwd(), '..', 'public/data/culture_cards'),
    ]
    const dir = candidates.find((c) => existsSync(c))
    if (!dir) {
      throw new Error(`找不到 public/data/culture_cards（vitest cwd=${process.cwd()}）`)
    }
    // 只收 .json，避开目录里可能存在的临时/备份文件
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.json'))
      .map((e) => {
        const parsed = JSON.parse(readFileSync(resolve(dir, e.name), 'utf8')) as RawData
        return { stem: e.name.replace(/\.json$/, ''), data: parsed }
      })
  }

  it('目录非空，且文件名、根 text_id、卡片 text_id 三者同号', () => {
    const entries = loadCards()
    expect(entries.length).toBeGreaterThan(0)
    for (const { stem, data } of entries) {
      expect(stem).toMatch(/^WEN_\d{2}$/)
      expect(data.text_id).toBe(stem)
      for (const card of data.cards ?? []) {
        if (card.text_id !== undefined) expect(card.text_id).toBe(stem)
      }
    }
  })

  it('image_file 只能是「文字」或本号位名下的素材（防跨号挂载）', () => {
    for (const { stem, data } of loadCards()) {
      for (const card of data.cards ?? []) {
        const file = card.image_file
        if (!file || file === '文字') continue
        const mounted = file.startsWith(`${stem}_card_`)
        expect(mounted, `${stem}: image_file=${file} 不属于本号位`).toBe(true)
      }
    }
  })

  it('媒体扩展名只能是图片/视频（CultureCards.cardMediaType 只认这些）', () => {
    for (const { stem, data } of loadCards()) {
      for (const card of data.cards ?? []) {
        for (const file of [card.image_file, card.poster_file]) {
          if (!file || file === '文字') continue
          expect(/\.(png|jpe?g|gif|webp|mp4|webm|ogg)$/i.test(file), `${stem}: ${file}`).toBe(true)
        }
      }
    }
  })

  it('媒体文件名不许有双扩展名（.mp4.mp4 那次 404 的根因）', () => {
    // 素材走 OSS 控制台拖拽上传，object 名等于本地文件名；
    // 只要本地留下 `x.mp4.mp4` 这种名字，JSON 里写哪个都必然有另一个 404。
    // 上面那条扩展名白名单只看结尾，拦不住这种情况，所以单独加一条反向检查。
    const doubleExt = /\.(png|jpe?g|gif|webp|mp4|webm|ogg)\.\w+$/i
    for (const { stem, data } of loadCards()) {
      for (const card of data.cards ?? []) {
        for (const file of [card.image_file, card.poster_file]) {
          if (!file || file === '文字') continue
          expect(file, `${stem}: ${file} 是双扩展名`).not.toMatch(doubleExt)
        }
      }
    }
  })

  it('学生可见字段里没有占位文本（knowledge_text 允许空串——组件不渲染空字幕）', () => {
    for (const { stem, data } of loadCards()) {
      for (const card of data.cards ?? []) {
        for (const [field, value] of [
          ['card_name', card.card_name],
          ['knowledge_text', card.knowledge_text],
        ] as const) {
          if (value === undefined || value === '') continue
          expect(value, `${stem}.${field}`).not.toMatch(/待填|待补|TODO|占位|placeholder/i)
        }
      }
    }
  })

  it('有卡片的号位都必须在 ALL_POEM_IDS 的 37 个号位内', () => {
    for (const { stem } of loadCards()) {
      expect(ALL_POEM_IDS).toContain(stem.replace(/^WEN_0?/, ''))
    }
  })

  /**
   * 常量 ↔ 目录 双向锁。
   * `CULTURE_CARD_DATA_POEM_IDS` 是一句「构建里有这份 JSON」的**仓库口径**声明，此前只靠人按记忆维护，
   * 出过两个方向的漂移：OSS 有卡片视频但仓库没 JSON（23 号位挂之前就是这样），以及表里写了号但目录没这份文件。
   * 这里双向比一次，之后加卡片 JSON 忘了更新表、或更新了表忘了写文件，都会红。
   */
  it('CULTURE_CARD_DATA_POEM_IDS 与 public/data/culture_cards/ 目录一一对应', () => {
    const stems = loadCards().map(({ stem }) => stem)
    expect(stems.length, 'culture_cards 目录为空').toBeGreaterThan(0)
    for (const id of CULTURE_CARD_DATA_POEM_IDS) {
      expect(
        stems,
        `常量说 ${id} 号有数据 JSON，但 public/data/culture_cards/ 里没有 WEN_${id.padStart(2, '0')}.json`,
      ).toContain(`WEN_${id.padStart(2, '0')}`)
    }
    for (const stem of stems) {
      expect(CULTURE_CARD_DATA_POEM_IDS, `${stem} 在目录里但常量表没登记`).toContain(
        stem.replace(/^WEN_0?/, ''),
      )
    }
  })

  it('23 号位（《活板》）已挂载：有数据 JSON，且不再是孤儿', () => {
    expect(hasCultureCardData('23')).toBe(true)
    expect(hasCultureCardData('WEN_23')).toBe(true)
    expect(ORPHAN_CARD_VIDEO_POEM_IDS).not.toContain('23')
    const card = loadCards().find(({ stem }) => stem === 'WEN_23')
    expect(card, 'public/data/culture_cards/WEN_23.json 缺失').toBeDefined()
    // 23 号位在 OSS 上只有这两个卡片视频（2026-10-29 拉线上列表复核过），没有第三张
    expect(card?.data.cards?.map((c) => c.image_file)).toEqual([
      'WEN_23_card_paper.mp4',
      'WEN_23_card_printing.mp4',
    ])
  })

  it('已挂载表与孤儿表不许有交集（同一个号不能既挂了又没人引用）', () => {
    for (const id of ORPHAN_CARD_VIDEO_POEM_IDS) {
      expect(CULTURE_CARD_DATA_POEM_IDS, `${id} 号同时出现在两张表里`).not.toContain(id)
    }
  })
})
