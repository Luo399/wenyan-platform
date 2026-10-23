/**
 * 教师数据看板 Controller
 *
 * 定位：回答「我教的班，谁没学、学到哪一关、哪道题全班都不会」。
 *
 * 权限口径（安全红线）：
 * - 班级范围一律由 token 里的教师身份反查 teacher_classes 得到，前端传的 class_code
 *   只用于「在本班范围内再收窄」，越权直接 403，绝不作为权限来源。
 * - 全权限教师（teachers.can_view_all = 1，getTeacherClassCodes 返回 ['*']）不加班级过滤。
 *
 * 统计口径（与看板页文案一一对应）：
 * - 事实行 = 每个学生每道一道题的「最后一次作答」（attempt_number 最大，其次 submitted_at 最新），
 *   代表该生该题的最终掌握情况；总提交量另按 answers 原始行数统计。
 * - 已答题数 answered = 该生作答过的不同题数；正确率 accuracy = 最终答对数 / 已答题数。
 * - 班级/汇总里的 avg_accuracy = 「答过题的学生」正确率的平均（不含从未开学的学生，
 *   否则新班会把正确率算成 0，班级行与顶部卡片对不上）；avg_completion_rate 则按全部学生算，
 *   未开始的学生记 0 进度，这样完成率才反映「班级整体推进了多少」。
 * - 完成率 completion_rate = 已答题数 / 应答题数（题量分母来自 utils/questionInventory）。
 * - 掌握 mastered = 最后一次作答 is_correct = 1。
 * - 关卡归属由题号后缀判定（WEN_01_B2 → B 关）；旧数据/测试数据无后缀时归入 other，
 *   计入总体但不计入 A/B/C 三关。
 * - 停滞天数 stalled_days = 距该生最后一次提交的自然日数；从未提交为 null。
 * - 活跃 active_7d = 最近 7 天有过提交。
 *
 * 所有 GET 接口返回 { success, data, timestamp } 信封，与仓库既有接口一致。
 */

const { z } = require('zod')
const { handleZodError } = require('../middleware/validate')
const { db } = require('../config/database')
const { dbAll, dbGet } = require('../utils/dbPromise')
const logger = require('../utils/logger')
const { getTeacherClassCodes } = require('../services/authService')
const {
  getInventory,
  getWenTotals,
  classifyQuestionLevel,
} = require('../utils/questionInventory')
const dq = require('../utils/dashboardQuery')

const CLASS_CODE_REGEX = /^\d{4}(0[1-9]|[1-2]\d|3[0-1])$/
const ACTIVE_WINDOW_DAYS = 7

/**
 * 完成率封顶 100%
 *
 * 库里可能存在题库已删掉的旧题号（内容侧改题、测试数据），
 * 不封顶的话学生会出现 200% 这种不可能的进度。
 */
function clampedPercent(part, whole) {
  return Math.min(100, dq.percent(part, whole))
}

/**
 * 班级编码：空串/纯空白视为「全部所教班级」
 *
 * optional() 必须加在内层 schema 上：z.preprocess(...).optional() 不会把可选性
 * 传导给内层，前端带 `?class_code=`（选「全部班级」时很常见）会被判成 Required。
 */
const classCodeSchema = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().regex(CLASS_CODE_REGEX, '班级编码格式应为 4 位年级 + 2 位序号').optional(),
)

const overviewSchema = z.object({ class_code: classCodeSchema })

const studentsSchema = z.object({
  class_code: classCodeSchema,
  keyword: z.string().trim().max(30).optional(),
  sort: z
    .enum(['student_id', 'accuracy', 'completion_rate', 'last_submitted_at', 'stalled_days'])
    .default('student_id'),
  order: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(50),
})

const textsSchema = z.object({ class_code: classCodeSchema })

