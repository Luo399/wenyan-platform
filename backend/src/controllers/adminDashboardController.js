/**
 * 管理员数据看板 Controller
 *
 * 定位：回答「整个平台跑得怎么样、哪些学校班级挂了名不用、有多少账号待我处理」。
 * 范围是全校，不做班级收窄；鉴权走 requireRole(['admin', 'super_admin'])，
 * 与明文密码的 /api/home/dashboard、/api/tracking/* 是两套体系（后者本轮不接入）。
 *
 * 统计口径：
 * - 每题最后一次作答（attempt_number 最大）代表该生该题的最终掌握情况，与教师看板一致；
 *   平台总提交量另按 answers 原始行数统计。
 * - 活跃学生 DAU/WAU/MAU = 最近 1/7/30 天内有提交过的去重学生数（以 answers 为准，
 *   不依赖埋点表，因此「活跃」的定义是「真的答了题」）。
 * - 使用率 usage_rate = 活跃学生数 / 该分组学生数。
 * - overall_accuracy = 按题次汇总的整体正确率（答对题次 / 已答题次）。
 *   故意不叫 avg_accuracy：教师看板的 avg_accuracy 是「每个学生正确率的平均」，
 *   平台侧按题次汇总才不会被只答过一题的学生带偏，两边字段名区分开避免误读。
 * - 年级取班级编码前 4 位（入学年份），见 teacherController 的 CLASS_CODE_REGEX。
 * - 待审批教师 = teachers.status = 'pending'，前端点击直接进审批列表。
 * - 播种数据：initAllTables 在非生产环境会插入「测试学生 99999999 / 班级 999999」，
 *   全校口径的 accounts/usage 统计包含它，跨班级断言要按此基线算。
 */

const { z } = require('zod')
const { handleZodError } = require('../middleware/validate')
const { db } = require('../config/database')
const { dbAll, dbGet } = require('../utils/dbPromise')
const logger = require('../utils/logger')
const { getInventory } = require('../utils/questionInventory')
const dq = require('../utils/dashboardQuery')

/**
 * 每题只留最后一次作答的行
 *
 * 用 MAX(id) 而不是 MAX(attempt_number)：
 * - attempt_number 允许为 NULL（历史数据/直接写库的测试数据），
 *   一旦全为 NULL，`a.attempt_number = top.max_attempt` 恒不成立，该生所有记录会被静默丢掉；
 * - id 自增，每 (student_id, question_id) 恰好命中一行，不会出现同 attempt 号并存的重复计数。
 * 与教师看板 JS 侧「同题取最后一次作答」是同一个口径。
 */
const LAST_ATTEMPT_JOIN = `
  INNER JOIN (
    SELECT MAX(id) AS last_id
    FROM answers
    GROUP BY student_id, question_id
  ) top ON top.last_id = a.id
`

const trendsSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
})

