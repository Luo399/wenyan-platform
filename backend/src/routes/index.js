const studentController = require('../controllers/studentController')
const textsController = require('../controllers/textsController')
const answerController = require('../controllers/answerController')
const authController = require('../controllers/authController')
const { optionalAuthMiddleware } = require('../middleware/authMiddleware')
const { submitRateLimit, queryRateLimit } = require('../middleware/rateLimitMiddleware')

function registerRoutes(app) {
  app.get('/', (req, res) => {
    res.status(200).json({
      success: true,
      message: '文言文学习平台后端服务运行正常',
      version: '1.0.0',
      endpoints: {
        'POST /api/students': '学生注册',
        'POST /api/submit': '提交答案',
        'GET /api/students': '查询所有学生',
        'GET /api/students/:studentId': '按学生ID查询学生信息',
        'PUT /api/students/:studentId': '修改学生信息',
        'DELETE /api/students/:studentId': '删除学生',
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
        'POST /api/auth/login': '学生登录',
      },
    })
  })

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

  app.post('/api/auth/login', authController.login)
}

module.exports = {
  registerRoutes,
};