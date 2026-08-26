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
const { requireAuthMiddleware, requireRole } = require('../middleware/authMiddleware')
const { dashboardAuthMiddleware } = require('../middleware/dashboardAuthMiddleware')
const { submitRateLimit, queryRateLimit, loginRateLimit } = require('../middleware/rateLimitMiddleware')

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
        // 遗留学生管理（S04：已加 teacher/admin 鉴权，待前端迁移后下线）
        'POST /api/students': '[鉴权] 学生注册',
        'POST /api/submit': '提交答案',
        'GET /api/students': '[鉴权] 查询所有学生',
        'GET /api/students/:studentId': '[鉴权] 按学生ID查询',
        'PUT /api/students/:studentId': '[鉴权] 修改学生信息',
        'DELETE /api/students/:studentId': '[鉴权] 删除学生',
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
  // S05: 登录接口统一挂 loginRateLimit 防暴力破解
  app.post('/api/auth/student/login', loginRateLimit, authController.studentLogin)
  app.post('/api/auth/teacher/register', authController.teacherRegister)
  app.post('/api/auth/teacher/login', loginRateLimit, authController.teacherLogin)
  app.post('/api/auth/admin/login', loginRateLimit, authController.adminLogin)
  app.post(
    '/api/auth/change-password',
    requireAuthMiddleware,
    authController.changePassword,
  )

  // S04: 遗留免密登录接口已物理下线（前端 R103 已迁移到 /api/auth/student/login）

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
  app.post('/api/admin/teachers', ...adminAuth, adminController.createTeacher)

  // S04: 遗留免密登录接口已下线（前端已迁移到 /api/auth/student/login，见 R103）
  // 历史无鉴权学生 CRUD 接口：保留路径但强制 teacher/admin 登录，防止匿名操作；
  // 前端 AnswerQueryView 迁移完成后在 Phase 2 物理删除
  const legacyStudentAuth = [requireAuthMiddleware, requireRole(['teacher', 'admin'])]
  app.get('/api/students', ...legacyStudentAuth, studentController.getStudentList)
  app.get('/api/students/:studentId', ...legacyStudentAuth, studentController.getStudent)
  app.post('/api/students', ...legacyStudentAuth, studentController.createStudent)
  app.put('/api/students/:studentId', ...legacyStudentAuth, studentController.updateStudent)
  app.delete('/api/students/:studentId', ...legacyStudentAuth, studentController.deleteStudent)

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

  // ============ 答题提交（P0 安全修复：学生必鉴权，禁止匿名提交） ============
  app.post('/api/submit', requireAuthMiddleware, submitRateLimit, answerController.submitAnswers)
  app.post(
    '/api/submit/single',
    requireAuthMiddleware,
    submitRateLimit,
    answerController.submitSingleAnswer,
  )
  // P0 安全修复：答题明细含学生学号/答案，仅教师/管理员可查询
  const answerQueryAuth = [requireAuthMiddleware, requireRole(['teacher', 'admin', 'super_admin'])]
  app.get('/api/answers/wen/:wenId', ...answerQueryAuth, queryRateLimit, answerController.getAnswersByWenId)
  app.get(
    '/api/answers/student/:studentId',
    ...answerQueryAuth,
    queryRateLimit,
    answerController.getAnswersByStudentId,
  )

// ============ 数据看板（需密码验证） ============
  app.get('/api/home/dashboard', dashboardAuthMiddleware, dashboardController.getDashboard)
  app.get('/api/home/dashboard/raw', dashboardAuthMiddleware, dashboardController.getRawData)

  // ============ 用户行为埋点上报（无需登录，学生端上报） ============
  app.post('/api/track', trackingController.track)

  // ============ 埋点数据分析（需看板密码验证，含学生学号/成绩/会话路径等敏感数据） ============
  app.get('/api/tracking/funnel', dashboardAuthMiddleware, trackingAnalysisController.getFunnel)
  app.get('/api/tracking/interaction', dashboardAuthMiddleware, trackingAnalysisController.getInteractionStats)
  app.get('/api/tracking/search-trend', dashboardAuthMiddleware, trackingAnalysisController.getSearchTrend)
  app.get('/api/tracking/quiz-performance', dashboardAuthMiddleware, trackingAnalysisController.getQuizPerformance)
  app.get('/api/tracking/session-path', dashboardAuthMiddleware, trackingAnalysisController.getSessionPath)
  app.get('/api/tracking/active-users', dashboardAuthMiddleware, trackingAnalysisController.getActiveUsers)
  app.get('/api/tracking/hourly-activity', dashboardAuthMiddleware, trackingAnalysisController.getHourlyActivity)
  app.get('/api/tracking/session-stats', dashboardAuthMiddleware, trackingAnalysisController.getSessionStats)
  app.get('/api/tracking/feature-usage', dashboardAuthMiddleware, trackingAnalysisController.getFeatureUsage)
  app.get('/api/tracking/cohort-analysis', dashboardAuthMiddleware, trackingAnalysisController.getCohortAnalysis)

  // ============ 数据导出（需密码验证，使用看板密码） ============
  app.get('/api/export/tracking-events', dashboardAuthMiddleware, exportController.exportTrackingEvents)
  app.get('/api/export/answers', dashboardAuthMiddleware, exportController.exportAnswers)
  app.get('/api/export/dashboard-summary', dashboardAuthMiddleware, exportController.exportDashboardSummary)

  // P2: 旧 Figma REST 同步方案（/api/figma/sync、/api/figma/status，因 API 限流弃用）已下线，
  // 统一走 Figma 插件 → /api/assets/upload 的上传链路（见下方资产同步段落）

  // ============ 资产同步（Figma 插件 → 后端 → OSS，需同步令牌鉴权） ============
  const assetController = require('../controllers/assetController')
  const assetAuthMiddleware = require('../middleware/assetAuthMiddleware')
  const multer = require('multer')
  const uploadMiddleware = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })
  // 上传与预签名写入必须校验 ASSET_SYNC_TOKEN；版本信息读取无需鉴权（前端读取）
  app.post('/api/assets/upload', assetAuthMiddleware, uploadMiddleware.any(), assetController.upload)
  app.post('/api/assets/pre-signed', assetAuthMiddleware, assetController.generatePreSignedUrl)
  app.get('/api/assets/version', assetController.getVersion)
  // 资源清单（带最近更新时间，供 Figma 插件展示）
  app.get('/api/assets/inventory', assetController.getInventory)
  // OSS 真实文件清单（与上传清单不同数据源，排查"显示成功未上传"）
  app.get('/api/assets/oss-list', assetController.getOssList)
  // 清理误传/非业务资源（删除 OSS 对象 + 移除 version.json 记录），与上传同鉴权
  app.post('/api/assets/cleanup', assetAuthMiddleware, assetController.cleanup)

  // ============ 资源上传工具（教师/管理员鉴权，用于前端音视频资源上传） ============
  const resourceController = require('../controllers/resourceController')
  const singleUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } }).single('file')
  app.post('/api/upload/resource', requireAuthMiddleware, requireRole(['teacher', 'admin']), singleUpload, resourceController.uploadResource)
}

module.exports = {
  registerRoutes,
}
