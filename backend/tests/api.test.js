/**
 * 后端API单元测试（安全加固后契约）
 *
 * 测试范围：
 * 1. 学生管理接口（遗留 /api/students* 已物理下线，改走 /api/admin/students*）
 * 2. 答题提交接口（必须登录 + 服务端判分）
 * 3. 答题查询接口（教师/管理员角色）
 * 4. 登录接口（遗留 /api/auth/login 已下线，改走 /api/auth/student/login）
 *
 * 运行方式：npm test
 */

const request = require('supertest');

// 必须在 require database 之前设置，使用内存数据库避免污染工作区
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'ci-test-secret';
// 安全加固后不再内置 admin/admin123：初始管理员需显式配置
process.env.INITIAL_ADMIN_PASSWORD = 'AdminInit#2024';
process.env.INITIAL_ADMIN_USERNAME = 'admin';
// 本套件登录/提交次数较多，放宽测试环境限流
process.env.RATE_LIMIT_LOGIN = '200';
process.env.RATE_LIMIT_SUBMIT = '200';

// 真实题库数据：data/text-quiz/WEN_01.json → WEN_01_Q1 正确答案 1
const WEN_ID = 'WEN_01';
const QUESTION_ID = 'WEN_01_Q1';
const CORRECT_ANSWER = 1;

// 动态导入server模块（用于测试环境）
let app;
let adminToken;
let studentToken;

function asAdmin(agent) {
  return agent.set('Authorization', `Bearer ${adminToken}`);
}

function asStudent(agent) {
  return agent.set('Authorization', `Bearer ${studentToken}`);
}

beforeAll(async () => {
  // 测试模式标记
  process.env.TEST_MODE = 'true';

  // 初始化数据库（:memory: 内存数据库）
  const { initAllTables } = require('../src/config/database');
  await initAllTables();

  // 创建应用实例
  const { createApp } = require('../src/app');
  app = createApp();

  const adminLogin = await request(app)
    .post('/api/auth/admin/login')
    .send({ username: 'admin', password: process.env.INITIAL_ADMIN_PASSWORD });
  adminToken = adminLogin.body.data?.token;
  expect(adminToken).toBeTruthy();

  const studentLogin = await request(app)
    .post('/api/auth/student/login')
    .send({ student_id: '99999999', password: '99999999' });
  studentToken = studentLogin.body.data?.token;
  expect(studentToken).toBeTruthy();
});

describe('学生管理接口', () => {
  describe('GET /api/admin/students', () => {
    it('管理员应能拿到学生列表（含分页信息）', async () => {
      const res = await asAdmin(request(app).get('/api/admin/students'));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toMatchObject({ page: 1 });
      expect(typeof res.body.pagination.total).toBe('number');
      // 不泄漏密码哈希
      expect(res.body.data[0].password_hash).toBeUndefined();
    });

    it('未登录应返回 401', async () => {
      const res = await request(app).get('/api/admin/students');
      expect(res.status).toBe(401);
    });

    it('遗留 GET /api/students 已下线，应返回 404', async () => {
      const res = await asAdmin(request(app).get('/api/students'));
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/admin/students/:studentId', () => {
    it('存在的学生应返回详情', async () => {
      const res = await asAdmin(request(app).get('/api/admin/students/99999999'));
      expect(res.status).toBe(200);
      expect(res.body.data.student_id).toBe('99999999');
      expect(res.body.data.student_name).toBe('测试学生');
    });

    it('学号不存在应返回 404', async () => {
      const res = await asAdmin(request(app).get('/api/admin/students/88888888'));
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('NOT_FOUND');
    });
  });
});

describe('答题提交接口', () => {
  describe('POST /api/submit', () => {
    const validSubmission = () => ({
      studentId: '99999999',
      wenId: WEN_ID,
      submittedAt: new Date().toISOString(),
      answers: { [QUESTION_ID]: CORRECT_ANSWER },
      // 客户端 correctAnswer 不再可信，这里故意乱传
      questions: [{ id: QUESTION_ID, correctAnswer: 999 }],
    });

    it('未登录提交应返回 401', async () => {
      const res = await request(app).post('/api/submit').send(validSubmission());
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('AUTH_REQUIRED');
    });

    it('学生登录后应成功提交答题记录（服务端判分）', async () => {
      const res = await asStudent(request(app).post('/api/submit')).send(validSubmission());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.questionCount).toBe(1);
      expect(res.body.data.correctCount).toBe(1);
    });

    it('缺少必填字段应返回 400', async () => {
      const res = await asStudent(request(app).post('/api/submit')).send({
        studentId: '99999999',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('学号格式不正确应返回 400', async () => {
      const res = await asStudent(request(app).post('/api/submit')).send({
        ...validSubmission(),
        studentId: 'abc',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('重复提交应创建新记录而非覆盖', async () => {
      const submission = validSubmission();

      const res1 = await asStudent(request(app).post('/api/submit')).send(submission);
      expect(res1.status).toBe(200);
      expect(res1.body.data.details[0].attemptNumber).toBeGreaterThanOrEqual(1);

      const res2 = await asStudent(request(app).post('/api/submit')).send(submission);
      expect(res2.status).toBe(200);
      expect(res2.body.data.details[0].attemptNumber).toBeGreaterThan(
        res1.body.data.details[0].attemptNumber,
      );
    });
  });
});

describe('按文言文ID查询接口', () => {
  describe('GET /api/answers/wen/:wenId', () => {
    it('管理员应返回指定文言文的答题情况', async () => {
      const res = await asAdmin(request(app).get(`/api/answers/wen/${WEN_ID}`));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.wenId).toBe(WEN_ID);
      expect(Array.isArray(res.body.data.students)).toBe(true);
    });

    it('未登录应返回 401', async () => {
      const res = await request(app).get(`/api/answers/wen/${WEN_ID}`);
      expect(res.status).toBe(401);
    });
  });
});

describe('按学生ID查询接口', () => {
  describe('GET /api/answers/student/:studentId', () => {
    it('管理员应返回指定学生的答题情况', async () => {
      const res = await asAdmin(request(app).get('/api/answers/student/99999999'));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.studentId).toBe('99999999');
      expect(res.body.data.totalWenCount).toBeGreaterThanOrEqual(1);
    });

    it('非法学号不做格式校验，返回 200 + 空结果（参数化查询，无注入风险）', async () => {
      const res = await asAdmin(request(app).get('/api/answers/student/xyz123'));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalWenCount).toBe(0);
    });
  });
});

describe('登录接口', () => {
  describe('POST /api/auth/student/login', () => {
    it('学号不存在应返回 401 INVALID_CREDENTIALS', async () => {
      const res = await request(app)
        .post('/api/auth/student/login')
        .send({ student_id: '12345678', password: 'whatever123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('INVALID_CREDENTIALS');
      expect(res.body.message).toBe('学号或密码错误');
    });

    it('缺少必填字段应返回 400', async () => {
      const res = await request(app).post('/api/auth/student/login').send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('遗留免密登录 POST /api/auth/login 已下线，应返回 404', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ student_id: '99999999' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    });
  });
});
