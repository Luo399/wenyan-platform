/**
 * 看板查询公共工具
 *
 * 教师看板与管理员看板共用的时间窗口、占位符、日期分桶等小工具。
 * 只放纯函数，不碰数据库，便于单测。
 */

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * 生成 n 个 `?` 占位符（调用方保证 n >= 1）
 */
function placeholders(items) {
  return items.map(() => '?').join(',')
}

/**
 * SQLite 时间窗口参数：配合 `date(列) >= date('now', ?)` 使用
 *
 * 口径：窗口 = 含今天的连续 n 个自然日，所以偏移量是 -(n-1) 天。
 * 只有这样才能和 recentDateKeys(n) 补出来的 n 个日期桶严格对齐；
 * 若直接写 '-n days'，date() 的天级精度会把跨度变成 n+1 天，
 * 「近 1 天活跃（DAU）」就会把昨天的提交也算进去。
 *
 * 另外为什么不与 JS 时间串直接比字典序：
 * answers.submitted_at 是应用写入的 ISO8601（带 T 和 Z），而
 * students/teachers.created_at 是 SQLite DATETIME('now') 的 'YYYY-MM-DD HH:MM:SS'。
 * 两种格式混比时，同一天的 ' '(0x20) < 'T'(0x54) 会把边界日的行误判为窗口外；
 * date() 对两种格式都能解析，且天级精度正是看板需要的口径。
 *
 * @param {number} days 窗口天数（>=1）
 * @returns {string} 例如 '-6 days'（表示含今天在内的 7 天）
 */
function sqliteWindow(days) {
  const n = Number(days)
  const safe = Number.isFinite(n) && n >= 1 ? Math.floor(n) : 30
  return `-${safe - 1} days`
}

/**
 * 天级窗口判断（JS 侧，口径与 sqliteWindow 一致）
 * @param {string|null|undefined} value ISO8601 或 SQLite DATETIME 字符串
 * @param {number} days 含今天在内的 n 个自然日
 */
function isWithinWindow(value, days) {
  const key = toDateKey(value)
  if (!key) return false
  const n = Number(days)
  const safe = Number.isFinite(n) && n >= 1 ? Math.floor(n) : 30
  const cutoff = new Date(Date.now() - (safe - 1) * DAY_MS).toISOString().slice(0, 10)
  return key >= cutoff
}

/**
 * ISO 时间串 → 'YYYY-MM-DD'（UTC，与 SQLite strftime 口径一致）
 * @returns {string|null}
 */
function toDateKey(value) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

/**
 * ISO 时间串 → 0-23 的小时数
 */
function toHour(value) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.getUTCHours()
}

/**
 * 保留一位小数；非数字返回 0
 */
function round1(value) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0
}

/**
 * 百分比：part / whole * 100，whole 为 0 时返回 0
 */
function percent(part, whole) {
  if (!Number.isFinite(whole) || whole <= 0) return 0
  return round1((Number(part) / whole) * 100)
}

/**
 * 距今多少个整天（向上取整到"停滞天数"语义）；无时间返回 null
 */
function daysSince(value, now = Date.now()) {
  const key = toDateKey(value)
  if (!key) return null
  const then = new Date(value)
  if (Number.isNaN(then.getTime())) return null
  const diff = now - then.getTime()
  return diff < 0 ? 0 : Math.floor(diff / DAY_MS)
}

/**
 * 最近 n 天的日期序列（升序，含今天），用于补齐趋势图里没有任何提交的空日
 */
function recentDateKeys(days, now = new Date()) {
  const n = Number.isFinite(Number(days)) && Number(days) > 0 ? Number(days) : 30
  const keys = []
  for (let i = n - 1; i >= 0; i -= 1) {
    keys.push(new Date(now.getTime() - i * DAY_MS).toISOString().slice(0, 10))
  }
  return keys
}

/**
 * 班级编码 → 年级（4 位入学年 + 2 位班号，年级取前 4 位）
 * 见 teacherController 的 CLASS_CODE_REGEX：^\d{4}(0[1-9]|[1-2]\d|3[0-1])$
 */
function gradeOfClassCode(classCode) {
  if (typeof classCode !== 'string' || classCode.length < 4) return '未分类'
  return classCode.slice(0, 4)
}

module.exports = {
  DAY_MS,
  placeholders,
  sqliteWindow,
  isWithinWindow,
  toDateKey,
  toHour,
  round1,
  percent,
  daysSince,
  recentDateKeys,
  gradeOfClassCode,
}
