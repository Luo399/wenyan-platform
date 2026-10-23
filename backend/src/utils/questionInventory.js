/**
 * 题量清单（question inventory）
 *
 * 看板算「完成率」需要一个分母：每篇文言文每一关一共有多少道题。
 * answers 表只记录学生答过的题，答都没答过的题不在库里，所以分母必须
 * 从题库 JSON 侧取，且要和前端 adapter 的过滤口径保持一致，否则会出现
 * 「学生全答完却只有 80%」的假象。
 *
 * 口径对齐（见 src/adapters/levelQuizAdapter.ts 与 quizAdapter.ts）：
 *   - A 关（第一关）：level1_quiz/{wen}.json 数组，计入 text_id 存在且 question_text 非空的条目
 *     （该文件没有题号字段，题号由前端 adapter 合成为 `${textId}_A${n}`）
 *   - B 关（第二关）：pages_level2_dialog_quiz/{wen}.json 里的去重题号数
 *   - C 关（第三关）：pages_level3_adaptive_quiz/{wen}.json 里的去重题号数
 *   - pages_* 缺失或无数出题目时回退 level2_quiz / level3_quiz（旧的扁平数组格式，与 A 关同口径）
 *
 * 结果按 TTL 缓存，避免每次看板请求都读十几个 JSON 文件。
 */

const fs = require('fs')
const path = require('path')
const config = require('../config/app')
const logger = require('./logger')

const LEVEL_KEYS = ['A', 'B', 'C']

/** 题号后缀 → 关卡：WEN_01_B2 → 'B'；无后缀（旧数据/测试数据）返回 null */
const QUESTION_LEVEL_PATTERN = /_([ABC])\d+$/i

const CACHE_TTL_MS = 5 * 60 * 1000

let _cache = null
let _cachedAt = 0

/**
 * 安全读取 JSON 文件，失败返回 null（题库缺文件是常态，不应抛错）
 */
function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (err) {
    logger.warn(`[questionInventory] 读取失败 ${filePath}: ${err.message}`)
    return null
  }
}

/**
 * 扁平数组格式题库（A 关 / B、C 关旧格式）的计数口径，与 LEVEL*_ADAPTER.adapt 一致
 */
function countFlatQuiz(raw) {
  if (!Array.isArray(raw)) return 0
  return raw.filter(
    (item) => item && item.text_id && typeof item.question_text === 'string' && item.question_text.trim(),
  ).length
}

/**
 * 递归收集 JSON 里出现的所有题号（question_id / questionId）
 *
 * 为什么不用固定路径数块：题库有两种分块形状，且还在演进——
 *   pages_level2_dialog_quiz: { blocks: [{ type:'quiz', data:{ question_id } }] }
 *   pages_level3_adaptive_quiz: { items: [{ text, quiz:{ question_id } }] }
 * 按路径硬编码会把 C 关整个数成 0，完成率的分母就虚低了。
 * 题号本身就是「这道题存在」的权威信号，去重后计数对两种形状都成立。
 */
function collectQuestionIds(node, out = new Set(), depth = 0) {
  if (!node || typeof node !== 'object' || depth > 12) return out
  if (Array.isArray(node)) {
    for (const item of node) collectQuestionIds(item, out, depth + 1)
    return out
  }
  for (const key of ['question_id', 'questionId']) {
    const value = node[key]
    if (typeof value === 'string' && value) out.add(value)
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') collectQuestionIds(value, out, depth + 1)
  }
  return out
}

/**
 * 分块/条目格式题库（B、C 关）的计数口径
 */
function countPageQuiz(raw) {
  const ids = collectQuestionIds(raw)
  if (ids.size > 0) return ids.size
  // 兜底：极少数文件里的 quiz 块没有题号，仍按 quiz 块数计
  if (!raw || !Array.isArray(raw.blocks)) return 0
  return raw.blocks.filter((block) => block && block.type === 'quiz' && block.data).length
}