const weakQuestionsSchema = z.object({
  class_code: classCodeSchema,
  /** 最少作答人数：低于此覆盖度的题正确率没有统计意义 */
  min_students: z.coerce.number().int().min(1).max(50).default(2),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

const activitySchema = z.object({
  class_code: classCodeSchema,
  days: z.coerce.number().int().min(1).max(365).default(30),
})

// ---------------------------------------------------------------------------
// 权限范围
// ---------------------------------------------------------------------------

/**
 * 由 token 解析教师身份与其可访问班级
 * @returns {Promise<{error:string}|{teacherId:number,allAccess:boolean,classCodes:string[]}>}
 */
async function resolveScope(req) {
  if (!req.user || !req.user.phone) return { error: 'AUTH_REQUIRED' }
  const teacher = await dbGet(db, 'SELECT id FROM teachers WHERE phone = ?', [req.user.phone])
  if (!teacher) return { error: 'AUTH_REQUIRED' }
  const codes = await getTeacherClassCodes(teacher.id)
  if (codes.includes('*')) {
    return { teacherId: teacher.id, allAccess: true, classCodes: [] }
  }
  return { teacherId: teacher.id, allAccess: false, classCodes: codes }
}

/**
 * 校验并收窄班级范围
 *
 * 不变量：scope.classCodes 为空数组 ==「不加班级过滤」。
 * 全权限教师未指定班级时走这条路径，指定了就只剩那一个班（见 scopeWhere）。
 * @returns {{scope:object}|{error:{code:string,message:string}}}
 */
function narrowScope(resolvedScope, classCode) {
  if (resolvedScope.allAccess) {
    return { scope: { ...resolvedScope, classCodes: classCode ? [classCode] : [], filtered: Boolean(classCode) } }
  }
  if (resolvedScope.classCodes.length === 0) {
    return { scope: { ...resolvedScope, classCodes: [], filtered: false } }
  }
  if (classCode && !resolvedScope.classCodes.includes(classCode)) {
    return { error: { code: 'FORBIDDEN', message: '无权查看该班级学生' } }
  }
  return {
    scope: {
      ...resolvedScope,
      classCodes: classCode ? [classCode] : resolvedScope.classCodes,
      filtered: Boolean(classCode),
    },
  }
}

/**
 * 班级范围 → SQL 片段
 *
 * 判据只看 classCodes 是否为空，不能写成 `scope.allAccess` 短路：
 * narrowScope() 已保证「全权限且不指定班级」时 codes 为空数组，
 * 而「全权限 + ?class_code=202601」时 codes 是那一个班级。若这里用
 * allAccess 提前返回，全权限教师永远无法按单个班级收窄，接口会把
 * 整个平台的数据算进单个班级。
 */
function scopeWhere(scope, alias = 's') {
  if (scope.classCodes.length === 0) return { sql: '', params: [] }
  return {
    sql: ` AND ${alias}.class_code IN (${dq.placeholders(scope.classCodes)})`,
    params: [...scope.classCodes],
  }
}

/** 无任何班级权限时给出统一的空结构，避免 SQL 拼出非法 IN () */
function isEmptyScope(scope) {
  return !scope.allAccess && scope.classCodes.length === 0
}

function scopeDescription(scope) {
  return {
    all_access: Boolean(scope.allAccess) && !scope.filtered,
    class_codes: scope.filtered ? scope.classCodes : scope.allAccess ? [] : scope.classCodes,
    requested_class_code: scope.filtered ? scope.classCodes[0] : null,
  }
}

// ---------------------------------------------------------------------------
// 数据装载
// ---------------------------------------------------------------------------

/**
 * 学生名册（不含 password_hash）
 *
 * 表必须起别名 s：scopeWhere() 生成的是 `AND s.class_code IN (...)`，
 * 没有别名时 SQLite 直接报 no such column: s.class_code。
 */
async function loadRoster(scope) {
  if (isEmptyScope(scope)) return []
  const where = scopeWhere(scope)
  const sql = `SELECT s.student_id, s.student_name, s.class_code FROM students s
                WHERE 1=1${where.sql}
                ORDER BY s.class_code ASC, s.student_id ASC`
  return dbAll(db, sql, where.params)
}

/**
 * 逐题最后一次作答的事实行（JS 侧再按 student_id+question_id 去重取最终一次）
 */
async function loadFacts(scope) {
  if (isEmptyScope(scope)) return []
  const where = scopeWhere(scope)
  const sql = `SELECT a.student_id, a.wen_id, a.question_id, a.user_answer, a.is_correct,
                      a.score, a.attempt_number, a.submitted_at,
                      s.class_code, s.student_name
               FROM answers a
               INNER JOIN students s ON s.student_id = a.student_id
               WHERE 1=1${where.sql}
               ORDER BY a.student_id ASC, a.question_id ASC, a.attempt_number DESC`
  const rows = await dbAll(db, sql, where.params)

  // 同题多次作答时保留最终一次：先比 attempt_number，再比 submitted_at
  const latest = new Map()
  for (const row of rows) {
    const key = `${row.student_id}||${row.question_id}`
    const prev = latest.get(key)
    if (!prev) {
      latest.set(key, row)
      continue
    }
    const rank = (r) => [Number(r.attempt_number) || 0, r.submitted_at || '']
    const a = rank(prev)
    const b = rank(row)
    if (b[0] > a[0] || (b[0] === a[0] && b[1] > a[1])) latest.set(key, row)
  }
  return [...latest.values()]
}

/**
 * 原始提交量（不去重），可按时间窗口过滤
 */
async function loadSubmissionStats(scope, days) {
  if (isEmptyScope(scope)) return { submissions: 0, students: 0 }
  const where = scopeWhere(scope)
  const params = [...where.params]
  let sql = `SELECT COUNT(*) AS submissions, COUNT(DISTINCT a.student_id) AS students
             FROM answers a INNER JOIN students s ON s.student_id = a.student_id
             WHERE 1=1${where.sql}`
  if (days) {
    sql += ` AND date(a.submitted_at) >= date('now', ?)`
    params.push(dq.sqliteWindow(days))
  }
  const row = await dbGet(db, sql, params)
  return { submissions: row?.submissions || 0, students: row?.students || 0 }
}

/**
 * 按日提交趋势（补齐窗口内无数据的空日）
 */
async function loadDailyActivity(scope, days) {
  const keys = dq.recentDateKeys(days)
  const zero = keys.map((date) => ({ date, submissions: 0, active_students: 0 }))
  if (isEmptyScope(scope)) return zero
  const where = scopeWhere(scope)
  const window = dq.sqliteWindow(days)
  const rows = await dbAll(
    db,
    `SELECT strftime('%Y-%m-%d', a.submitted_at) AS date,
            COUNT(*) AS submissions,
            COUNT(DISTINCT a.student_id) AS active_students
     FROM answers a INNER JOIN students s ON s.student_id = a.student_id
     WHERE date(a.submitted_at) >= date('now', ?)${where.sql}
     GROUP BY date`,
    [window, ...where.params],
  )
  const byDate = new Map(rows.map((r) => [r.date, r]))
  return keys.map((date) => {
    const hit = byDate.get(date)
    return {
      date,
      submissions: hit ? Number(hit.submissions) : 0,
      active_students: hit ? Number(hit.active_students) : 0,
    }
  })
}

/**
 * 24 小时分布（UTC 小时，与 submitted_at 存储口径一致）
 */
async function loadHourlyActivity(scope, days) {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, submissions: 0 }))
  if (isEmptyScope(scope)) return buckets
  const where = scopeWhere(scope)
  const window = dq.sqliteWindow(days)
  const rows = await dbAll(
    db,
    `SELECT CAST(strftime('%H', a.submitted_at) AS INTEGER) AS hour, COUNT(*) AS submissions
     FROM answers a INNER JOIN students s ON s.student_id = a.student_id
     WHERE date(a.submitted_at) >= date('now', ?)${where.sql}
     GROUP BY hour`,
    [window, ...where.params],
  )
  for (const row of rows) {
    const h = Number(row.hour)
    if (h >= 0 && h < 24) buckets[h].submissions = Number(row.submissions)
  }
  return buckets
}

