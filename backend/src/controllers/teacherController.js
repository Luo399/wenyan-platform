const { z } = require('zod')
const { db } = require('../config/database')
const { dbGet, dbRun, dbAll } = require('../utils/dbPromise')
const logger = require('../utils/logger')
const {
  getDefaultPasswordHash,
  extractClassCode,
  teacherCanManageClass,
  getTeacherClassCodes,
  resetStudentPassword,
  DEFAULT_STUDENT_PASSWORD,
} = require('../services/authService')

// 统一格式正则
// 学号：严格 8 位纯数字
const STUDENT_ID_REGEX = /^\d{8}$/

// 班级编码：4 位年级 + 2 位班级序号（01-31）
const CLASS_CODE_REGEX = /^\d{4}(0[1-9]|[1-2]\d|3[0-1])$/

// 安全：查询学生时剔除 password_hash（哈希不应暴露给前端）
const STUDENT_SAFE_COLUMNS =
  'id, student_id, student_name, class_code, school_id, must_reset_password, created_by, created_at, updated_at'

// 参数校验 Schema
const createStudentSchema = z.object({
  student_id: z
    .string()
    .regex(STUDENT_ID_REGEX, '学号必须为 8 位纯数字（格式 YYYYNNNN）'),
  student_name: z.string().min(1, '姓名必填').max(20, '姓名不能超过 20 字符'),
})

const updateStudentSchema = z.object({
  student_name: z.string().min(1, '姓名必填').max(20, '姓名不能超过 20 字符').optional(),
})

const batchCreateSchema = z.array(
  z.object({
    student_id: z
      .string()
      .regex(STUDENT_ID_REGEX, '学号必须为 8 位纯数字（格式 YYYYNNNN）'),
    student_name: z.string().min(1, '姓名必填').max(20, '姓名不能超过 20 字符'),
  }),
)

/**
 * 根据 req.user.teacher_id: 在 requireAuthMiddleware 后的 user.phone 不够用，先查 teachers.id
 */
async function resolveTeacherId(req) {
  if (!req.user || !req.user.phone) return null
  const t = await dbGet(db, 'SELECT id FROM teachers WHERE phone = ?', [req.user.phone])
  return t ? t.id : null
}

/**
 * 获取当前登录教师所教班级编码集合
 */
async function getMyClassCodes(teacherId) {
  return getTeacherClassCodes(teacherId)
}

/**
 * 教师查自己所教班级学生列表，支持按 class_code 过滤
 * GET /api/teacher/students?class_code=202409
 */
async function listStudents(req, res) {
  try {
    const teacherId = await resolveTeacherId(req)
    if (!teacherId) {
      return res.status(401).json({ success: false, error: 'AUTH_REQUIRED', message: '请先登录' })
    }
    const classCodes = await getMyClassCodes(teacherId)
    if (classCodes.length === 0) {
      return res.status(200).json({ success: true, data: [] })
    }
    const { class_code } = req.query
    let sql = `SELECT ${STUDENT_SAFE_COLUMNS} FROM students WHERE class_code IN (${classCodes
      .map(() => '?')
      .join(',')})`
    const params = [...classCodes]
    if (class_code) {
      if (!classCodes.includes(class_code)) {
        // 越权请求不属于自己的班级
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: '无权查看该班级学生' })
      }
      sql += ` AND class_code = ?`
      params.push(class_code)
    }
    sql += ` ORDER BY class_code ASC, student_id ASC`
    const rows = await dbAll(db, sql, params)
    res.status(200).json({ success: true, data: rows })
  } catch (err) {
    logger.error('[teacher] 查询学生列表失败:', err)
    res.status(500).json({ success: false, error: 'DATABASE_ERROR', message: '查询失败' })
  }
}

/**
 * 教师查看单个学生详情（仅能查自己班级的）
 */
async function getStudent(req, res) {
  try {
    const teacherId = await resolveTeacherId(req)
    if (!teacherId) {
      return res.status(401).json({ success: false, error: 'AUTH_REQUIRED', message: '请先登录' })
    }
    const student = await dbGet(db, `SELECT ${STUDENT_SAFE_COLUMNS} FROM students WHERE student_id = ?`, [
      req.params.studentId])
    if (!student) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: '学生不存在' })
    }
    const ok = await teacherCanManageClass(teacherId, student.class_code)
    if (!ok) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: '无权查看该学生',
      })
    }
    res.status(200).json({ success: true, data: student })
  } catch (err) {
    logger.error('[teacher] 查询学生失败:', err)
    res.status(500).json({ success: false, error: 'DATABASE_ERROR', message: '查询失败' })
  }
}

/**
 * 校验学生数据写入：学生必须属于教师所教班级
 */
