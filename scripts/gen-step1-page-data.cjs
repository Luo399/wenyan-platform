#!/usr/bin/env node
/**
 * 从 Figma 文字资源生成第一关（StepOne）页面层 JSON
 *
 * 背景
 * ----
 * Figma 插件上传的是**原始文字资源**：`data/texts/文字资源_<篇名>.json`，
 * 结构是一张扁平 key/value 表（title_/author_/book_/content_/annotation_/dialog_…）。
 * 第一关页面（WordList + MultiRoleReading）不吃这张表，它吃三份页面层 JSON：
 *
 *   public/data/text_basic_info/WEN_nn.json   标题 / 作者 / 原文
 *   public/data/word_list/WEN_nn.json         字词注释（word + basic_meaning）
 *   public/data/multi_role_reading/WEN_nn.json 朗读音频 + 段落
 *
 * 本脚本把「原始文字资源」按上述契约转成页面层 JSON，并同步一份到 backend/data。
 *
 * 用法
 * ----
 *   node scripts/probe-multi-role-audio.cjs            # 生成 audio-index.json（可选）
 *   node scripts/gen-step1-page-data.cjs \
 *     --input <文字资源 JSON 所在目录> \
 *     --audio-index <audio-index.json>                  # 可选；没有就不生成朗读 JSON
 *
 *   --force        覆盖已存在的页面层 JSON（默认跳过）
 *   --include-delivered 连 01–04 一起重新生成（默认跳过：这四篇是人工校对稿，
 *                  尤其 03/04 的释义与原始文字资源并不逐字一致，不能被脚本覆盖）
 *   --out <dir>    页面层输出目录，默认 public/data
 *   --mirror <dir> 镜像目录，默认 backend/data；传空串可关闭
 *
 * 为什么只认「确认表」里的编号
 * ----------------------------
 * Figma 文字资源里 20/21/24–27 的内嵌编号与内容组确认表冲突
 * （例如 Figma 的 WEN_24 是《孟子》三章，确认表 24 = 《送东阳马生序》）。
 * 这些文件一律跳过：宁可不放行，也不能让学生在 24 号位看到另一篇课文。
 * 详见 docs/素材对应核查.md。
 *
 * 为什么朗读 JSON 只有一个段落
 * ----------------------------
 * 原始文字资源没有角色名和时间轴，无法还原 01–04 那种逐句多角色朗读。
 * 为了不伪造时间轴（错位的高亮比不高亮更糟），这里生成一个「整篇朗读」段落：
 * 音频文件用 OSS 上已有的 WEN_nn_multi_role.mp3，时间范围取音频真实时长。
 * 13/16/17 音频未交付、14 的音频文件与 05 逐字节相同（内容错配），
 * 这四篇不生成朗读 JSON，前端按 hasMultiRoleAudio 显示「音频制作中」。
 */

const fs = require('fs')
const path = require('path')

const REPO_ROOT = path.join(__dirname, '..')

/** 内容组确认的编号 ↔ 篇目（与 src/utils/wenUtils.ts 的 poemMap 保持一致） */
const CONFIRMED_TITLES = {
  1: '陈涉世家',
  2: '马说',
  3: '岳阳楼记',
  4: '庄子与惠子游于濠梁之上',
  5: '唐雎不辱使命',
  6: '醉翁亭记',
  7: '周亚夫军细柳',
  8: '咏雪',
  9: '卖油翁',
  10: '湖心亭看雪',
  11: '孙权劝学',
  12: '邹忌讽齐王纳谏',
  13: '曹刿论战',
  14: '《论语》十二章',
  15: '诫子书',
  16: '穿井得一人',
  17: '杞人忧天',
  18: '愚公移山',
  19: '陈太丘与友期行',
  22: '狼',
  23: '活板',
  24: '送东阳马生序',
  25: '出师表',
  26: '三峡',
  27: '答谢中书书',
}

/** 已有页面层 JSON、且经过人工校对的编号：默认不覆盖 */
const ALREADY_DELIVERED = ['1', '2', '3', '4']

/** 音频不可用的编号及原因（不影响字词/原文，只是朗读区块降级） */
const AUDIO_UNAVAILABLE = {
  13: 'WEN_13_multi_role.mp3 线上 404（未交付）',
  14: 'WEN_14_multi_role.mp3 与 WEN_05 逐字节相同（内容错配）',
  16: 'WEN_16_multi_role.mp3 线上 404（未交付）',
  17: 'WEN_17_multi_role.mp3 线上 404（未交付）',
}

