/**
 * 数据看板控制器
 * 提供系统跟踪数据，供前端看板展示
 */
const { db } = require('../config/database')
const { dbGet, dbAll } = require('../utils/dbPromise')
const logger = require('../utils/logger')

/**
 * 获取看板概览统计数据
 * GET /api/home/dashboard
 */
async function getDashboard(req, res, next) {
  try {
    const [studentCount, submissionCount, recentSubmissions, dbStats] = await Promise.all([
      // 学生总数
      dbGet(db, 'SELECT COUNT(*) AS count FROM students'),
      // 答题总数
      dbGet(db, 'SELECT COUNT(*) AS count FROM answers'),
      // 最近 50 条提交记录
      dbAll(
        db,
        'SELECT a.*, st.student_name AS student_name FROM answers a LEFT JOIN students st ON a.student_id = st.student_id ORDER BY a.submitted_at DESC LIMIT 50',
      ),
      // 数据库统计
      dbAll(
        db,
        "SELECT strftime('%Y-%m-%d', submitted_at) AS date, COUNT(*) AS count FROM answers GROUP BY date ORDER BY date DESC LIMIT 14",
      ),
    ])

    // 计算通过率
    const passedCount = recentSubmissions.filter(r => r.score > 0).length
    const passRate = recentSubmissions.length > 0
      ? Math.round((passedCount / recentSubmissions.length) * 100)
      : 0

    // 计算平均分
    const totalScore = recentSubmissions.reduce((sum, r) => sum + (r.score || 0), 0)
    const avgScore = recentSubmissions.length > 0
      ? Math.round(totalScore / recentSubmissions.length)
      : 0

    res.json({
      success: true,
      data: {
        summary: {
          studentCount: studentCount?.count || 0,
          submissionCount: submissionCount?.count || 0,
          passRate,
          avgScore,
        },
        submissions: recentSubmissions.map(r => ({
          id: r.id,
          studentId: r.student_id,
          studentName: r.student_name || '',
          wenId: r.wen_id,
          questionId: r.question_id,
          userAnswer: r.user_answer,
          correctAnswer: r.correct_answer,
          score: r.score,
          submittedAt: r.submitted_at,
        })),
        dailyStats: dbStats.map(d => ({
          date: d.date,
          count: d.count,
        })),
      },
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    logger.error('获取看板数据失败:', err)
    next(err)
  }
}

/**
 * 获取看板原始数据（无加工，供前端自行处理）
 * GET /api/home/dashboard/raw
 */
async function getRawData(req, res, next) {
  try {
    const data = await dbAll(
      db,
      'SELECT * FROM answers ORDER BY submitted_at DESC LIMIT 200',
    )

    res.json({
      success: true,
      data: data.map(r => ({
        id: r.id,
        studentId: r.student_id,
        wenId: r.wen_id,
        questionId: r.question_id,
        userAnswer: r.user_answer,
        correctAnswer: r.correct_answer,
        score: r.score,
        submittedAt: r.submitted_at,
      })),
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    logger.error('获取原始数据失败:', err)
    next(err)
  }
}

module.exports = {
  getDashboard,
  getRawData,
}