async function _enforceClassPermission(teacherId, studentId) {
  const classCode = extractClassCode(studentId)
  if (!classCode) return { ok: false, code: 'INVALID_STUDENT_ID', msg: '学号格式不正确，至少 6 位' }
  if (!CLASS_CODE_REGEX.test(classCode)) return { ok: false, code: 'INVALID_CLASS_CODE', msg: '班级编码格式不正确（需 6 位 YYYYCC，CC 范围 01-31）' }
  const can = await teacherCanManageClass(teacherId, classCode)
  if (!can) {
    return { ok: false, code: 'CLASS_NOT_ALLOWED', msg: '只能添加所教班级的学生（学号前 6 位必须是自己的班级）' }
  }
  return { ok: true, classCode }
}

/**
 * 教师添加单个学生
 */
async function createStudent(req, res) {
  try {
    const teacherId = await resolveTeacherId(req)
    if (!teacherId) {
      return res.status(401).json({ success: false, error: 'AUTH_REQUIRED', message: '请先登录' })
    }
    const body = createStudentSchema.parse(req.body)
    const perm = await _enforceClassPermission(teacherId, body.student_id)
    if (!perm.ok) {
      return res.status(403).json({ success: false, error: perm.code, message: perm.msg })
    }
    const now = new Date().toISOString()
    const passwordHash = await getDefaultPasswordHash()
    try {
      await dbRun(
        db,
        `INSERT INTO students
          (student_id, student_name, class_code, school_id,
           password_hash, must_reset_password, created_by,
           created_at, updated_at)
         VALUES (?, ?, ?, NULL, ?, 1, ?, ?, ?)`,
        [
          body.student_id,
          body.student_name,
          perm.classCode,
          passwordHash,
          'teacher:' + req.user.phone,
          now,
          now,
        ],
      )
    } catch (insertErr) {
      const msg = String((insertErr && insertErr.message) || '')
      if (msg.includes('UNIQUE') || msg.includes('unique')) {
        return res.status(409).json({
          success: false,
          error: 'STUDENT_ID_EXISTS',
          message: '该学号已存在',
        })
      }
      throw insertErr
    }
    res.status(201).json({ success: true, message: `学生添加成功，初始密码 ${DEFAULT_STUDENT_PASSWORD}` })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: err.issues.map((i) => i.message).join('；'),
      })
    }
    logger.error('[teacher] 添加学生失败:', err)
    res.status(500).json({ success: false, error: 'DATABASE_ERROR', message: '创建失败' })
  }
}

/**
 * 教师批量添加学生（数组）
 * 返回每一条成功/失败结果，方便 Excel 批量导入后调用）
 */
async function batchCreateStudents(req, res) {
  try {
    const teacherId = await resolveTeacherId(req)
    if (!teacherId) {
      return res.status(401).json({ success: false, error: 'AUTH_REQUIRED', message: '请先登录' })
    }
    const list = batchCreateSchema.parse(req.body.students || req.body)
    const now = new Date().toISOString()
    const passwordHash = await getDefaultPasswordHash()
    const results = []
    for (const item of list) {
      const perm = await _enforceClassPermission(teacherId, item.student_id)
      if (!perm.ok) {
        results.push({ ...item, success: false, error: perm.msg })
        continue
      }
      try {
        await dbRun(
          db,
          `INSERT INTO students
            (student_id, student_name, class_code, school_id,
             password_hash, must_reset_password, created_by,
             created_at, updated_at)
           VALUES (?, ?, ?, NULL, ?, 1, ?, ?, ?)`,
          [
            item.student_id,
            item.student_name,
            perm.classCode,
            passwordHash,
            'excel:' + req.user.phone,
            now,
            now,
          ],
        )
        results.push({ ...item, success: true })
      } catch (insertErr) {
        const msg = String((insertErr && insertErr.message) || '')
        if (msg.includes('UNIQUE') || msg.includes('unique')) {
          results.push({ ...item, success: false, error: '学号已存在' })
        } else {
          results.push({ ...item, success: false, error: msg || '数据库错误' })
        }
      }
    }
    const successCount = results.filter((r) => r.success).length
    res.status(200).json({
      success: true,
      data: {
        total: list.length,
        success_count: successCount,
        fail_count: list.length - successCount,
        initial_password: DEFAULT_STUDENT_PASSWORD,
        details: results,
      },
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: err.issues.map((i) => i.message).join('；'),
      })
    }
    logger.error('[teacher] 批量添加学生失败:', err)
    res.status(500).json({ success: false, error: 'DATABASE_ERROR', message: '批量创建失败' })
  }
}

/**
 * 教师更新学生姓名
 */