/**
 * 原始文字资源里的已知错别字：annotation 词条 → 正文实际词形。
 * 只改词形、不动释义，且必须能解释清楚：
 * - 苦蔽成丘 → 苫蔽成丘（《狼》原文「苫蔽成丘」，释义「覆盖、遮盖」也对得上苫）
 * - 耽耽相向 → 眈眈相向（释义里的注音 dān 对应「眈」，正文用的是目字旁）
 * - 上劳军 → 上自劳军（释义「皇帝亲自去慰劳军队」里的「亲自」对应正文的「自」）
 * 这类修正只处理"改完能在正文里命中"的实词；篇名/出处类词条不改，
 * 交给适配器测试的 KNOWN_UNANNOTATABLE 登记。
 */
const WORD_CORRECTIONS = {
  苦蔽成丘: '苫蔽成丘',
  耽耽相向: '眈眈相向',
  上劳军: '上自劳军',
}

/** 释义里的同源错字（改词形之外还要单独替换的片段） */
const MEANING_CORRECTIONS = {
  '苦（shàn）蔽': '苫（shàn）蔽',
}

/** 词形修正后，把释义里出现的旧词形一并改掉，避免悬停时看到错字 */
function fixMeaning(meaning, oldWord, newWord) {
  let out = oldWord === newWord ? meaning : meaning.split(oldWord).join(newWord)
  for (const [from, to] of Object.entries(MEANING_CORRECTIONS)) {
    out = out.split(from).join(to)
  }
  return out
}

/**
 * 源文件里混入的、不属于本篇的注释条目：编号 → [词条, 原因]。
 * 04.json（《狼》）的 annotation_26 是《邹忌讽齐王纳谏》的「战胜于朝廷」，
 * 明显是复制画板时带过来的；正文里没有这个词，留着只会让词表说谎。
 */
const ANNOTATION_EXCLUSIONS = {
  22: [['战胜于朝廷', '源文件混入了《邹忌讽齐王纳谏》的注释，正文无此词']],
}

function parseArgs(argv) {
  const args = { input: '', audioIndex: '', out: path.join(REPO_ROOT, 'public/data'), mirror: path.join(REPO_ROOT, 'backend/data'), force: false, includeDelivered: false }
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    if (flag === '--force') args.force = true
    else if (flag === '--include-delivered') args.includeDelivered = true
    else if (flag === '--input') args.input = argv[++i] || ''
    else if (flag === '--audio-index') args.audioIndex = argv[++i] || ''
    else if (flag === '--out') args.out = argv[++i] || ''
    else if (flag === '--mirror') args.mirror = argv[++i] || ''
    else if (flag === '--help' || flag === '-h') {
      console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0])
      process.exit(0)
    } else {
      throw new Error(`未知参数：${flag}`)
    }
  }
  if (!args.input) throw new Error('缺少 --input <文字资源 JSON 目录>')
  return args
}

function normalizeTitle(value) {
  return String(value ?? '')
    .replace(/\s+/g, '')
    .replace(/^《/, '')
    .replace(/》$/, '')
    .trim()
}

function normalizeContent(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .trim()
}

function uniqueValues(values) {
  return [...new Set(values.map((v) => String(v).trim()).filter(Boolean))]
}

function pickOne(values, label) {
  const unique = uniqueValues(values)
  if (unique.length > 1) {
    throw new Error(`${label} 存在多个不同取值：${unique.join(' | ')}`)
  }
  return unique[0] || ''
}

/** 解析 "12.词：释义"；兼容源数据里把冒号写成逗号、编号后多打一个点的条目 */
function parseAnnotation(raw, index) {
  const text = String(raw ?? '').trim()
  const colon = text.match(/^(\d+)\s*[.．、]\s*(.+?)[：:]([\s\S]*)$/)
  if (colon) return { word: cleanWord(colon[2]), meaning: colon[3].trim() }

  // 兜底：源数据 "31.好，好，读音hào。喜爱，爱好。"（《论语》十二章）
  // 首个逗号前是词条，后面是释义；若释义又以同一个词开头，去掉重复。
  const comma = text.match(/^(\d+)\s*[.．、]\s*([^，,]{1,12})[，,]([\s\S]*)$/)
  if (comma) {
    const word = cleanWord(comma[2])
    let meaning = comma[3].trim()
    const duplicate = new RegExp(`^${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[，,]\\s*`)
    meaning = meaning.replace(duplicate, '')
    return { word, meaning }
  }

  throw new Error(`第 ${index + 1} 条注释无法解析：${text.slice(0, 60)}`)
}

