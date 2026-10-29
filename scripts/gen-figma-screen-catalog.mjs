#!/usr/bin/env node
/**
 * gen-figma-screen-catalog.mjs - 把 OSS 扫描清单折叠成前端资产目录
 *
 * 输入：`GET /api/assets/oss-list` 的响应 JSON（或同结构快照）
 * 输出：src/config/figmaScreenCatalog.ts
 *
 * 为什么需要这一步：
 * - Figma 插件按「组件」切图，同一篇课文在 dialogue/quiz/video 等页面下会重复
 *   上传同一张标题图/按钮图（WEN_02 有 6 份 article_title_WEN_02_*.png），
 *   浏览器不可能也不应该去 OSS 列目录。
 * - 扫描结果里真正有区别的只是「篇目 × 角色」，所以这里按角色折叠：
 *   每篇保留一张标题图、一组按钮/文本框、四个选项底图，以及按角色名归档的
 *   头像/立绘/背景（后者体积大，只登记不默认渲染）。
 *
 * 用法：
 *   node scripts/gen-figma-screen-catalog.mjs [oss-list.json] [out.ts]
 * 默认读 tmp-oss-list.json，写 src/config/figmaScreenCatalog.ts。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const inputPath = path.resolve(process.argv[2] || path.join(root, 'tmp-oss-list.json'))
const outputPath = path.resolve(
  process.argv[3] || path.join(root, 'src/config/figmaScreenCatalog.ts'),
)

const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
const wenList = raw?.data?.wen_list || raw?.wen_list || []
if (!Array.isArray(wenList) || wenList.length === 0) {
  console.error(`[gen-catalog] ${inputPath} 里没有 wen_list`)
  process.exit(1)
}

/** 去掉 OSS 路径前缀 images/screens/，保留 WEN_xx/<type>/<file> */
function toRel(ossPath) {
  return String(ossPath).replace(/^images\/screens\//, '')
}

/** 文件名（不含目录），去掉末尾页码后缀后的角色基名 */
function baseName(file) {
  return file.replace(/\.(png|jpe?g|webp|svg)$/i, '').replace(/_\d+(_\d+)?$/, '')
}

/** 数字后缀：无后缀排最前，其次 _01、_02… */
function suffixRank(file) {
  const m = file.match(/_(\d+)(?:_\d+)?\.[a-z]+$/i)
  return m ? Number(m[1]) : 0
}

function pickBest(items) {
  return [...items].sort((a, b) => {
    const rank = suffixRank(a.file) - suffixRank(b.file)
    if (rank !== 0) return rank
    return a.file.length - b.file.length
  })[0]
}

const ROLE_MATCHERS = {
  btnBack: /^btn_back/,
  btnNext: /^btn_next/,
  btnSubmit: /^btn_submit/,
  btnCompleted: /^btn_completed/,
  bgm: /^bgm-controller/,
  gradeArea: /^grade_area/,
  videoPlaceholder: /^video_placeholder/,
  cardBamboo: /^card_bamboo/,
  bgScroll: /^bg_scroll/,
  bgSummary: /^bg_summary/,
  articleBg: /^article_bg/,
}

const TEXT_BOX_MATCHERS = {
  summary: /^summary_text_box/,
  homework: /^homework_text_box/,
  proverb: /^proverb_text_box/,
  poem: /^poem_text_box/,
  explanation: /^explanation_text_box/,
}

const catalog = {}
let totalFiles = 0
let foldedFiles = 0

for (const wen of wenList) {
  const wenId = String(wen.wen_id || '').toUpperCase()
  if (!/^WEN_\d+$/.test(wenId)) continue

  const files = []
  for (const screen of wen.screens || []) {
    for (const image of screen.images || []) {
      if (!image.oss_path) continue
      files.push({
        path: toRel(image.oss_path),
        file: String(image.oss_path).split('/').pop(),
        screenType: screen.screen_type,
        size: Number(image.size) || 0,
      })
    }
  }
  totalFiles += files.length
  foldedFiles += files.length

  const entry = {
    title: null,
    roles: {},
    options: {},
    textBoxes: {},
    backgrounds: {},
    avatars: {},
    characterCards: {},
    fileCount: files.length,
  }

  // 标题图：文件名形如 article_title[_WEN]_<篇号>[_<页码>].png。
  // 篇号必须按当前 wenId 精确剥离——否则 WEN_02/article_title_WEN_02.png
  // 末尾的 _02 会被误当成页码。
  const wenDigits = wenId.replace(/\D/g, '')
  const titleRe = new RegExp(`^article_title(?:_WEN)?_?${wenDigits}(?:_(\\d+))?\\.png$`)
  const titles = files.filter((f) => f.file.startsWith('article_title'))
  if (titles.length > 0) {
    const exact = titles.filter(
      (f) => titleRe.test(f.file) && titleRe.exec(f.file)?.[1] === undefined,
    )
    const numbered = titles
      .filter((f) => titleRe.test(f.file))
      .sort((a, b) => Number(titleRe.exec(a.file)?.[1]) - Number(titleRe.exec(b.file)?.[1]))
    const best = exact[0] || numbered[0] || pickBest(titles)
    entry.title = { path: best.path, size: best.size }
  }

  for (const [role, matcher] of Object.entries(ROLE_MATCHERS)) {
    const candidates = files.filter((f) => matcher.test(f.file))
    if (candidates.length === 0) continue
    const best = pickBest(candidates)
    entry.roles[role] = { path: best.path, size: best.size }
    foldedFiles -= candidates.length - 1
  }

  for (const [role, matcher] of Object.entries(TEXT_BOX_MATCHERS)) {
    const candidates = files.filter((f) => matcher.test(f.file))
    if (candidates.length === 0) continue
    const best = pickBest(candidates)
    entry.textBoxes[role] = { path: best.path, size: best.size }
    foldedFiles -= candidates.length - 1
  }

  for (const key of ['a', 'b', 'c', 'd']) {
    const candidates = files.filter((f) => new RegExp(`^option_${key}`).test(f.file))
    if (candidates.length === 0) continue
    const best = pickBest(candidates)
    entry.options[key.toUpperCase()] = { path: best.path, size: best.size }
    foldedFiles -= candidates.length - 1
  }

  // 组图类：按角色名归档，每类只留第一张（页面上的页码变体是同一张图）
  const group = (matcher, target) => {
    const seen = new Set()
    for (const f of files) {
      if (!matcher.test(f.file)) continue
      const key = baseName(f.file)
      if (seen.has(key)) continue
      seen.add(key)
      target[key] = { path: f.path, size: f.size }
      foldedFiles -= 1
    }
  }
  group(/^bg_/, entry.backgrounds)
  if (entry.roles.articleBg) {
    entry.backgrounds.article_bg = entry.roles.articleBg
    delete entry.roles.articleBg
  }
  group(/^avatarr?_|^avata_/, entry.avatars)
  group(/^card_(character|characte|fan|qiankessaoren)/, entry.characterCards)

  // 标题图/按钮等剩下的重复页面副本也计入折叠量，便于输出摘要
  catalog[wenId] = entry
}

const refLine = (ref) => (ref ? `{ path: '${ref.path}', size: ${ref.size} }` : 'undefined')
const sortedWens = Object.keys(catalog).sort()
const lines = []
lines.push('/**')
lines.push(' * figmaScreenCatalog - Figma 插件扫描资产的「篇目 × 角色」目录（自动生成，勿手改）')
lines.push(' *')
lines.push(' * 数据来源：生产 OSS 清单接口 GET /api/assets/oss-list 的快照，')
lines.push(' * 由 scripts/gen-figma-screen-catalog.mjs 折叠生成：同一篇课文在不同页面里')
lines.push(' * 重复上传的标题图/按钮图只保留一张，按角色名归档头像、立绘、背景。')
lines.push(' *')
lines.push(
  ` * 快照：${totalFiles} 个扫描文件 → ${sortedWens.length} 篇、` +
    `${Object.values(catalog).reduce((n, e) => n + Object.keys(e.roles).length + Object.keys(e.options).length + Object.keys(e.textBoxes).length + Object.keys(e.backgrounds).length + Object.keys(e.avatars).length + Object.keys(e.characterCards).length + (e.title ? 1 : 0), 0)} 条角色记录。`,
)
lines.push(' * 重新生成：node scripts/gen-figma-screen-catalog.mjs <oss-list.json>')
lines.push(' *')
lines.push(' * 所有 path 都是相对 images/screens/ 的路径，拼接统一走 config/figmaAssets.ts。')
lines.push(' */')
lines.push('')
lines.push('export interface FigmaScreenAssetRef {')
lines.push('  /** 相对 images/screens/ 的路径（含 WEN_xx/<screenType>/） */')
lines.push('  path: string')
lines.push('  /** OSS 上的字节数，用于判断是否适合直接上屏 */')
lines.push('  size: number')
lines.push('}')
lines.push('')
lines.push('export type FigmaScreenRole =')
lines.push("  | 'btnBack'")
lines.push("  | 'btnNext'")
lines.push("  | 'btnSubmit'")
lines.push("  | 'btnCompleted'")
lines.push("  | 'bgm'")
lines.push("  | 'gradeArea'")
lines.push("  | 'videoPlaceholder'")
lines.push("  | 'cardBamboo'")
lines.push("  | 'bgScroll'")
lines.push("  | 'bgSummary'")
lines.push('')
lines.push("export type FigmaOptionKey = 'A' | 'B' | 'C' | 'D'")
lines.push('')
lines.push(
  "export type FigmaTextBoxRole = 'summary' | 'homework' | 'proverb' | 'poem' | 'explanation'",
)
lines.push('')
lines.push('export interface WenScreenCatalogEntry {')
lines.push('  /** 整篇书法标题图（页面内重复出现的取一张） */')
lines.push('  title?: FigmaScreenAssetRef')
lines.push('  roles: Partial<Record<FigmaScreenRole, FigmaScreenAssetRef>>')
lines.push('  options: Partial<Record<FigmaOptionKey, FigmaScreenAssetRef>>')
lines.push('  textBoxes: Partial<Record<FigmaTextBoxRole, FigmaScreenAssetRef>>')
lines.push('  /** 场景背景（单张 2.8–18MB，默认不直接渲染） */')
lines.push('  backgrounds: Record<string, FigmaScreenAssetRef>')
lines.push('  /** 角色立绘（单张 0.4–3MB，默认不直接渲染） */')
lines.push('  avatars: Record<string, FigmaScreenAssetRef>')
lines.push('  /** 角色名牌/小像（10–18KB） */')
lines.push('  characterCards: Record<string, FigmaScreenAssetRef>')
lines.push('  /** 该篇在扫描清单里的原始文件数 */')
lines.push('  fileCount: number')
lines.push('}')
lines.push('')
lines.push('export const FIGMA_SCREEN_CATALOG: Record<string, WenScreenCatalogEntry> = {')
for (const wenId of sortedWens) {
  const e = catalog[wenId]
  lines.push(`  ${wenId}: {`)
  lines.push(`    title: ${refLine(e.title)},`)
  lines.push('    roles: {')
  for (const role of Object.keys(ROLE_MATCHERS)) {
    if (e.roles[role]) lines.push(`      ${role}: ${refLine(e.roles[role])},`)
  }
  lines.push('    },')
  lines.push('    options: {')
  for (const key of ['A', 'B', 'C', 'D']) {
    if (e.options[key]) lines.push(`      ${key}: ${refLine(e.options[key])},`)
  }
  lines.push('    },')
  lines.push('    textBoxes: {')
  for (const role of Object.keys(TEXT_BOX_MATCHERS)) {
    if (e.textBoxes[role]) lines.push(`      ${role}: ${refLine(e.textBoxes[role])},`)
  }
  lines.push('    },')
  const groupLines = (label, obj) => {
    lines.push(`    ${label}: {`)
    for (const key of Object.keys(obj).sort()) {
      lines.push(`      '${key}': ${refLine(obj[key])},`)
    }
    lines.push('    },')
  }
  groupLines('backgrounds', e.backgrounds)
  groupLines('avatars', e.avatars)
  groupLines('characterCards', e.characterCards)
  lines.push(`    fileCount: ${e.fileCount},`)
  lines.push('  },')
}
lines.push('}')
lines.push('')
lines.push('/** 目录里已登记的篇目 ID（WEN_01 形式） */')
lines.push('export const FIGMA_SCREEN_CATALOG_WEN_IDS: readonly string[] = Object.freeze([')
lines.push(sortedWens.map((id) => `'${id}'`).join(', '))
lines.push('])')
lines.push('')

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, lines.join('\n'), 'utf8')
const bytes = fs.statSync(outputPath).size
console.log(
  `[gen-catalog] ${sortedWens.length} 篇 / ${totalFiles} 个扫描文件 → ${path.relative(root, outputPath)} (${Math.round(bytes / 1024)}KB)`,
)