async function updateStudent(req, res) {
  try {
    const teacherId = await resolveTeacherId(req)
    if (!teacherId) {
      return res.status(401).json({ success: false, error: 'AUTH_REQUIRED', message: '请先登录' })
    }
    const student = await dbGet(db, `SELECT ${STUDENT_SAFE_COLUMNS} FROM students WHERE student_id = ?`, [req.params.studentId])
    if (!student) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: '学生不存在' })
    }
    const ok = await teacherCanManageClass(teacherId, student.class_code)
    if (!ok) {
      return res.status(403).json({ success: false, error: 'FORBIDDEN', message: '无权修改该学生' })
    }
    const body = updateStudentSchema.parse(req.body)
    await dbRun(db, 'UPDATE students SET student_name = ?, updated_at = ? WHERE student_id = ?', [
      body.student_name ?? student.student_name,
      new Date().toISOString(),
      req.params.studentId,
    ])
    res.status(200).json({ success: true, message: '学生信息更新成功' })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: err.issues.map((i) => i.message).join('；'),
      })
    }
    logger.error('[teacher] 更新学生失败:', err)
    res.status(500).json({ success: false, error: 'DATABASE_ERROR', message: '更新失败' })
  }
}

/**
 * 教师重置学生密码为 DEFAULT_STUDENT_PASSWORD (99999999)
 */
async function resetStudent(req, res) {
  try {
    const teacherId = await resolveTeacherId(req)
    if (!teacherId) {
      return res.status(401).json({ success: false, error: 'AUTH_REQUIRED', message: '请先登录' })
    }
    const student = await dbGet(db, `SELECT ${STUDENT_SAFE_COLUMNS} FROM students WHERE student_id = ?`, [req.params.studentId])
    if (!student) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: '学生不存在' })
    }
    const ok = await teacherCanManageClass(teacherId, student.class_code)
    if (!ok) {
      return res.status(403).json({
      success: false,
        error: 'FORBIDDEN',
        message: '无权重置该学生密码',
      })
    }
    const r = await resetStudentPassword(req.params.studentId, 'teacher', req.user.phone)
    if (!r.success) {
      return res.status(500).json({
        success: false,
        error: r.reason || 'RESET_FAILED',
        message: '重置失败',
      })
    }
    res.status(200).json({
      success: true,
      message: `密码已重置为 ${DEFAULT_STUDENT_PASSWORD}`,
      data: { temporary_password: DEFAULT_STUDENT_PASSWORD },
    })
  } catch (err) {
    logger.error('[teacher] 重置学生密码失败:', err)
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '重置失败',
    })
  }
}

/**
 * 教师删除本班学生账号
 * DELETE /api/teacher/students/:studentId
 *
 * 权限：复用 teacherCanManageClass，仅能删除自己所教班级的学生
 */
async function deleteStudent(req, res) {
  try {
    const teacherId = await resolveTeacherId(req)
    if (!teacherId) {
      return res.status(401).json({ success: false, error: 'AUTH_REQUIRED', message: '请先登录' })
    }
    // 先查学生，确认存在并拿到其班级编码用于鉴权
    const student = await dbGet(
      db,
      `SELECT ${STUDENT_SAFE_COLUMNS} FROM students WHERE student_id = ?`,
      [req.params.studentId],
    )
    if (!student) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: '学生不存在' })
    }
    const ok = await teacherCanManageClass(teacherId, student.class_code)
    if (!ok) {
      return res.status(403).json({ success: false, error: 'FORBIDDEN', message: '无权删除该学生' })
    }
    const info = await dbRun(db, 'DELETE FROM students WHERE student_id = ?', [req.params.studentId])
    if (!info || info.changes === 0) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: '学生不存在' })
    }
    res.status(200).json({ success: true, message: '学生账号已删除' })
  } catch (err) {
    logger.error('[teacher] 删除学生失败:', err)
    res.status(500).json({ success: false, error: 'DATABASE_ERROR', message: '删除失败' })
  }
}

/**
 * 教师查看所教班级学生的完成情况
 * GET /api/teacher/completion/students?class_code=202501
 *
 * 说明：先拉取教师所教班级学生名单，再 LEFT JOIN answers 聚合真实统计。
 *   统计口径：每个学生在 answers 表里的总行数 = 已答题数；
 *   同一道题多次答题取 attempt_number 最大的那一行判定正误，避免"做对了又做错"被算两次。
 */