// ---------------------------------------------------------------------------
// 聚合
// ---------------------------------------------------------------------------

function emptyLevelStat(total) {
  return { answered: 0, correct: 0, total, accuracy: 0, completion_rate: 0 }
}

/**
 * 把事实行折叠到学生维度
 */
function foldStudents(roster, facts) {
  const inventory = getInventory()
  const platformTotal = inventory.totals.total
  const byStudent = new Map()

  for (const s of roster) {
    byStudent.set(s.student_id, {
      student_id: s.student_id,
      student_name: s.student_name,
      class_code: s.class_code,
      answered_questions: 0,
      correct_questions: 0,
      accuracy: 0,
      total_questions: platformTotal,
      completion_rate: 0,
      last_submitted_at: null,
      stalled_days: null,
      never_started: true,
      levels: {
        A: emptyLevelStat(inventory.totals.A),
        B: emptyLevelStat(inventory.totals.B),
        C: emptyLevelStat(inventory.totals.C),
        other: emptyLevelStat(0),
      },
      _wen: new Map(),
    })
  }

  for (const fact of facts) {
    const student = byStudent.get(fact.student_id)
    if (!student) continue // 名册外（已删除的学生）不计入
    student.answered_questions += 1
    student.never_started = false
    if (Number(fact.is_correct) === 1) student.correct_questions += 1

    if (!student.last_submitted_at || fact.submitted_at > student.last_submitted_at) {
      student.last_submitted_at = fact.submitted_at
    }

    const level = classifyQuestionLevel(fact.question_id) || 'other'
    const stat = student.levels[level]
    stat.answered += 1
    if (Number(fact.is_correct) === 1) stat.correct += 1

    const wenId = fact.wen_id || '未知篇目'
    if (!student._wen.has(wenId)) student._wen.set(wenId, { answered: 0, correct: 0 })
    const wenStat = student._wen.get(wenId)
    wenStat.answered += 1
    if (Number(fact.is_correct) === 1) wenStat.correct += 1
  }

  const students = [...byStudent.values()]
  for (const student of students) {
    student.accuracy = dq.percent(student.correct_questions, student.answered_questions)
    student.completion_rate = clampedPercent(student.answered_questions, student.total_questions)
    student.stalled_days = dq.daysSince(student.last_submitted_at)
    /** 近 7 个自然日（含今天）内有提交即视为活跃 */
    student.is_active_7d = dq.isWithinWindow(student.last_submitted_at, ACTIVE_WINDOW_DAYS)
    for (const stat of Object.values(student.levels)) {
      stat.accuracy = dq.percent(stat.correct, stat.answered)
      stat.completion_rate = clampedPercent(stat.answered, stat.total)
    }
    delete student._wen
  }
  return students
}

