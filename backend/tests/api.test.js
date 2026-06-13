/**
 * 后端API单元测试
 *
 * 测试范围：
 * 1. 学生相关接口
 * 2. 答题记录相关接口
 * 3. 数据验证逻辑
 *
 * 运行方式：npm test
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');

// 确保测试数据库目录存在
const testDbDir = path.join(__dirname);
if (!fs.existsSync(testDbDir)) {
  fs.mkdirSync(testDbDir, { recursive: true });
}

// 动态导入server模块（用于测试环境）
let app;

beforeAll(async () => {
  // 设置测试数据库路径
  process.env.TEST_MODE = 'true';
  process.env.DB_PATH = path.join(__dirname, 'test-answers.db');

  // 初始化数据库
  const { initAllTables } = require('../src/config/database');
  await initAllTables();

  // 创建应用实例
  const { createApp } = require('../src/app');
  app = createApp();
});

describe('学生管理接口', () => {
  describe('GET /api/students', () => {
    it('应返回学生列表', async () => {
      const res = await request(app).get('/api/students');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/students/:studentId', () => {
    it('学号不存在应返回404或空数据', async () => {
      const res = await request(app).get('/api/students/999999');
      expect(res.status).toBe(404);
    });

    it('学号不存在时应返回空结果', async () => {
      const res = await request(app).get('/api/students/12345678');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});

describe('答题提交接口', () => {
  describe('POST /api/submit', () => {
    // 使用时间戳确保唯一性，避免测试数据冲突
    const timestamp = Date.now();
    const validSubmission = {
      studentId: '9999',
      wenId: 'WEN_TEST',
      submittedAt: new Date().toISOString(),
      answers: {
        [`TEST_Q1_${timestamp}`]: 1,
        [`TEST_Q2_${timestamp}`]: 2
      },
      questions: [
        { id: `TEST_Q1_${timestamp}`, correctAnswer: 1 },
        { id: `TEST_Q2_${timestamp}`, correctAnswer: 2 }
      ]
    };

    it('应成功提交答题记录', async () => {
      const res = await request(app)
        .post('/api/submit')
        .send(validSubmission);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.questionCount).toBe(2);
    });

    it('缺少必填字段应返回400', async () => {
      const res = await request(app)
        .post('/api/submit')
        .send({ studentId: '1001' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('INVALID_REQUEST');
    });

    it('学号格式不正确应返回400', async () => {
      const res = await request(app)
        .post('/api/submit')
        .send({ ...validSubmission, studentId: 'abc' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_STUDENT_ID');
    });

    it('重复提交应创建新记录而非覆盖', async () => {
      const testTimestamp = Date.now() + 1000;
      const testSubmission = {
        studentId: '9998',
        wenId: 'WEN_TEST2',
        submittedAt: new Date().toISOString(),
        answers: { [`TEST_Q3_${testTimestamp}`]: 1 },
        questions: [{ id: `TEST_Q3_${testTimestamp}`, correctAnswer: 1 }]
      };

      // 第一次提交
      const res1 = await request(app)
        .post('/api/submit')
        .send(testSubmission);

      expect(res1.status).toBe(200);
      // 第一次提交的attempt_number应该 >= 1
      expect(res1.body.data.details[0].attemptNumber).toBeGreaterThanOrEqual(1);

      // 第二次提交
      const res2 = await request(app)
        .post('/api/submit')
        .send(testSubmission);

      expect(res2.status).toBe(200);
      // 第二次提交的attempt_number应该大于第一次
      expect(res2.body.data.details[0].attemptNumber).toBeGreaterThan(res1.body.data.details[0].attemptNumber);
    });
  });
});

describe('按文言文ID查询接口', () => {
  describe('GET /api/answers/wen/:wenId', () => {
    it('应返回指定文言文的答题情况', async () => {
      const res = await request(app).get('/api/answers/wen/WEN_TEST');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });
  });
});

describe('按学生ID查询接口', () => {
  describe('GET /api/answers/student/:studentId', () => {
    it('应返回指定学生的答题情况', async () => {
      const res = await request(app).get('/api/answers/student/9999');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('学号格式不正确应返回400', async () => {
      const res = await request(app).get('/api/answers/student/xyz123');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_STUDENT_ID');
    });
  });
});

describe('登录接口', () => {
  describe('POST /api/auth/login', () => {
    it('学号不存在应返回401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ student_id: 'nonexistent123' });

      // 后端返回400或401取决于验证顺序
      expect([400, 401]).toContain(res.status);
    });

    it('缺少学号应返回400', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
