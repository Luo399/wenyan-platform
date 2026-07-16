const studentController = require('../controllers/studentController')
const textsController = require('../controllers/textsController')
const answerController = require('../controllers/answerController')
const authController = require('../controllers/authController')
const teacherStudentController = require('../controllers/teacherStudentController')
const { optionalAuthMiddleware, requireAuthMiddleware } = require('../middleware/authMiddleware')
const { submitRateLimit, queryRateLimit } = require('../middleware/rateLimitMiddleware')

function registerRoutes(app) {
  app.get('/', (req, res) => {
    res.status(200).json({
      success: true,
      message: '文言文学习平台后端服务运行正常',
      version: '1.0.0',
      endpoints: {
        'POST /api/auth/student/login': '学生登录',
        'POST /api/auth/teacher/login': '教师登录',
        'POST /api/auth/teacher/register': '教师注册',
        'POST /api/auth/change-password': '修改密码',
        'POST /api/auth/reset-student-password': '重置学生密码',
        'POST /api/auth/reset-teacher-password': '重置教师密码',
        'GET /api/auth/me': '获取当前用户信息',
        'POST /api/submit': '提交答案',
        'GET /api/teacher/students': '教师获取所教学生',
        'POST /api/teacher/students': '教师创建学生',
        'GET /api/teacher/students/:studentId': '教师获取单个学生',
        'PUT /api/teacher/students/:studentId': '教师更新学生',
        'DELETE /api/teacher/students/:studentId': '教师删除学生',
        'GET /api/admin/teachers': '管理员获取教师列表',
        'GET /api/answers/wen/:wenId': '按文言文ID查询答题情况',
        'GET /api/answers/student/:studentId': '按学生ID查询答题情况',
        'GET /api/texts/:textId/basic-info': '获取文本基础信息',
        'GET /api/texts/:textId/word-list': '获取字词注释',
        'GET /api/texts/:textId/multi-role-reading': '获取多角色朗读数据',
        'GET /api/texts/:textId/level1-quiz': '获取一级测验数据',
        'GET /api/texts/:textId/culture-cards': '获取文化卡片数据',
        'GET /api/texts/:textId/level2-dialog': '获取二级对话数据',
        'GET /api/texts/:textId/level2-quiz': '获取二级测验数据',
        'GET /api/texts/:textId/level3-scenario-text': '获取三级情景文本',
        'GET /api/texts/:textId/level3-adaptive-quiz': '获取三级自适应测验',
        'GET /api/texts': '获取文本列表',
        'POST /api/texts/batch': '批量获取文本数据',
        'POST /api/auth/login': '兼容旧登录（仅学号）',
      },
    })
  })

  // 公开接口
  app.post('/api/auth/student/login', authController.studentLogin)
  app.post('/api/auth/teacher/login', authController.teacherLogin)
  app.post('/api/auth/teacher/register', authController.teacherRegister)
  app.post('/api/auth/login', authController.legacyLogin)

  // 需要登录的接口
  app.get('/api/auth/me', requireAuthMiddleware, authController.getMe)
  app.post('/api/auth/change-password', requireAuthMiddleware, authController.changePassword)
  app.post('/api/auth/reset-student-password', requireAuthMiddleware, authController.resetStudentPassword)
  app.post('/api/auth/reset-teacher-password', requireAuthMiddleware, authController.resetTeacherPassword)

  // 教师学生管理
  app.get('/api/teacher/students', requireAuthMiddleware, teacherStudentController.getMyStudents)
  app.post('/api/teacher/students', requireAuthMiddleware, teacherStudentController.createStudent)
  app.get('/api/teacher/students/:studentId', requireAuthMiddleware, teacherStudentController.getStudent)
  app.put('/api/teacher/students/:studentId', requireAuthMiddleware, teacherStudentController.updateStudent)
  app.delete('/api/teacher/students/:studentId', requireAuthMiddleware, teacherStudentController.deleteStudent)

  // 管理员接口
  app.get('/api/admin/teachers', requireAuthMiddleware, teacherStudentController.getTeacherList)

  // 原有接口（兼容）
  app.get('/api/students', studentController.getStudentList)
  app.get('/api/students/:studentId', studentController.getStudent)
  app.post('/api/students', studentController.createStudent)
  app.put('/api/students/:studentId', studentController.updateStudent)
  app.delete('/api/students/:studentId', studentController.deleteStudent)

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
}

module.exports = {
  registerRoutes,
}