/** 清掉编号后多打的标点（源数据 "10..孰" → "孰"） */
function cleanWord(word) {
  return String(word)
    .replace(/^[.．、]+/, '')
    .trim()
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds))
  const mm = String(Math.floor(total / 60)).padStart(2, '0')
  const ss = String(total % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

function buildSpokenText(content) {
  // 朗读段落不显示断句斜杠；段落之间写成一句话，避免卡片里出现硬换行
  return content
    .replace(/\//g, '')
    .replace(/[ \t]*\n[ \t]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildFromRaw(raw, audioIndex) {
  const entries = Object.entries(raw)

  const titleEntry = entries.find(([key]) => /^title_WEN_\d+(?:_|$)/.test(key))
  if (!titleEntry) throw new Error('找不到 title_WEN_xx 字段')

  const matchedId = titleEntry[0].match(/^title_WEN_(\d+)/)
  const poemId = String(Number(matchedId[1]))
  const wenId = `WEN_${matchedId[1].padStart(2, '0')}`
  const expectedTitle = CONFIRMED_TITLES[poemId]
  const title = pickOne(
    entries.filter(([key]) => new RegExp(`^title_WEN_${matchedId[1]}(?:_|$)`).test(key)).map(([, v]) => v),
    `${wenId} title`,
  )

  if (!expectedTitle) {
    return { skip: `${wenId} 不在已确认编号表内（${title}），不生成` }
  }
  if (normalizeTitle(title) !== normalizeTitle(expectedTitle)) {
    return {
      skip: `${wenId} 内嵌篇名是《${title}》，确认表是《${expectedTitle}》，编号冲突不生成`,
    }
  }

  const contentEntries = entries.filter(([key]) => /^content_WEN_\d+_text(?:_\d+)?$/.test(key))
  if (!contentEntries.length) throw new Error(`${wenId} 找不到 content_WEN_xx_text 字段`)
  const contentValues = uniqueValues(contentEntries.map(([, v]) => normalizeContent(v)))
  if (contentValues.length > 1) {
    throw new Error(`${wenId} 多个 content 字段内容不一致，需要人工确认`)
  }
  const originalText = contentValues[0]
  if (contentEntries.some(([key]) => !key.includes(matchedId[1]))) {
    console.warn(`  ! ${wenId} 有 content 字段的编号与 title 不一致（${contentEntries.map(([k]) => k).join(', ')}），以字段值为准`)
  }

  const author = pickOne(
    entries.filter(([key]) => key.startsWith('author_')).map(([, v]) => v),
    `${wenId} author`,
  )
  let book = pickOne(
    entries.filter(([key]) => key.startsWith('book_')).map(([, v]) => v),
    `${wenId} book`,
  )
  let finalAuthor = author
  if (!book && /^《.*》$/.test(author)) {
    book = author
    finalAuthor = ''
  }

  const annotations = entries
    .filter(([key]) => /^annotation_\d+$/.test(key))
    .sort((a, b) => Number(a[0].replace(/\D/g, '')) - Number(b[0].replace(/\D/g, '')))
    .map(([, value], index) => parseAnnotation(value, index))
    .filter((item) => {
      const exclusion = (ANNOTATION_EXCLUSIONS[poemId] || []).find(([word]) => word === item.word)
      if (exclusion) console.warn(`  ! ${wenId} 丢弃源数据混入的注释「${item.word}」：${exclusion[1]}`)
      return !exclusion
    })

  if (!annotations.length) throw new Error(`${wenId} 没有任何 annotation 字段`)
  for (const item of annotations) {
    if (!item.word || !item.meaning) {
      throw new Error(`${wenId} 存在空词条或空释义：${JSON.stringify(item)}`)
    }
  }

  const basicInfo = {
    text_id: wenId,
    title,
    author: finalAuthor,
    dynasty: '',
    // 出处（《战国策》这类）不是作者，单独存 book；前端按非空字段拼接展示
    ...(book ? { book } : {}),
    original_text: originalText,
    illustration: '',
    bgm: '',
  }

  const wordList = annotations.map((item) => {
    const word = WORD_CORRECTIONS[item.word] ?? item.word
    return {
      text_id: wenId,
      word,
      basic_meaning: fixMeaning(item.meaning, item.word, word),
      follow_up_questions: [],
    }
  })

  let multiRole = null
  const audio = audioIndex?.[wenId]
  if (AUDIO_UNAVAILABLE[poemId]) {
    // 明确记录不生成的原因，避免以后误以为脚本漏跑
  } else if (audio && audio.audio_file && audio.durationSeconds > 0) {
    multiRole = {
      text_id: wenId,
      audio_file: audio.audio_file,
      segments: [
        {
          sentence_index: 1,
          time_range: `00:00-${formatTime(audio.durationSeconds)}`,
          role_name: '课文朗读',
          dialogue: buildSpokenText(originalText),
        },
      ],
    }
  }

  return { wenId, poemId, title, book, basicInfo, wordList, multiRole, annotations }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const content = JSON.stringify(data, null, 2) + '\n'
  fs.writeFileSync(file, content)
  return content
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const inputDir = path.resolve(args.input)
  if (!fs.existsSync(inputDir)) throw new Error(`输入目录不存在：${inputDir}`)

  const audioIndex = args.audioIndex
    ? JSON.parse(fs.readFileSync(path.resolve(args.audioIndex), 'utf8'))
    : {}

  const files = fs
    .readdirSync(inputDir)
    .filter((name) => name.endsWith('.json') && name !== 'index.json' && name !== 'audio-index.json')
    .sort()

  const summary = { written: [], skipped: [], audioSkipped: [], errors: [] }

  for (const name of files) {
    const file = path.join(inputDir, name)
    let raw
    try {
      raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch (error) {
      summary.errors.push(`${name}: 不是合法 JSON（${error.message}）`)
      continue
    }

    let built
    try {
      built = buildFromRaw(raw, audioIndex)
    } catch (error) {
      summary.errors.push(`${name}: ${error.message}`)
      continue
    }

    if (built.skip) {
      summary.skipped.push(`${name}: ${built.skip}`)
      continue
    }
    if (ALREADY_DELIVERED.includes(built.poemId) && !args.includeDelivered) {
      summary.skipped.push(`${name}: ${built.wenId} 是人工校对稿，默认不重新生成（加 --include-delivered 强制）`)
      continue
    }

    const { wenId, poemId, basicInfo, wordList, multiRole } = built
    const targets = [
      ['text_basic_info', basicInfo],
      ['word_list', wordList],
    ]
    if (multiRole) targets.push(['multi_role_reading', multiRole])

    let wroteAny = false
    for (const [dir, data] of targets) {
      const outFile = path.join(args.out, dir, `${wenId}.json`)
      if (fs.existsSync(outFile) && !args.force) {
        summary.skipped.push(`${wenId} ${dir} 已存在（加 --force 覆盖）`)
        continue
      }
      const content = writeJson(outFile, data)
      if (args.mirror) {
        fs.mkdirSync(path.join(args.mirror, dir), { recursive: true })
        fs.writeFileSync(path.join(args.mirror, dir, `${wenId}.json`), content)
      }
      wroteAny = true
    }
    if (wroteAny) summary.written.push(`${wenId} ${built.title}`)
    if (!multiRole) {
      summary.audioSkipped.push(`${wenId} ${AUDIO_UNAVAILABLE[poemId] || '没有音频时长数据（未提供 --audio-index）'}`)
    }
  }

  console.log(`\n已生成 ${summary.written.length} 篇：`)
  for (const line of summary.written) console.log(`  ✓ ${line}`)
  if (summary.audioSkipped.length) {
    console.log(`\n未生成朗读 JSON ${summary.audioSkipped.length} 篇：`)
    for (const line of summary.audioSkipped) console.log(`  - ${line}`)
  }
  if (summary.skipped.length) {
    console.log(`\n跳过 ${summary.skipped.length} 条：`)
    for (const line of summary.skipped) console.log(`  - ${line}`)
  }
  if (summary.errors.length) {
    console.error(`\n失败 ${summary.errors.length} 条：`)
    for (const line of summary.errors) console.error(`  ✗ ${line}`)
    process.exitCode = 1
  }
}

main()
