/**
 * 应用配置模块
 * 管理应用的全局配置项
 */

require('dotenv').config();

const config = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0'
  },

  // CORS配置
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type']
  },

  // JSON解析配置
  jsonParser: {
    limit: process.env.JSON_LIMIT || '10mb'
  },

  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'wenyan_platform_2026_secret_key',
    expiresIn: process.env.JWT_EXPIRES_IN || 3600 // 1小时
  },

  // 数据目录配置
  data: {
    basePath: './public/data'
  },

  // 测试模式
  testMode: process.env.TEST_MODE === 'true'
};

module.exports = config;