const studentController = require('../controllers/studentController')
const textsController = require('../controllers/textsController')
const answerController = require('../controllers/answerController')
const authController = require('../controllers/authController')
const teacherController = require('../controllers/teacherController')
const adminController = require('../controllers/adminController')
const dashboardController = require('../controllers/dashboardController')
const trackingController = require('../controllers/trackingController')
const trackingAnalysisController = require('../controllers/trackingAnalysisController')
const exportController = require('../controllers/exportController')
const { optionalAuthMiddleware, requireAuthMiddleware, requireRole } = require('../middleware/authMiddleware')
const { dashboardAuthMiddleware } = require('../middleware/dashboardAuthMiddleware')
const { submitRateLimit, queryRateLimit } = require('../middleware/rateLimitMiddleware')

function registerRoutes(app) {
  app.get('/', (req, res) => {
    res.status(200).json({
      success: true,
      message: '文言文学习平台后端服务运行正常',
      version: '1.1.0',
      endpoints: {
        // 认证
        'POST /api/auth/student/login': '学生登录（学号 + 密码）',
        'POST /api/auth/teacher/register': '教师注册（手机号 + 密码 + 学校 + 所教班级）',
        'POST /api/auth/teacher/login': '教师登录',
        'POST /api/auth/admin/login': '管理员登录',
        'POST /api/auth/change-password': '登录态自助修改密码（三角色通用）',
        'POST /api/auth/login': '[已弃用，兼容旧前端] 学号免密登录',
        // 教师侧 - 学生管理
        'GET    /api/teacher/students': '教师查自己班级学生列表',
        'GET    /api/teacher/students/:studentId': '教师查单个学生',
        'POST   /api/teacher/students': '教师添加单个学生（校验前6位班级权限）',
        'POST   /api/teacher/students/batch': '教师批量添加学生（Excel后调用）',
        'PUT    /api/teacher/students/:studentId': '教师更新学生姓名',
        'POST   /api/teacher/students/:studentId/reset-password': '教师重置学生密码为123456',
        // 管理员侧
        'GET    /api/admin/teachers': '管理员查所有教师列表',
        'POST   /api/admin/teachers/:phone/reset-password': '管理员重置教师密码',
        'POST   /api/admin/teachers/:phone/status': '管理员启用/禁用教师',
        'GET    /api/admin/students': '管理员查所有学生',
        'POST   /api/admin/students/:studentId/reset-password': '管理员重置学生密码为123456',
        'GET    /api/admin/password-resets': '管理员查询密码重置审计日志',
        // 兼容旧前端
        'POST /api/students': '[兼容] 学生注册',
        'POST /api/submit': '提交答案',
        'GET /api/students': '[兼容] 查询所有学生',
        'GET /api/students/:studentId': '[兼容] 按学生ID查询',
        'PUT /api/students/:studentId': '[兼容] 修改学生信息',
        'DELETE /api/students/:studentId': '[兼容] 删除学生',
        'GET /api/answers/wen/:wenId': '按文言文ID查询答题',
        'GET /api/answers/student/:studentId': '按学生ID查询答题',
        'GET /api/texts/:textId/basic-info': '文本基础信息',
        'GET /api/texts/:textId/word-list': '字词注释',
        'GET /api/texts/:textId/multi-role-reading': '多角色朗读',
        'GET /api/texts/:textId/level1-quiz': '一级测验',
        'GET /api/texts/:textId/culture-cards': '文化卡片',
        'GET /api/texts/:textId/level2-dialog': '二级对话',
        'GET /api/texts/:textId/level2-quiz': '二级测验',
        'GET /api/texts/:textId/level3-scenario-text': '三级情景文本',
        'GET /api/texts/:textId/level3-adaptive-quiz': '三级自适应测验',
        'GET /api/texts': '文本列表',
        'POST /api/texts/batch': '批量获取文本数据',
      },
    })
  })

  // ============ 认证接口 ============
  app.post('/api/auth/student/login', authController.studentLogin)
  app.post('/api/auth/teacher/register', authController.teacherRegister)
  app.post('/api/auth/teacher/login', authController.teacherLogin)
  app.post('/api/auth/admin/login', authController.adminLogin)
  app.post(
    '/api/auth/change-password',
    requireAuthMiddleware,
    authController.changePassword,
  )

  // 兼容旧前端：免密学号登录，给一个 student role 的 token（无密码校验）
  // 但有必须密码的约束下，保留此接口需在后续前端升级后移除
  app.post('/api/auth/login', authController.studentLogin)

  // ============ 教师：学生管理 ============
  const teacherAuth = [requireAuthMiddleware, requireRole('teacher')]
  app.get('/api/teacher/students', ...teacherAuth, teacherController.listStudents)
  app.get('/api/teacher/students/:studentId', ...teacherAuth, teacherController.getStudent)
  app.post('/api/teacher/students', ...teacherAuth, teacherController.createStudent)
  app.post('/api/teacher/students/batch', ...teacherAuth, teacherController.batchCreateStudents)
  app.put('/api/teacher/students/:studentId', ...teacherAuth, teacherController.updateStudent)
  app.post(
    '/api/teacher/students/:studentId/reset-password',
    ...teacherAuth,
    teacherController.resetStudent,
  )

  // ============ 管理员：教师/学生/重置审计 ============
  const adminAuth = [requireAuthMiddleware, requireRole(['admin', 'super_admin'])]
  app.get('/api/admin/teachers', ...adminAuth, adminController.listTeachers)
  app.post(
    '/api/admin/teachers/:phone/reset-password',
    ...adminAuth,
    adminController.resetTeacher,
  )
  app.post('/api/admin/teachers/:phone/status', ...adminAuth, adminController.setTeacherStatus)
  app.get('/api/admin/students', ...adminAuth, adminController.listStudents)
  app.post(
    '/api/admin/students/:studentId/reset-password',
    ...adminAuth,
    adminController.resetStudent,
  )
  app.get('/api/admin/password-resets', ...adminAuth, adminController.listPasswordResets)

  // ============ 兼容旧前端：学生 CRUD 接口保留（无权限校验，后期可删） ============
  app.get('/api/students', studentController.getStudentList)
  app.get('/api/students/:studentId', studentController.getStudent)
  app.post('/api/students', studentController.createStudent)
  app.put('/api/students/:studentId', studentController.updateStudent)
  app.delete('/api/students/:studentId', studentController.deleteStudent)

  // ============ 文本 ============
  app.get('/api/texts', textsController.getTextList)
  app.post('/api/texts/batch', textsController.getTextsBatch)
  app.get('/api/texts/:textId/basic-info', textsController.getBasicInfo)
  app.get('/api/texts/:textId/word-list', textsController.getWordList)
  app.get('/api/texts/:textId/multi-role-reading', textsController.getMultiRoleReading)
  app.get('/api/texts/:textId/level1-quiz', textsController.getLevel1Quiz)
  app.get('/api/texts/:textId/culture-cards', textsController.getCultureCards)
  app.get('/api/texts/:textId/level2-dialog', textsController.getLevel2Dialog)
  app.get('/api/texts/:textId/level2-quiz', textsController.getLevel2Quiz)
  app.get('/api/texts/:textId/level3-scenario-text', textsController.getLevel3ScenarioText)
  app.get('/api/texts/:textId/level3-adaptive-quiz', textsController.getLevel3AdaptiveQuiz)

  // ============ 答题提交 ============
  app.post('/api/submit', optionalAuthMiddleware, submitRateLimit, answerController.submitAnswers)
  app.post(
    '/api/submit/single',
    optionalAuthMiddleware,
    submitRateLimit,
    answerController.submitSingleAnswer,
  )
  app.get('/api/answers/wen/:wenId', optionalAuthMiddleware, queryRateLimit, answerController.getAnswersByWenId)
  app.get(
    '/api/answers/student/:studentId',
    optionalAuthMiddleware,
    queryRateLimit,
    answerController.getAnswersByStudentId,
  )

// ============ 数据看板（需密码验证） ============
  app.get('/api/home/dashboard', dashboardAuthMiddleware, dashboardController.getDashboard)
  app.get('/api/home/dashboard/raw', dashboardAuthMiddleware, dashboardController.getRawData)

  // ============ 用户行为埋点（无需登录） ============
  app.post('/api/track', trackingController.track)

  // ============ 埋点数据分析（无需登录，用于看板展示） ============
  app.get('/api/tracking/funnel', trackingAnalysisController.getFunnel)
  app.get('/api/tracking/interaction', trackingAnalysisController.getInteractionStats)
  app.get('/api/tracking/search-trend', trackingAnalysisController.getSearchTrend)
  app.get('/api/tracking/quiz-performance', trackingAnalysisController.getQuizPerformance)
  app.get('/api/tracking/session-path', trackingAnalysisController.getSessionPath)
  app.get('/api/tracking/active-users', trackingAnalysisController.getActiveUsers)
  app.get('/api/tracking/hourly-activity', trackingAnalysisController.getHourlyActivity)
  app.get('/api/tracking/session-stats', trackingAnalysisController.getSessionStats)
  app.get('/api/tracking/feature-usage', trackingAnalysisController.getFeatureUsage)
  app.get('/api/tracking/cohort-analysis', trackingAnalysisController.getCohortAnalysis)

  // ============ 数据导出（需密码验证，使用看板密码） ============
  app.get('/api/export/tracking-events', dashboardAuthMiddleware, exportController.exportTrackingEvents)
  app.get('/api/export/answers', dashboardAuthMiddleware, exportController.exportAnswers)
  app.get('/api/export/dashboard-summary', dashboardAuthMiddleware, exportController.exportDashboardSummary)
}

module.exports = {
  registerRoutes,
}