function dataFilePath(dirName, fileName) {
  return path.join(config.data.basePath, dirName, fileName)
}

/**
 * 枚举平台上的篇目 id（以 text_basic_info 目录为准）
 */
function listWenIds() {
  const dir = dataFilePath('text_basic_info', '')
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json') && /^[\w-]+\.json$/.test(f) && f !== 'text_basic_info.json')
      .map((f) => f.replace(/\.json$/, ''))
      .sort()
  } catch (err) {
    logger.warn(`[questionInventory] 无法枚举篇目目录 ${dir}: ${err.message}`)
    return []
  }
}

/**
 * 单篇的三关题量
 * @param {string} wenId
 * @returns {{A:number,B:number,C:number,total:number,has_data:boolean}}
 */
function getWenTotals(wenId) {
  const inventory = buildInventory()
  return inventory.byWen[wenId] || { A: 0, B: 0, C: 0, total: 0, has_data: false }
}

/**
 * 构造（或复用缓存的）完整清单
 * @returns {{texts:Array,byWen:object,totals:object,generated_at:string}}
 */
function buildInventory(force = false) {
  const now = Date.now()
  if (!force && _cache && now - _cachedAt < CACHE_TTL_MS) return _cache

  const byWen = {}
  const texts = []
  const totals = { A: 0, B: 0, C: 0, total: 0 }

  for (const wenId of listWenIds()) {
    const basic = readJson(dataFilePath('text_basic_info', `${wenId}.json`))

    const a = countFlatQuiz(readJson(dataFilePath('level1_quiz', `${wenId}.json`)))

    const bPages = countPageQuiz(readJson(dataFilePath('pages_level2_dialog_quiz', `${wenId}.json`)))
    const b = bPages || countFlatQuiz(readJson(dataFilePath('level2_quiz', `${wenId}.json`)))

    const cPages = countPageQuiz(readJson(dataFilePath('pages_level3_adaptive_quiz', `${wenId}.json`)))
    const c = cPages || countFlatQuiz(readJson(dataFilePath('level3_quiz', `${wenId}.json`)))

    const total = a + b + c
    const entry = { A: a, B: b, C: c, total, has_data: total > 0 }
    byWen[wenId] = entry
    totals.A += a
    totals.B += b
    totals.C += c
    totals.total += total

    texts.push({
      wen_id: wenId,
      title: (basic && basic.title) || wenId,
      author: (basic && basic.author) || '',
      dynasty: (basic && basic.dynasty) || '',
      levels: { A: a, B: b, C: c },
      total,
    })
  }

  _cache = { texts, byWen, totals, generated_at: new Date().toISOString() }
  _cachedAt = now
  return _cache
}

/**
 * 判断一道题属于哪一关；旧数据或测试数据没有关卡后缀时返回 null
 * @param {string} questionId
 * @returns {'A'|'B'|'C'|null}
 */
function classifyQuestionLevel(questionId) {
  if (typeof questionId !== 'string') return null
  const m = QUESTION_LEVEL_PATTERN.exec(questionId)
  return m ? m[1].toUpperCase() : null
}

/**
 * 从题号推出所属篇目（WEN_01_B2 → WEN_01）；推不出返回 null
 * answers 表本身有 wen_id 列，这里只作为兜底
 */
function classifyQuestionWen(questionId) {
  if (typeof questionId !== 'string') return null
  const m = /^(WEN_[\w-]+?)_[ABC]\d+$/i.exec(questionId)
  return m ? m[1].toUpperCase() : null
}

/**
 * 清空缓存（题库更新或单测用）
 */
function invalidateInventoryCache() {
  _cache = null
  _cachedAt = 0
}

module.exports = {
  LEVEL_KEYS,
  buildInventory,
  getInventory: () => buildInventory(),
  getWenTotals,
  getPlatformTotals: () => buildInventory().totals,
  classifyQuestionLevel,
  classifyQuestionWen,
  invalidateInventoryCache,
}