/**
 * 折叠出「篇目 × 班级」矩阵所需的学生级篇目完成情况
 */
function foldTextMatrix(roster, facts) {
  const inventory = getInventory()
  const studentClass = new Map(roster.map((s) => [s.student_id, s.class_code]))
  const cellMap = new Map() // `${class}||${wen}` -> { answeredStudents, completedStudents, answered, correct, progressSum }
  const perStudentWen = new Map() // `${student}||${wen}` -> answeredCount

  for (const fact of facts) {
    const classCode = studentClass.get(fact.student_id)
    if (classCode === undefined) continue
    const wenId = fact.wen_id || '未知篇目'
    const key = `${classCode}||${wenId}`
    const sKey = `${fact.student_id}||${wenId}`
    perStudentWen.set(sKey, (perStudentWen.get(sKey) || 0) + 1)

    if (!cellMap.has(key)) {
      cellMap.set(key, { answered_students: 0, completed_students: 0, answered: 0, correct: 0 })
    }
    const cell = cellMap.get(key)
    if (perStudentWen.get(sKey) === 1) cell.answered_students += 1
    cell.answered += 1
    if (Number(fact.is_correct) === 1) cell.correct += 1
  }

  // 完成 = 该生在该篇的已答题数 >= 该篇应答题数
  for (const [sKey, count] of perStudentWen) {
    const wenId = sKey.split('||')[1]
    const totals = getWenTotals(wenId)
    if (totals.total > 0 && count >= totals.total) {
      const classCode = studentClass.get(sKey.split('||')[0])
      const cell = cellMap.get(`${classCode}||${wenId}`)
      if (cell) cell.completed_students += 1
    }
  }

  const classCodes = [...new Set(roster.map((s) => s.class_code))]
  const studentsByClass = new Map()
  for (const code of classCodes) {
    studentsByClass.set(code, roster.filter((s) => s.class_code === code).length)
  }

  // 班内人均「该篇完成比例」（分母 = 该篇应答题数），供热力图色深使用
  // 必须按 班级×篇目 累计：只按班级累计会让同一班级每篇的 avg_progress 都长一样，
  // 没人答过的篇目也会显示有进度。
  const progressSumByClassWen = new Map()
  for (const [sKey, count] of perStudentWen) {
    const [studentId, wenId] = sKey.split('||')
    const classCode = studentClass.get(studentId)
    const wenTotal = getWenTotals(wenId).total
    if (classCode === undefined || wenTotal <= 0) continue
    const ratio = Math.min(1, count / wenTotal)
    const key = `${classCode}||${wenId}`
    progressSumByClassWen.set(key, (progressSumByClassWen.get(key) || 0) + ratio)
  }

  const rows = inventory.texts.map((text) => ({
    wen_id: text.wen_id,
    title: text.title,
    author: text.author,
    dynasty: text.dynasty,
    levels: text.levels,
    total_questions: text.total,
    cells: classCodes.map((classCode) => {
      const raw = cellMap.get(`${classCode}||${text.wen_id}`) || {
        answered_students: 0,
        completed_students: 0,
        answered: 0,
        correct: 0,
      }
      const classSize = studentsByClass.get(classCode) || 0
      return {
        class_code: classCode,
        student_count: classSize,
        answered_students: raw.answered_students,
        completed_students: raw.completed_students,
        accuracy: dq.percent(raw.correct, raw.answered),
        /** 班内人均该篇完成比例（0-100），作为热力图色深 */
        avg_progress:
          classSize === 0
            ? 0
            : dq.round1(((progressSumByClassWen.get(`${classCode}||${text.wen_id}`) || 0) / classSize) * 100),
        started_rate: dq.percent(raw.answered_students, classSize),
        completed_rate: dq.percent(raw.completed_students, classSize),
      }
    }),
  }))

  return { classes: classCodes, rows }
}

