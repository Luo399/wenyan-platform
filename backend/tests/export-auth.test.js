/**
 * 数据导出 API 鉴权测试
 *
 * 验证 /api/export/* 导出接口在设置 DASHBOARD_PASSWORD 后：
 * 1. 无 token 时返回 401
 * 2. 错误 token 时返回 401
 * 3. 正确 token 时放行
 *
 * 回归背景：导出接口返回完整埋点数据和答题数据（含学生学号），
 * 必须与 /api/tracking/* 分析接口同等鉴权保护。
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');

// 使用内存数据库避免污染工作区
process.env.DB_PATH = ':memory:';

let app;

beforeAll(async () => {
  process.env.TEST_MODE = 'true';
  const { initAllTables } = require('../src/config/database');
  await initAllTables();
  const { createApp } = require('../src/app');
  app = createApp();
});

afterEach(() => {
  delete process.env.DASHBOARD_PASSWORD;
});

describe('数据导出 API 鉴权 - /api/export/*', () => {
  const EXPORT_ENDPOINTS = [
    '/api/export/tracking-events',
    '/api/export/answers',
    '/api/export/dashboard-summary',
  ];

  describe('未设置 DASHBOARD_PASSWORD 时（开发环境）', () => {
    it('应放行所有导出接口', async () => {
      for (const url of EXPORT_ENDPOINTS) {
        const res = await request(app).get(url);
        // 不应是 401
        expect(res.status).not.toBe(401);
      }
    });
  });

  describe('设置 DASHBOARD_PASSWORD 时（生产环境）', () => {
    const password = 'export-test-secret-2026';

    beforeEach(() => {
      process.env.DASHBOARD_PASSWORD = password;
    });

    it('无 Authorization 头时应返回 401', async () => {
      for (const url of EXPORT_ENDPOINTS) {
        const res = await request(app).get(url);
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe('DASHBOARD_AUTH_REQUIRED');
      }
    });

    it('错误 token 时应返回 401', async () => {
      for (const url of EXPORT_ENDPOINTS) {
        const res = await request(app)
          .get(url)
          .set('Authorization', 'Bearer wrong-password');
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('DASHBOARD_AUTH_FAILED');
      }
    });

    it('正确 token 时应放行', async () => {
      for (const url of EXPORT_ENDPOINTS) {
        const res = await request(app)
          .get(url)
          .set('Authorization', `Bearer ${password}`);
        expect(res.status).not.toBe(401);
      }
    });

    it('answers 导出接口（含学生学号/姓名）必须鉴权', async () => {
      const noAuthRes = await request(app).get('/api/export/answers');
      expect(noAuthRes.status).toBe(401);

      const wrongAuthRes = await request(app)
        .get('/api/export/answers')
        .set('Authorization', 'Bearer invalid');
      expect(wrongAuthRes.status).toBe(401);

      const correctRes = await request(app)
        .get('/api/export/answers')
        .set('Authorization', `Bearer ${password}`);
      expect(correctRes.status).toBe(200);
    });

    it('tracking-events 导出接口必须鉴权', async () => {
      const noAuthRes = await request(app).get('/api/export/tracking-events');
      expect(noAuthRes.status).toBe(401);

      const correctRes = await request(app)
        .get('/api/export/tracking-events')
        .set('Authorization', `Bearer ${password}`);
      expect(correctRes.status).toBe(200);
    });
  });
});
