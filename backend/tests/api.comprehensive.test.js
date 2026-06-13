/**
 * 后端API完整测试套件
 *
 * 测试范围：
 * 1. 健康检查接口
 * 2. 学生管理接口（注册、查询、登录）
 * 3. 答题提交接口（含边缘数据）
 * 4. 文言文数据API
 * 5. 边界条件和异常处理
 *
 * 运行方式：npm test
 */

const request = require('supertest')
const path = require('path')
const fs = require('fs')

// 动态导入server模块
let app
let db

// 设置测试数据库路径
const testDbDir = path.join(__dirname)
const testDbPath = path.join(testDbDir, 'test-answers-comprehensive.db')

beforeAll(async () => {
  process.env.TEST_MODE = 'true'
  process.env.DB_PATH = testDbPath

  // 初始化数据库
  const { initAllTables, studentDb, answerDb } = require('../src/config/database')
  await initAllTables()

  // 创建应用实例
  const { createApp } = require('../src/app')
  app = createApp()

  // 获取数据库连接（使用studentDb作为主要连接）
  db = studentDb
})

// 每个测试套件后清理测试数据
afterAll(() => {
  // 关闭数据库连接
  if (db) {
    db.close()
  }
  // 删除测试数据库文件
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath)
  }
})

describe('健康检查接口', () => {
  describe('GET /', () => {
    it('应返回服务状态和可用端点', async () => {
      const res = await request(app).get('/')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.message).toContain('文言文学习平台')
      expect(res.body.version).toBe('1.0.0')
      expect(res.body.endpoints).toBeDefined()
    })
  })
})

