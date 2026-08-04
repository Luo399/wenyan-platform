/**
 * 埋点分析 API 鉴权测试
 *
 * 验证所有 /api/tracking/* 分析接口在设置 DASHBOARD_PASSWORD 后：
 * 1. 无 token 时返回 401
 * 2. 错误 token 时返回 401
 * 3. 正确 token 时放行
 *
 * 这是针对安全漏洞修复的回归测试：
 * 这些接口原本完全无鉴权，会泄露学生学号、成绩分组、会话路径等敏感数据。
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');

// 使用内存数据库避免污染工作区
process.env.DB_PATH = ':memory:';

const testDbDir = path.join(__dirname);
if (!fs.existsSync(testDbDir)) {
  fs.mkdirSync(testDbDir, { recursive: true });
}

let app;

beforeAll(async () => {
  process.env.TEST_MODE = 'true';
  const { initAllTables } = require('../src/config/database');
  await initAllTables();
  const { createApp } = require('../src/app');
  app = createApp();
});

afterEach(() => {
  // 清理密码配置，避免影响其他测试
  delete process.env.DASHBOARD_PASSWORD;
});

describe('埋点分析 API 鉴权 - /api/tracking/*', () => {
  const ANALYSIS_ENDPOINTS = [
    '/api/tracking/funnel',
    '/api/tracking/interaction',
    '/api/tracking/search-trend',
    '/api/tracking/quiz-performance',
    '/api/tracking/session-path',
    '/api/tracking/active-users',
    '/api/tracking/hourly-activity',
    '/api/tracking/session-stats',
    '/api/tracking/feature-usage',
    '/api/tracking/cohort-analysis',
  ];

  describe('未设置 DASHBOARD_PASSWORD 时（开发环境）', () => {
    it('应放行所有分析接口', async () => {
      // 开发环境无密码时放行，不应返回 401
      for (const url of ANALYSIS_ENDPOINTS) {
        const res = await request(app).get(url);
        expect(res.status).not.toBe(401);
      }
    });
  });

  describe('设置 DASHBOARD_PASSWORD 时（生产环境）', () => {
    const password = 'test-dashboard-secret-2026';

    beforeEach(() => {
      process.env.DASHBOARD_PASSWORD = password;
    });

    it('无 Authorization 头时应返回 401', async () => {
      for (const url of ANALYSIS_ENDPOINTS) {
        const res = await request(app).get(url);
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe('DASHBOARD_AUTH_REQUIRED');
      }
    });

    it('错误 token 时应返回 401', async () => {
      for (const url of ANALYSIS_ENDPOINTS) {
        const res = await request(app)
          .get(url)
          .set('Authorization', 'Bearer wrong-password');
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('DASHBOARD_AUTH_FAILED');
      }
    });

    it('正确 token 时应放行（不返回 401）', async () => {
      for (const url of ANALYSIS_ENDPOINTS) {
        const res = await request(app)
          .get(url)
          .set('Authorization', `Bearer ${password}`);
        expect(res.status).not.toBe(401);
      }
    });

    it('cohort-analysis 接口（含学生学号/成绩分组）必须鉴权', async () => {
      // 重点验证：cohort-analysis 返回学生学号和成绩分组，是最敏感的接口
      const noAuthRes = await request(app).get('/api/tracking/cohort-analysis');
      expect(noAuthRes.status).toBe(401);

      const wrongAuthRes = await request(app)
        .get('/api/tracking/cohort-analysis')
        .set('Authorization', 'Bearer invalid');
      expect(wrongAuthRes.status).toBe(401);

      const correctRes = await request(app)
        .get('/api/tracking/cohort-analysis')
        .set('Authorization', `Bearer ${password}`);
      expect(correctRes.status).toBe(200);
      expect(correctRes.body.success).toBe(true);
    });
  });

  describe('埋点上报接口 POST /api/track（保持无鉴权）', () => {
    it('学生端上报接口无需密码即可访问', async () => {
      // POST /api/track 是学生端上报埋点的接口，应保持无鉴权
      process.env.DASHBOARD_PASSWORD = 'some-password';
      const res = await request(app)
        .post('/api/track')
        .send({ events: [] });
      // 400 是因为 events 为空数组（格式校验），不是 401（鉴权失败）
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });
});