/**
 * 折叠出薄弱题排行：按最终答对率升序
 */
function foldWeakQuestions(facts, { minStudents, limit }) {
  const inventory = getInventory()
  const byQuestion = new Map()

  for (const fact of facts) {
    const key = `${fact.wen_id}||${fact.question_id}`
    if (!byQuestion.has(key)) {
      byQuestion.set(key, {
        wen_id: fact.wen_id,
        question_id: fact.question_id,
        attempted_students: 0,
        correct_students: 0,
        wrong_answers: new Map(),
      })
    }
    const item = byQuestion.get(key)
    item.attempted_students += 1 // 事实行已按 (学生, 题) 去重，此处即去重人数
    if (Number(fact.is_correct) === 1) {
      item.correct_students += 1
    } else {
      const answer = String(fact.user_answer ?? '')
      item.wrong_answers.set(answer, (item.wrong_answers.get(answer) || 0) + 1)
    }
  }

  const titleByWen = new Map(inventory.texts.map((t) => [t.wen_id, t.title]))

  return [...byQuestion.values()]
    .filter((item) => item.attempted_students >= minStudents)
    .map((item) => ({
      wen_id: item.wen_id,
      title: titleByWen.get(item.wen_id) || item.wen_id,
      question_id: item.question_id,
      level: classifyQuestionLevel(item.question_id),
      attempted_students: item.attempted_students,
      correct_students: item.correct_students,
      accuracy: dq.percent(item.correct_students, item.attempted_students),
      top_wrong_answers: [...item.wrong_answers.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([answer, count]) => ({ answer, count })),
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.attempted_students - a.attempted_students)
    .slice(0, limit)
}

/**
 * 班级维度汇总
 */
function foldClassSummary(roster, students) {
  const byClass = new Map()
  for (const s of roster) {
    if (!byClass.has(s.class_code)) byClass.set(s.class_code, [])
    byClass.get(s.class_code).push(s.student_id)
  }
  const studentMap = new Map(students.map((s) => [s.student_id, s]))

  return [...byClass.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([classCode, ids]) => {
      const members = ids.map((id) => studentMap.get(id)).filter(Boolean)
      const answeredMembers = members.filter((m) => !m.never_started)
      let accuracySum = 0
      let completionSum = 0
      let activeCount = 0
      for (const m of members) {
        completionSum += m.completion_rate
        if (m.is_active_7d) activeCount += 1
      }
      // 正确率只在「答过题」的学生里取平均（与 foldOverview 同口径），
      // 否则从未开学的班会把平均正确率算成 0，班级行和顶部卡片对不上。
      for (const m of answeredMembers) {
        accuracySum += m.accuracy
      }
      return {
        class_code: classCode,
        student_count: members.length,
        answered_student_count: answeredMembers.length,
        untouched_student_count: members.length - answeredMembers.length,
        active_students_7d: activeCount,
        avg_accuracy: answeredMembers.length ? dq.round1(accuracySum / answeredMembers.length) : 0,
        avg_completion_rate: members.length ? dq.round1(completionSum / members.length) : 0,
      }
    })
}

/**
 * 汇总卡片指标
 */
function foldOverview(roster, students, submissionTotal, submission7d) {
  const inventory = getInventory()
  const answered = students.filter((s) => !s.never_started)
  const accuracySum = answered.reduce((sum, s) => sum + s.accuracy, 0)
  const completionSum = students.reduce((sum, s) => sum + s.completion_rate, 0)

  return {
    class_count: new Set(roster.map((s) => s.class_code)).size,
    student_count: students.length,
    answered_student_count: answered.length,
    untouched_student_count: students.length - answered.length,
    active_students_7d: students.filter((s) => s.is_active_7d).length,
    submissions_total: submissionTotal.submissions,
    submissions_7d: submission7d.submissions,
    avg_accuracy: answered.length ? dq.round1(accuracySum / answered.length) : 0,
    avg_completion_rate: students.length ? dq.round1(completionSum / students.length) : 0,
    total_questions: inventory.totals.total,
    text_count: inventory.texts.length,
    level_totals: { A: inventory.totals.A, B: inventory.totals.B, C: inventory.totals.C },
  }
}

function fail(res, error) {
  if (error.code === 'FORBIDDEN') {
    return res.status(403).json({ success: false, error: 'FORBIDDEN', message: error.message })
  }
  return res.status(401).json({ success: false, error: 'AUTH_REQUIRED', message: '请先登录' })
}

/**
 * 看板接口统一失败日志
 *
 * Error.message 不是可枚举属性，只把 err 交给结构化日志会被 JSON 序列化吞掉，
 * 排查 SQL 缺陷时日志里只剩一个 SQLITE_ERROR；这里把报错文本显式拼进消息。
 */
function logDatabaseFailure(endpoint, err) {
  logger.error(`[teacherDashboard] ${endpoint} 失败: ${err.message}`, err)
}

// ---------------------------------------------------------------------------
// 路由处理函数
// ---------------------------------------------------------------------------

/**
 * GET /api/teacher/dashboard/overview?class_code=
 * 顶部概览卡片
 */
async function getOverview(req, res) {
  try {
    const parsed = overviewSchema.safeParse(req.query || {})
    if (!parsed.success) return handleZodError(res, parsed.error, '看板概览参数校验失败')

    const resolved = await resolveScope(req)
    if (resolved.error) {
      return res.status(401).json({ success: false, error: 'AUTH_REQUIRED', message: '请先登录' })
    }
    const narrowed = narrowScope(resolved, parsed.data.class_code)
    if (narrowed.error) return fail(res, narrowed.error)

    const scope = narrowed.scope
    const [roster, facts, total, last7] = await Promise.all([
      loadRoster(scope),
      loadFacts(scope),
      loadSubmissionStats(scope, 0),
      loadSubmissionStats(scope, ACTIVE_WINDOW_DAYS),
    ])
    const students = foldStudents(roster, facts)

    return res.json({
      success: true,
      data: {
        scope: scopeDescription(scope),
        summary: foldOverview(roster, students, total, last7),
        classes: foldClassSummary(roster, students),
      },
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    logDatabaseFailure('getOverview', err)
    return res.status(500).json({ success: false, error: 'DATABASE_ERROR', message: '查询失败' })
  }
}

/**
 * GET /api/teacher/dashboard/texts?class_code=
 * 篇目 × 班级完成矩阵
 */
async function getTextMatrix(req, res) {
  try {
    const parsed = textsSchema.safeParse(req.query || {})
    if (!parsed.success) return handleZodError(res, parsed.error, '篇目矩阵参数校验失败')

    const resolved = await resolveScope(req)
    if (resolved.error) {
      return res.status(401).json({ success: false, error: 'AUTH_REQUIRED', message: '请先登录' })
    }
    const narrowed = narrowScope(resolved, parsed.data.class_code)
    if (narrowed.error) return fail(res, narrowed.error)

    const scope = narrowed.scope
    const [roster, facts] = await Promise.all([loadRoster(scope), loadFacts(scope)])
    const matrix = foldTextMatrix(roster, facts)

    return res.json({
      success: true,
      data: { scope: scopeDescription(scope), ...matrix },
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    logDatabaseFailure('getTextMatrix', err)
    return res.status(500).json({ success: false, error: 'DATABASE_ERROR', message: '查询失败' })
  }
}

/**
 * GET /api/teacher/dashboard/students?class_code=&keyword=&sort=&order=&page=&page_size=
 * 学生明细（含三关分别进度、停滞天数）
 */
async function listStudentMetrics(req, res) {
  try {
    const parsed = studentsSchema.safeParse(req.query || {})
    if (!parsed.success) return handleZodError(res, parsed.error, '学生明细参数校验失败')

    const resolved = await resolveScope(req)
    if (resolved.error) {
      return res.status(401).json({ success: false, error: 'AUTH_REQUIRED', message: '请先登录' })
    }
    const narrowed = narrowScope(resolved, parsed.data.class_code)
    if (narrowed.error) return fail(res, narrowed.error)

    const scope = narrowed.scope
    const { keyword, sort, order, page, page_size: pageSize } = parsed.data
    const [roster, facts, last7] = await Promise.all([
      loadRoster(scope),
      loadFacts(scope),
      loadSubmissionStats(scope, ACTIVE_WINDOW_DAYS),
    ])
    let students = foldStudents(roster, facts)

    if (keyword) {
      const kw = keyword.toLowerCase()
      students = students.filter(
        (s) => s.student_id.toLowerCase().includes(kw) || String(s.student_name || '').toLowerCase().includes(kw),
      )
    }

    const direction = order === 'desc' ? -1 : 1
    students.sort((a, b) => {
      let cmp = 0
      if (sort === 'student_id') cmp = String(a.student_id).localeCompare(String(b.student_id))
      else if (sort === 'last_submitted_at') cmp = String(a.last_submitted_at || '').localeCompare(String(b.last_submitted_at || ''))
      else if (sort === 'stalled_days') cmp = (a.stalled_days ?? Number.MAX_SAFE_INTEGER) - (b.stalled_days ?? Number.MAX_SAFE_INTEGER)
      else cmp = Number(a[sort]) - Number(b[sort])
      if (cmp === 0) cmp = String(a.student_id).localeCompare(String(b.student_id))
      return cmp * direction
    })

    const totalItems = students.length
    const start = (page - 1) * pageSize
    const items = students.slice(start, start + pageSize)
    const summary = {
      student_count: totalItems,
      answered_student_count: students.filter((s) => !s.never_started).length,
      untouched_student_count: students.filter((s) => s.never_started).length,
      active_students_7d: last7.students,
      submissions_7d: last7.submissions,
    }

    return res.json({
      success: true,
      data: {
        scope: scopeDescription(scope),
        summary,
        pagination: { page, page_size: pageSize, total: totalItems, total_pages: Math.ceil(totalItems / pageSize) || 1 },
        students: items,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    logDatabaseFailure('listStudentMetrics', err)
    return res.status(500).json({ success: false, error: 'DATABASE_ERROR', message: '查询失败' })
  }
}

/**
 * GET /api/teacher/dashboard/weak-questions?class_code=&min_students=&limit=
 * 薄弱题 Top N（按最终答对率升序）
 */
async function listWeakQuestions(req, res) {
  try {
    const parsed = weakQuestionsSchema.safeParse(req.query || {})
    if (!parsed.success) return handleZodError(res, parsed.error, '薄弱题参数校验失败')

    const resolved = await resolveScope(req)
    if (resolved.error) {
      return res.status(401).json({ success: false, error: 'AUTH_REQUIRED', message: '请先登录' })
    }
    const narrowed = narrowScope(resolved, parsed.data.class_code)
    if (narrowed.error) return fail(res, narrowed.error)

    const scope = narrowed.scope
    const facts = await loadFacts(scope)
    const questions = foldWeakQuestions(facts, {
      minStudents: parsed.data.min_students,
      limit: parsed.data.limit,
    })

    return res.json({
      success: true,
      data: { scope: scopeDescription(scope), questions },
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    logDatabaseFailure('listWeakQuestions', err)
    return res.status(500).json({ success: false, error: 'DATABASE_ERROR', message: '查询失败' })
  }
}

/**
 * GET /api/teacher/dashboard/activity?class_code=&days=
 * 按日提交趋势 + 24 小时分布
 */
async function getActivity(req, res) {
  try {
    const parsed = activitySchema.safeParse(req.query || {})
    if (!parsed.success) return handleZodError(res, parsed.error, '活跃趋势参数校验失败')

    const resolved = await resolveScope(req)
    if (resolved.error) {
      return res.status(401).json({ success: false, error: 'AUTH_REQUIRED', message: '请先登录' })
    }
    const narrowed = narrowScope(resolved, parsed.data.class_code)
    if (narrowed.error) return fail(res, narrowed.error)

    const scope = narrowed.scope
    const days = parsed.data.days
    const [daily, hourly] = await Promise.all([loadDailyActivity(scope, days), loadHourlyActivity(scope, days)])

    return res.json({
      success: true,
      data: {
        scope: scopeDescription(scope),
        days,
        daily,
        hourly,
        totals: {
          submissions: daily.reduce((sum, d) => sum + d.submissions, 0),
          peak_date: daily.reduce((best, d) => (d.submissions > (best?.submissions ?? -1) ? d : best), null)?.date ?? null,
          peak_hour: hourly.reduce((best, h) => (h.submissions > (best?.submissions ?? -1) ? h : best), null)?.hour ?? null,
        },
      },
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    logDatabaseFailure('getActivity', err)
    return res.status(500).json({ success: false, error: 'DATABASE_ERROR', message: '查询失败' })
  }
}

module.exports = {
  getOverview,
  getTextMatrix,
  listStudentMetrics,
  listWeakQuestions,
  getActivity,
  // 导出口径函数供单测直接验证（不改变路由行为）
  _internals: {
    resolveScope,
    narrowScope,
    foldStudents,
    foldClassSummary,
    foldTextMatrix,
    foldWeakQuestions,
    classifyQuestionLevel,
  },
}