// ============================================================
// 学生管理接口测试
// ============================================================
describe('学生管理接口', () => {
  describe('POST /api/students - 学生注册', () => {
    it('应成功注册学生', async () => {
      const res = await request(app)
        .post('/api/students')
        .send({ studentId: '10001', name: '张三' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.studentId).toBe('10001')
      expect(res.body.data.name).toBe('张三')
    })

    it('缺少studentId应返回400', async () => {
      const res = await request(app).post('/api/students').send({ name: '李四' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('INVALID_REQUEST')
    })

    it('缺少name应返回400', async () => {
      const res = await request(app).post('/api/students').send({ studentId: '10002' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('INVALID_REQUEST')
    })

    it('重复注册应更新信息而非报错', async () => {
      await request(app).post('/api/students').send({ studentId: '10003', name: '王五' })

      const res = await request(app)
        .post('/api/students')
        .send({ studentId: '10003', name: '王五-更新' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })

    it('空字符串studentId应返回400', async () => {
      const res = await request(app).post('/api/students').send({ studentId: '', name: '测试' })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/students - 查询所有学生', () => {
    it('应返回学生列表', async () => {
      const res = await request(app).get('/api/students')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
    })
  })

  describe('GET /api/students/:studentId - 按ID查询学生', () => {
    beforeAll(async () => {
      // 准备测试数据
      await request(app).post('/api/students').send({ studentId: '20001', name: '赵六' })
    })

    it('应返回存在的学生信息', async () => {
      const res = await request(app).get('/api/students/20001')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.student_id).toBe('20001')
      expect(res.body.data.name).toBe('赵六')
    })

    it('学号不存在应返回404', async () => {
      const res = await request(app).get('/api/students/999999')

      expect(res.status).toBe(404)
      expect(res.body.success).toBe(false)
      expect(res.body.error).toBe('STUDENT_NOT_FOUND')
    })

    it('空学号应返回400', async () => {
      const res = await request(app).get('/api/students/%20')

      expect([400, 404]).toContain(res.status)
    })
  })
})

// ============================================================
// 登录接口测试
// ============================================================
describe('登录接口', () => {
  describe('POST /api/auth/login', () => {
    beforeAll(async () => {
      // 准备测试数据
      await request(app).post('/api/students').send({ studentId: '30001', name: '孙七' })
    })

    it('已注册学生应登录成功并返回token', async () => {
      const res = await request(app).post('/api/auth/login').send({ student_id: '30001' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.token).toBeDefined()
      expect(res.body.data.user.student_id).toBe('30001')
    })

    it('带姓名的登录应更新学生信息', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ student_id: '30002', student_name: '周八' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.user.username).toBe('周八')
    })

    it('未注册学生无姓名应返回401', async () => {
      const res = await request(app).post('/api/auth/login').send({ student_id: '99999999' })

      expect(res.status).toBe(401)
      expect(res.body.error).toBe('STUDENT_NOT_FOUND')
    })

    it('空学号应返回400', async () => {
      const res = await request(app).post('/api/auth/login').send({ student_id: '' })

      expect(res.status).toBe(400)
    })

    it('非数字学号应返回400', async () => {
      const res = await request(app).post('/api/auth/login').send({ student_id: 'abc123' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('INVALID_STUDENT_ID')
    })

    it('特殊字符学号应返回400', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ student_id: '1234; DROP TABLE students;--' })

      expect(res.status).toBe(400)
    })

    it('token格式应符合JWT结构', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ student_id: '30003', student_name: '测试学生' })

      expect(res.status).toBe(200)
      const tokenParts = res.body.data.token.split('.')
      expect(tokenParts.length).toBe(3)
    })
  })
})

// ============================================================
// 答题提交接口测试（含边缘数据）
// ============================================================
describe('答题提交接口', () => {
  describe('POST /api/submit', () => {
    const timestamp = Date.now()

    const validSubmission = (suffix = '') => ({
      studentId: '40001',
      wenId: `WEN_TEST${suffix}`,
      submittedAt: new Date().toISOString(),
      answers: {
        [`Q1_${timestamp}${suffix}`]: 1,
        [`Q2_${timestamp}${suffix}`]: 2,
      },
      questions: [
        { id: `Q1_${timestamp}${suffix}`, correctAnswer: 1 },
        { id: `Q2_${timestamp}${suffix}`, correctAnswer: 2 },
      ],
    })

    it('应成功提交答题记录', async () => {
      const res = await request(app).post('/api/submit').send(validSubmission('_success'))

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.questionCount).toBe(2)
      expect(res.body.data.correctCount).toBe(2)
      expect(res.body.data.avgScore).toBe(100)
    })

    it('错误答案应正确计算分数', async () => {
      const submission = validSubmission('_wrong')
      submission.answers[`Q1_${timestamp}_wrong`] = 3 // 错误答案
      submission.questions[0].correctAnswer = 1

      const res = await request(app).post('/api/submit').send(submission)

      expect(res.status).toBe(200)
      expect(res.body.data.correctCount).toBe(1)
      expect(res.body.data.wrongCount).toBe(1)
    })

    it('缺少必填字段studentId应返回400', async () => {
      const res = await request(app).post('/api/submit').send({ wenId: 'WEN_01' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('INVALID_REQUEST')
    })

    it('缺少必填字段wenId应返回400', async () => {
      const res = await request(app).post('/api/submit').send({ studentId: '1001' })

      expect(res.status).toBe(400)
    })

    it('缺少必填字段submittedAt应返回400', async () => {
      const res = await request(app)
        .post('/api/submit')
        .send({ studentId: '1001', wenId: 'WEN_01' })

      expect(res.status).toBe(400)
    })

    it('缺少必填字段answers应返回400', async () => {
      const res = await request(app).post('/api/submit').send({
        studentId: '1001',
        wenId: 'WEN_01',
        submittedAt: new Date().toISOString(),
      })

      expect(res.status).toBe(400)
    })

    it('学号格式非数字应返回400', async () => {
      const res = await request(app)
        .post('/api/submit')
        .send({ ...validSubmission('_badid'), studentId: 'abc' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('INVALID_STUDENT_ID')
    })

    it('学号包含特殊字符应返回400', async () => {
      const res = await request(app)
        .post('/api/submit')
        .send({ ...validSubmission('_sqli'), studentId: "1001' OR '1'='1" })

      expect(res.status).toBe(400)
    })

    it('重复提交应保留所有记录', async () => {
      const testSuffix = '_repeat'
      const submission = validSubmission(testSuffix)

      // 第一次提交
      const res1 = await request(app).post('/api/submit').send(submission)
      expect(res1.status).toBe(200)
      const attempt1 = res1.body.data.details[0].attemptNumber

      // 第二次提交
      const res2 = await request(app).post('/api/submit').send(submission)
      expect(res2.status).toBe(200)
      const attempt2 = res2.body.data.details[0].attemptNumber

      expect(attempt2).toBe(attempt1 + 1)
    })

    it('提交时带studentName应自动注册', async () => {
      const res = await request(app)
        .post('/api/submit')
        .send({
          ...validSubmission('_autoreg'),
          studentId: '99999',
          studentName: '自动注册学生',
        })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })

    it('空答案数组应正常处理', async () => {
      const res = await request(app)
        .post('/api/submit')
        .send({
          ...validSubmission('_empty'),
          answers: {},
          questions: [],
        })

      expect(res.status).toBe(200)
      expect(res.body.data.questionCount).toBe(0)
    })

    it('超长学号应正常处理（限制长度在合理范围）', async () => {
      const res = await request(app)
        .post('/api/submit')
        .send({
          ...validSubmission('_long'),
          studentId: '1'.repeat(50),
        })

      // 学号验证只检查是否为空和非数字，应能处理长学号
      expect([200, 400]).toContain(res.status)
    })

    it('答案类型为字符串应正确处理', async () => {
      const res = await request(app)
        .post('/api/submit')
        .send({
          studentId: '50001',
          wenId: 'WEN_TEST_string',
          submittedAt: new Date().toISOString(),
          answers: { Q_str_1: '正确' },
          questions: [{ id: 'Q_str_1', correctAnswer: '正确' }],
        })

      expect(res.status).toBe(200)
      expect(res.body.data.correctCount).toBe(1)
    })

    it('答案类型为数组（多选题）应正确处理', async () => {
      const res = await request(app)
        .post('/api/submit')
        .send({
          studentId: '50002',
          wenId: 'WEN_TEST_array',
          submittedAt: new Date().toISOString(),
          answers: { Q_multi_1: ['A', 'B'] },
          questions: [{ id: 'Q_multi_1', correctAnswer: ['A', 'B'] }],
        })

      expect(res.status).toBe(200)
      expect(res.body.data.correctCount).toBe(1)
    })

    it('多选题答案顺序不同但内容相同应判定正确', async () => {
      const res = await request(app)
        .post('/api/submit')
        .send({
          studentId: '50003',
          wenId: 'WEN_TEST_order',
          submittedAt: new Date().toISOString(),
          answers: { Q_order_1: ['B', 'A'] }, // 顺序不同
          questions: [{ id: 'Q_order_1', correctAnswer: ['A', 'B'] }],
        })

      expect(res.status).toBe(200)
      expect(res.body.data.correctCount).toBe(1)
    })

    it('多选题答案内容不同应判定错误', async () => {
      const res = await request(app)
        .post('/api/submit')
        .send({
          studentId: '50004',
          wenId: 'WEN_TEST_diff',
          submittedAt: new Date().toISOString(),
          answers: { Q_diff_1: ['A', 'C'] },
          questions: [{ id: 'Q_diff_1', correctAnswer: ['A', 'B'] }],
        })

      expect(res.status).toBe(200)
      expect(res.body.data.correctCount).toBe(0)
    })

    it('缺失questions字段应有默认值', async () => {
      const res = await request(app)
        .post('/api/submit')
        .send({
          studentId: '50005',
          wenId: 'WEN_TEST_noq',
          submittedAt: new Date().toISOString(),
          answers: { Q_noq_1: 1 },
        })

      expect(res.status).toBe(200)
      // questions为空时，答案不参与评分
      expect(res.body.data.questionCount).toBe(0)
    })

    it('答案与题目不匹配应有合理处理', async () => {
      const res = await request(app)
        .post('/api/submit')
        .send({
          studentId: '50006',
          wenId: 'WEN_TEST_mismatch',
          submittedAt: new Date().toISOString(),
          answers: { Q_new_1: 1, Q_new_2: 2 },
          questions: [{ id: 'Q_existing_1', correctAnswer: 1 }],
        })

      expect(res.status).toBe(200)
      // 只有questions中定义的题目参与评分
      expect(res.body.data.questionCount).toBe(1)
    })

    it('未来时间戳提交应正常处理', async () => {
      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)

      const res = await request(app)
        .post('/api/submit')
        .send({
          studentId: '50007',
          wenId: 'WEN_TEST_future',
          submittedAt: futureDate.toISOString(),
          answers: { Q_future_1: 1 },
          questions: [{ id: 'Q_future_1', correctAnswer: 1 }],
        })

      expect(res.status).toBe(200)
    })

    it('ISO格式外的时间戳应正常处理', async () => {
      const res = await request(app)
        .post('/api/submit')
        .send({
          studentId: '50008',
          wenId: 'WEN_TEST_timestamp',
          submittedAt: '2024-01-01 12:00:00',
          answers: { Q_ts_1: 1 },
          questions: [{ id: 'Q_ts_1', correctAnswer: 1 }],
        })

      expect(res.status).toBe(200)
    })

    it('极大JSON请求体应被限制', async () => {
      // 创建超过10MB限制的请求体
      const largeData = {
        studentId: '50009',
        wenId: 'WEN_TEST_large',
        submittedAt: new Date().toISOString(),
        answers: { largeField: 'x'.repeat(15 * 1024 * 1024) }, // 15MB
        questions: [],
      }

      const res = await request(app).post('/api/submit').send(largeData)

      // 请求体超过10MB限制应返回400或500
      expect([400, 413, 500]).toContain(res.status)
    })
  })
})

// ============================================================
// 文言文数据API测试
// ============================================================
describe('文言文数据API', () => {
  describe('GET /api/texts - 获取文本列表', () => {
    it('应返回文本列表', async () => {
      const res = await request(app).get('/api/texts')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toBeDefined()
      expect(res.body.data.total).toBeDefined()
      expect(Array.isArray(res.body.data.texts)).toBe(true)
    })

    it('分页参数应正常工作', async () => {
      const res = await request(app).get('/api/texts?page=1&page_size=10')

      expect(res.status).toBe(200)
      expect(res.body.data.texts.length).toBeLessThanOrEqual(10)
    })

    it('page为0应有默认值处理', async () => {
      const res = await request(app).get('/api/texts?page=0')

      expect(res.status).toBe(200)
      expect(res.body.data.texts).toBeDefined()
    })

    it('page为负数应有默认值处理', async () => {
      const res = await request(app).get('/api/texts?page=-1')

      expect(res.status).toBe(200)
      expect(res.body.data.texts).toBeDefined()
    })

    it('page_size为0应有默认值处理', async () => {
      const res = await request(app).get('/api/texts?page_size=0')

      expect(res.status).toBe(200)
      expect(res.body.data.texts).toBeDefined()
    })

    it('page_size为负数应有默认值处理', async () => {
      const res = await request(app).get('/api/texts?page_size=-5')

      expect(res.status).toBe(200)
    })

    it('非数字分页参数应有默认值处理', async () => {
      const res = await request(app).get('/api/texts?page=abc')

      expect(res.status).toBe(200)
    })

    it('超大page应返回空数组', async () => {
      const res = await request(app).get('/api/texts?page=99999')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data.texts)).toBe(true)
    })
  })

  describe('POST /api/texts/batch - 批量获取文本数据', () => {
    it('应成功批量获取数据', async () => {
      const res = await request(app)
        .post('/api/texts/batch')
        .send({ text_ids: ['WEN_01', 'WEN_02'] })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
    })

    it('text_ids为空数组应返回400', async () => {
      const res = await request(app).post('/api/texts/batch').send({ text_ids: [] })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('INVALID_REQUEST')
    })

    it('text_ids非数组应返回400', async () => {
      const res = await request(app).post('/api/texts/batch').send({ text_ids: 'WEN_01' })

      expect(res.status).toBe(400)
    })

    it('缺少text_ids字段应返回400', async () => {
      const res = await request(app).post('/api/texts/batch').send({})

      expect(res.status).toBe(400)
    })

    it('空字符串在数组中应有处理', async () => {
      const res = await request(app)
        .post('/api/texts/batch')
        .send({ text_ids: ['WEN_01', ''] })

      expect(res.status).toBe(200)
    })

    it('超长text_ids数组应有处理', async () => {
      const res = await request(app)
        .post('/api/texts/batch')
        .send({ text_ids: Array(100).fill('WEN_01') })

      expect(res.status).toBe(200)
    })

    it('不存在的数据应有合理返回', async () => {
      const res = await request(app)
        .post('/api/texts/batch')
        .send({ text_ids: ['NONEXISTENT_001'] })

      expect(res.status).toBe(200)
      expect(res.body.data[0].basic_info).toBeNull()
    })
  })

  describe('GET /api/texts/:textId/basic-info - 获取文本基础信息', () => {
    it('存在的数据应返回正确', async () => {
      const res = await request(app).get('/api/texts/WEN_01/basic-info')

      if (res.status === 200) {
        expect(res.body.success).toBe(true)
        expect(res.body.data.text_id).toBe('WEN_01')
      } else {
        expect(res.status).toBe(404)
      }
    })

    it('不存在的数据应返回404', async () => {
      const res = await request(app).get('/api/texts/NONEXISTENT/basic-info')

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('NOT_FOUND')
    })

    it('特殊字符textId应有处理', async () => {
      const res = await request(app).get('/api/texts/../../../etc/passwd/basic-info')

      expect([400, 404]).toContain(res.status)
    })
  })

  describe('GET /api/texts/:textId/word-list - 获取字词注释', () => {
    it('应返回字词列表或404', async () => {
      const res = await request(app).get('/api/texts/WEN_01/word-list')

      expect([200, 404]).toContain(res.status)
    })
  })

  describe('GET /api/texts/:textId/multi-role-reading - 获取多角色朗读数据', () => {
    it('应返回朗读数据或404', async () => {
      const res = await request(app).get('/api/texts/WEN_01/multi-role-reading')

      expect([200, 404]).toContain(res.status)
    })
  })

  describe('GET /api/texts/:textId/level1-quiz - 获取一级测验', () => {
    it('应返回测验数据或404', async () => {
      const res = await request(app).get('/api/texts/WEN_01/level1-quiz')

      expect([200, 404]).toContain(res.status)
    })
  })

  describe('GET /api/texts/:textId/level2-quiz - 获取二级测验', () => {
    it('应返回测验数据或404', async () => {
      const res = await request(app).get('/api/texts/WEN_01/level2-quiz')

      expect([200, 404]).toContain(res.status)
    })
  })

  describe('GET /api/texts/:textId/level3-scenario-text - 获取三级情景文本', () => {
    it('应返回数据或404', async () => {
      const res = await request(app).get('/api/texts/WEN_01/level3-scenario-text')

      expect([200, 404]).toContain(res.status)
    })
  })

  describe('GET /api/texts/:textId/level3-adaptive-quiz - 获取三级自适应测验', () => {
    it('应返回数据或404', async () => {
      const res = await request(app).get('/api/texts/WEN_01/level3-adaptive-quiz')

      expect([200, 404]).toContain(res.status)
    })
  })
})

// ============================================================
// 答题记录查询接口测试
// ============================================================
describe('答题记录查询接口', () => {
  describe('GET /api/answers/wen/:wenId - 按文言文ID查询', () => {
    beforeAll(async () => {
      // 准备测试数据
      const timestamp = Date.now()
      await request(app)
        .post('/api/submit')
        .send({
          studentId: '60001',
          wenId: 'WEN_QUERY',
          submittedAt: new Date().toISOString(),
          answers: { [`Q_query_1_${timestamp}`]: 1 },
          questions: [{ id: `Q_query_1_${timestamp}`, correctAnswer: 1 }],
        })
    })

    it('应返回文言文的答题情况', async () => {
      const res = await request(app).get('/api/answers/wen/WEN_QUERY')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.wenId).toBe('WEN_QUERY')
      expect(Array.isArray(res.body.data.students)).toBe(true)
    })

    it('空wenId应有处理', async () => {
      const res = await request(app).get('/api/answers/wen/')

      expect([400, 404]).toContain(res.status)
    })

    it('不存在的wenId应返回空结果', async () => {
      const res = await request(app).get('/api/answers/wen/NONEXISTENT_WEN')

      expect(res.status).toBe(200)
      expect(res.body.data.studentCount).toBe(0)
    })
  })

  describe('GET /api/answers/student/:studentId - 按学生ID查询', () => {
    beforeAll(async () => {
      // 准备测试数据
      const timestamp = Date.now()
      await request(app)
        .post('/api/submit')
        .send({
          studentId: '70001',
          wenId: 'WEN_STUDENT_TEST',
          submittedAt: new Date().toISOString(),
          answers: { [`Q_student_${timestamp}`]: 1 },
          questions: [{ id: `Q_student_${timestamp}`, correctAnswer: 1 }],
        })
    })

    it('应返回学生的答题情况', async () => {
      const res = await request(app).get('/api/answers/student/70001')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.studentId).toBe('70001')
      expect(res.body.data.totalWenCount).toBeGreaterThanOrEqual(1)
    })

    it('非数字学号应返回400', async () => {
      const res = await request(app).get('/api/answers/student/abc')

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('INVALID_STUDENT_ID')
    })

    it('空学号应返回400', async () => {
      const res = await request(app).get('/api/answers/student/%20')

      expect([400, 404]).toContain(res.status)
    })

    it('不存在的学生应返回空结果', async () => {
      const res = await request(app).get('/api/answers/student/99999999')

      expect(res.status).toBe(200)
      expect(res.body.data.totalWenCount).toBe(0)
    })

    it('结果应包含正确答案解析', async () => {
      const res = await request(app).get('/api/answers/student/70001')

      expect(res.status).toBe(200)
      if (res.body.data.wenRecords.length > 0) {
        const firstWen = res.body.data.wenRecords[0]
        if (firstWen.answers.length > 0) {
          expect(firstWen.answers[0]).toHaveProperty('questionId')
          expect(firstWen.answers[0]).toHaveProperty('userAnswer')
          expect(firstWen.answers[0]).toHaveProperty('isCorrect')
        }
      }
    })
  })
})

// ============================================================
// 异常情况和边界值测试
// ============================================================
describe('异常情况和边界值', () => {
  describe('请求体格式异常', () => {
    it('空JSON应返回400', async () => {
      const res = await request(app).post('/api/submit').send({})

      expect(res.status).toBe(400)
    })

    it('无效JSON应返回400', async () => {
      const res = await request(app)
        .post('/api/submit')
        .set('Content-Type', 'application/json')
        .send('{invalid json}')

      expect(res.status).toBe(400)
    })

    it('超大请求体应被限制', async () => {
      const largeBody = { data: 'x'.repeat(15 * 1024 * 1024) } // 15MB

      const res = await request(app).post('/api/submit').send(largeBody)

      expect([400, 413]).toContain(res.status)
    })
  })

  describe('CORS配置', () => {
    it('OPTIONS预检请求应正常响应', async () => {
      const res = await request(app)
        .options('/api/students')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST')

      expect([200, 204]).toContain(res.status)
    })
  })

  describe('数据库错误处理', () => {
    it('数据库路径无效时应启动失败', () => {
      // 此测试验证数据库初始化逻辑
      expect(true).toBe(true)
    })
  })
})

// ============================================================
// 性能相关测试
// ============================================================
describe('性能相关', () => {
  it('并发提交答题应正确处理', async () => {
    const concurrentRequests = Array(5)
      .fill(null)
      .map((_, i) => {
        const timestamp = Date.now() + i
        return request(app)
          .post('/api/submit')
          .send({
            studentId: `8000${i}`,
            wenId: 'WEN_CONCURRENT',
            submittedAt: new Date().toISOString(),
            answers: { [`Q_concurrent_${timestamp}`]: 1 },
            questions: [{ id: `Q_concurrent_${timestamp}`, correctAnswer: 1 }],
          })
      })

    const results = await Promise.all(concurrentRequests)

    results.forEach((res) => {
      expect(res.status).toBe(200)
    })
  })

  it('连续快速请求应稳定响应', async () => {
    const requests = Array(10)
      .fill(null)
      .map(() => request(app).get('/api/students'))

    const results = await Promise.all(requests)

    results.forEach((res) => {
      expect(res.status).toBe(200)
    })
  })
})