const distributionSchema = z.object({
  dimension: z.enum(['school', 'grade', 'class']).default('class'),
  window_days: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

// ---------------------------------------------------------------------------
// 装载
// ---------------------------------------------------------------------------

/**
 * 账号与结构计数
 */
async function loadAccountStats() {
  const [teachers, students, schools, classes, admins] = await Promise.all([
    dbAll(db, `SELECT status, COUNT(*) AS count FROM teachers GROUP BY status`),
    dbGet(db, `SELECT COUNT(*) AS count FROM students`),
    dbGet(db, `SELECT COUNT(*) AS count FROM schools`),
    // 单行聚合必须用 dbGet：dbAll 返回数组，classes.count 恒为 undefined → 班级数显示 0
    dbGet(db, `SELECT COUNT(DISTINCT class_code) AS count FROM students`),
    dbGet(db, `SELECT COUNT(*) AS count FROM admins`),
  ])

  const statusCount = { active: 0, pending: 0, disabled: 0, rejected: 0 }
  for (const row of teachers || []) {
    if (Object.prototype.hasOwnProperty.call(statusCount, row.status)) {
      statusCount[row.status] = Number(row.count)
    }
  }

  return {
    teacher_total: Object.values(statusCount).reduce((sum, n) => sum + n, 0),
    teacher_status: statusCount,
    pending_teacher_count: statusCount.pending,
    student_total: Number(students?.count || 0),
    school_count: Number(schools?.count || 0),
    class_count: Number(classes?.count || 0),
    admin_count: Number(admins?.count || 0),
  }
}

/**
 * 每题最后一次作答的按学生聚合结果（全平台）
 * @returns {Promise<Map<string,{answered:number,correct:number,last:string,class_code:string,school_id:number}>>}
 */
async function loadStudentAnswerMap() {
  const rows = await dbAll(
    db,
    `SELECT a.student_id AS student_id,
            COUNT(*) AS answered,
            SUM(a.is_correct) AS correct,
            MAX(a.submitted_at) AS last_submitted_at,
            s.class_code AS class_code,
            s.school_id AS school_id
     FROM answers a
     ${LAST_ATTEMPT_JOIN}
     INNER JOIN students s ON s.student_id = a.student_id
     GROUP BY a.student_id`,
  )
  const map = new Map()
  for (const row of rows) {
    map.set(row.student_id, {
      answered: Number(row.answered) || 0,
      correct: Number(row.correct) || 0,
      last_submitted_at: row.last_submitted_at || null,
      class_code: row.class_code,
      school_id: row.school_id,
    })
  }
  return map
}

/**
 * 窗口内有提交的去重学生数
 */
async function countActiveStudents(days) {
  const row = await dbGet(
    db,
    `SELECT COUNT(DISTINCT student_id) AS count FROM answers WHERE date(submitted_at) >= date('now', ?)`,
    [dq.sqliteWindow(days)],
  )
  return Number(row?.count || 0)
}

/**
 * 提交总量（原始行，不去重）
 */
async function countSubmissions(days) {
  if (!days) {
    const row = await dbGet(db, `SELECT COUNT(*) AS count FROM answers`)
    return Number(row?.count || 0)
  }
  const row = await dbGet(
    db,
    `SELECT COUNT(*) AS count FROM answers WHERE date(submitted_at) >= date('now', ?)`,
    [dq.sqliteWindow(days)],
  )
  return Number(row?.count || 0)
}

function labelOfSchool(schoolMap, schoolId) {
  if (schoolId === null || schoolId === undefined) return '未分配学校'
  const hit = schoolMap.get(Number(schoolId))
  if (!hit) return `学校#${schoolId}`
  return hit.name || hit.code || `学校#${schoolId}`
}

/**
 * 看板接口统一失败日志
 *
 * Error.message 不是可枚举属性，只把 err 交给结构化日志会被 JSON 序列化吞掉，
 * 排查 SQL 缺陷时日志里只剩一个 SQLITE_ERROR；这里把报错文本显式拼进消息。
 */
function logDatabaseFailure(endpoint, err) {
  logger.error(`[adminDashboard] ${endpoint} 失败: ${err.message}`, err)
}

// ---------------------------------------------------------------------------
// 路由处理函数
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/dashboard/overview
 * 运营概览：账号结构 + 使用总量 + 活跃度 + 待办
 */
async function getOverview(req, res) {
  try {
    const [accounts, answerMap, submissionsTotal, submissions7d, dau, wau, mau, submissions30d] =
      await Promise.all([
        loadAccountStats(),
        loadStudentAnswerMap(),
        countSubmissions(0),
        countSubmissions(7),
        countActiveStudents(1),
        countActiveStudents(7),
        countActiveStudents(30),
        countSubmissions(30),
      ])

    const inventory = getInventory()
    const [roster, stillDefaultPassword] = await Promise.all([
      dbAll(db, `SELECT student_id, class_code FROM students`),
      dbGet(db, `SELECT COUNT(*) AS count FROM students WHERE must_reset_password = 1`),
    ])
    const answeredStudents = roster.filter((s) => (answerMap.get(s.student_id)?.answered || 0) > 0)
    const accuracySum = answeredStudents.reduce(
      (sum, s) => sum + (answerMap.get(s.student_id)?.correct || 0),
      0,
    )
    const answeredSum = answeredStudents.reduce(
      (sum, s) => sum + (answerMap.get(s.student_id)?.answered || 0),
      0,
    )
    const completionSum = roster.reduce(
      (sum, s) => sum + dq.percent(answerMap.get(s.student_id)?.answered || 0, inventory.totals.total),
      0,
    )

    return res.json({
      success: true,
      data: {
        accounts,
        usage: {
          student_total: roster.length,
          answered_student_count: answeredStudents.length,
          untouched_student_count: roster.length - answeredStudents.length,
          activation_rate: dq.percent(answeredStudents.length, roster.length),
          // 按题次汇总的整体正确率（不是「学生平均正确率的平均」，后者会被裸答一两题的学生拉偏）
          overall_accuracy: dq.percent(accuracySum, answeredSum),
          avg_completion_rate: roster.length ? dq.round1(completionSum / roster.length) : 0,
          total_questions_per_student: inventory.totals.total,
          text_count: inventory.texts.length,
        },
        submissions: {
          total: submissionsTotal,
          last_7_days: submissions7d,
          last_30_days: submissions30d,
        },
        activity: { dau, wau, mau },
        todos: {
          pending_teacher_count: accounts.pending_teacher_count,
          students_on_default_password: Number(stillDefaultPassword?.count || 0),
        },
      },
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    logDatabaseFailure('getOverview', err)
    return res.status(500).json({ success: false, error: 'DATABASE_ERROR', message: '查询失败' })
  }
}

/**
 * GET /api/admin/dashboard/trends?days=30
 * 增长与使用趋势：新增学生 / 新增教师 / 提交量 / 活跃学生（补齐空日）
 */
async function getTrends(req, res) {
  try {
    const parsed = trendsSchema.safeParse(req.query || {})
    if (!parsed.success) return handleZodError(res, parsed.error, '趋势参数校验失败')
    const days = parsed.data.days

    const window = dq.sqliteWindow(days)
    const [studentRows, teacherRows, submissionRows, activeRows] = await Promise.all([
      dbAll(
        db,
        `SELECT strftime('%Y-%m-%d', created_at) AS date, COUNT(*) AS count FROM students
         WHERE date(created_at) >= date('now', ?) GROUP BY date`,
        [window],
      ),
      dbAll(
        db,
        `SELECT strftime('%Y-%m-%d', created_at) AS date, COUNT(*) AS count FROM teachers
         WHERE date(created_at) >= date('now', ?) GROUP BY date`,
        [window],
      ),
      dbAll(
        db,
        `SELECT strftime('%Y-%m-%d', submitted_at) AS date, COUNT(*) AS count FROM answers
         WHERE date(submitted_at) >= date('now', ?) GROUP BY date`,
        [window],
      ),
      dbAll(
        db,
        `SELECT strftime('%Y-%m-%d', submitted_at) AS date, COUNT(DISTINCT student_id) AS count
         FROM answers WHERE date(submitted_at) >= date('now', ?) GROUP BY date`,
        [window],
      ),
    ])

    const toMap = (rows) => new Map(rows.map((r) => [r.date, Number(r.count)]))
    const studentsMap = toMap(studentRows)
    const teachersMap = toMap(teacherRows)
    const submissionsMap = toMap(submissionRows)
    const activeMap = toMap(activeRows)

    const series = dq.recentDateKeys(days).map((date) => ({
      date,
      new_students: studentsMap.get(date) || 0,
      new_teachers: teachersMap.get(date) || 0,
      submissions: submissionsMap.get(date) || 0,
      active_students: activeMap.get(date) || 0,
    }))

    const sum = (key) => series.reduce((total, item) => total + item[key], 0)

    return res.json({
      success: true,
      data: {
        days,
        series,
        totals: {
          new_students: sum('new_students'),
          new_teachers: sum('new_teachers'),
          submissions: sum('submissions'),
        },
      },
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    logDatabaseFailure('getTrends', err)
    return res.status(500).json({ success: false, error: 'DATABASE_ERROR', message: '查询失败' })
  }
}

/**
 * GET /api/admin/dashboard/distribution?dimension=class|grade|school&window_days=30&limit=50
 * 结构分布与覆盖率：哪些学校/年级/班级在用、哪些挂了名不用
 */
async function getDistribution(req, res) {
  try {
    const parsed = distributionSchema.safeParse(req.query || {})
    if (!parsed.success) return handleZodError(res, parsed.error, '分布参数校验失败')
    const { dimension, window_days: windowDays, limit } = parsed.data

    const [roster, answerMap, schoolRows] = await Promise.all([
      dbAll(db, `SELECT student_id, class_code, school_id FROM students`),
      loadStudentAnswerMap(),
      dbAll(db, `SELECT id, code, name FROM schools`),
    ])
    const schoolMap = new Map(schoolRows.map((s) => [Number(s.id), s]))
    const inventory = getInventory()
    const groups = new Map()

    for (const student of roster) {
      let key
      let label
      if (dimension === 'school') {
        key = String(student.school_id ?? 'none')
        label = labelOfSchool(schoolMap, student.school_id)
      } else if (dimension === 'grade') {
        key = dq.gradeOfClassCode(student.class_code)
        label = `${key} 级`
      } else {
        key = student.class_code || '未分班'
        label = student.class_code || '未分班'
      }

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label,
          student_count: 0,
          answered_student_count: 0,
          active_student_count: 0,
          submissions: 0,
          correct: 0,
          completionSum: 0,
        })
      }
      const group = groups.get(key)
      const stat = answerMap.get(student.student_id)
      group.student_count += 1
      const answered = stat?.answered || 0
      group.submissions += answered
      group.correct += stat?.correct || 0
      group.completionSum += dq.percent(answered, inventory.totals.total)
      if (answered > 0) group.answered_student_count += 1
      if (dq.isWithinWindow(stat?.last_submitted_at, windowDays)) {
        group.active_student_count += 1
      }
    }

    const rows = [...groups.values()]
      .sort((a, b) => b.student_count - a.student_count || String(a.key).localeCompare(String(b.key)))
      .slice(0, limit)
      .map((group) => ({
        key: group.key,
        label: group.label,
        student_count: group.student_count,
        answered_student_count: group.answered_student_count,
        active_student_count: group.active_student_count,
        usage_rate: dq.percent(group.active_student_count, group.student_count),
        activation_rate: dq.percent(group.answered_student_count, group.student_count),
        overall_accuracy: dq.percent(group.correct, group.submissions),
        avg_completion_rate: group.student_count ? dq.round1(group.completionSum / group.student_count) : 0,
        submissions: group.submissions,
        window_days: windowDays,
      }))

    return res.json({
      success: true,
      data: {
        dimension,
        window_days: windowDays,
        total_questions: inventory.totals.total,
        groups: rows,
        uncovered: rows.filter((r) => r.answered_student_count === 0).map((r) => r.key),
      },
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    logDatabaseFailure('getDistribution', err)
    return res.status(500).json({ success: false, error: 'DATABASE_ERROR', message: '查询失败' })
  }
}

module.exports = {
  getOverview,
  getTrends,
  getDistribution,
  // 供单测直接验证内部逻辑，不影响路由行为
  _internals: { loadAccountStats, loadStudentAnswerMap, LAST_ATTEMPT_JOIN },
}