async function getStudentsCompletion(req, res) {
  try {
    const teacherId = await resolveTeacherId(req)
    if (!teacherId) {
      return res.status(401).json({ success: false, error: 'AUTH_REQUIRED', message: '请先登录' })
    }
    const classCodes = await getMyClassCodes(teacherId)
    if (classCodes.length === 0) {
      return res.status(200).json({
        success: true,
        data: { metrics_ready: true, summary: { student_count: 0, avg_accuracy: 0 }, students: [] },
      })
    }

    const { class_code } = req.query
    if (class_code && !classCodes.includes(class_code)) {
      return res.status(403).json({ success: false, error: 'FORBIDDEN', message: '无权查看该班级学生' })
    }

    const effectiveClasses = class_code ? [class_code] : classCodes

    let sql = `SELECT ${STUDENT_SAFE_COLUMNS} FROM students WHERE class_code IN (${effectiveClasses
      .map(() => '?')
      .join(',')})`
    sql += ` ORDER BY class_code ASC, student_id ASC`
    const rows = await dbAll(db, sql, effectiveClasses)

    // 收集所有 student_id，用子查询去重算每道题 attempt_number 最大的那一行
    const studentIds = rows.map((r) => r.student_id)
    const statsMap = {}
    if (studentIds.length > 0) {
      const aggRows = await dbAll(
        db,
        `SELECT a.student_id,
          COUNT(*) AS answered_questions,
          SUM(a.is_correct) AS correct_count,
          ROUND(AVG(a.is_correct) * 100, 1) AS accuracy,
          MAX(a.submitted_at) AS last_submitted_at
         FROM answers a
         INNER JOIN (
           SELECT student_id, question_id, MAX(attempt_number) AS max_attempt
           FROM answers
           WHERE student_id IN (${studentIds.map(() => '?').join(',')})
           GROUP BY student_id, question_id
         ) top ON a.student_id = top.student_id AND a.question_id = top.question_id
              AND a.attempt_number = top.max_attempt
         WHERE a.student_id IN (${studentIds.map(() => '?').join(',')})
         GROUP BY a.student_id`,
        [...studentIds, ...studentIds],
      )
      for (const r of aggRows) {
        statsMap[r.student_id] = r
      }
    }

    const students = rows.map((row) => {
      const stat = statsMap[row.student_id]
      return {
        ...row,
        total_questions: 0,
        answered_questions: stat?.answered_questions ?? 0,
        correct_count: stat?.correct_count ?? 0,
        accuracy: stat?.accuracy ?? 0,
        last_submitted_at: stat?.last_submitted_at ?? null,
      }
    })

    // summary: 覆盖所有教师所教班级（未指定 class_code 时）
    let summary
    if (class_code) {
      summary = {
        student_count: students.length,
        avg_accuracy: students.length === 0 ? 0
          : Math.round(students.reduce((s, x) => s + (x.accuracy || 0), 0) / students.length * 10) / 10,
      }
    } else {
      const allRows = await dbAll(
        db,
        `SELECT student_id FROM students WHERE class_code IN (${classCodes.map(() => '?').join(',')})`,
        classCodes,
      )
      const allStatsMap = {}
      const allStudentIds = allRows.map((r) => r.student_id)
      if (allStudentIds.length > 0) {
        const allAgg = await dbAll(
          db,
          `SELECT a.student_id,
            COUNT(*) AS answered_questions,
            SUM(a.is_correct) AS correct_count,
            ROUND(AVG(a.is_correct) * 100, 1) AS accuracy
           FROM answers a
           INNER JOIN (
             SELECT student_id, question_id, MAX(attempt_number) AS max_attempt
             FROM answers
             WHERE student_id IN (${allStudentIds.map(() => '?').join(',')})
             GROUP BY student_id, question_id
           ) top ON a.student_id = top.student_id AND a.question_id = top.question_id
                AND a.attempt_number = top.max_attempt
           WHERE a.student_id IN (${allStudentIds.map(() => '?').join(',')})
           GROUP BY a.student_id`,
          [...allStudentIds, ...allStudentIds],
        )
        for (const r of allAgg) allStatsMap[r.student_id] = r
      }
      summary = {
        student_count: allRows.length,
        avg_accuracy: allRows.length === 0 ? 0
          : Math.round(
              allRows.reduce((s, x) => s + (allStatsMap[x.student_id]?.accuracy || 0), 0) / allRows.length * 10,
            ) / 10,
      }
    }

    res.status(200).json({
      success: true,
      data: {
        metrics_ready: true,
        summary,
        class_codes: classCodes,
        students,
      },
    })
  } catch (err) {
    logger.error('[teacher] 查询学生完成情况失败:', err)
    res.status(500).json({ success: false, error: 'DATABASE_ERROR', message: '查询失败' })
  }
}

module.exports = {
  listStudents,
  getStudent,
  createStudent,
  batchCreateStudents,
  updateStudent,
  resetStudent,
  deleteStudent,
  getStudentsCompletion,
}
