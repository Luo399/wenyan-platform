/**
 * 应用配置模块
 * 管理应用的全局配置项
 */

const path = require('path')
const dotenv = require('dotenv')

const envPath = path.join(__dirname, '../../')
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env'
dotenv.config({ path: path.join(envPath, envFile) })

const config = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
  },

  // CORS配置
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  },

  // JSON解析配置
  jsonParser: {
    limit: process.env.JSON_LIMIT || '10mb',
  },

  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'wenyan_platform_2026_secret_key',
    expiresIn: process.env.JWT_EXPIRES_IN || 3600,
  },

  // 数据目录配置（题目数据在 backend/data/ 目录，与前端 public/data 结构一致）
  data: {
    basePath: process.env.DATA_BASE_PATH || path.join(__dirname, '../../data'),
  },

  // 日志配置
  logger: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG'),
    format: process.env.LOG_FORMAT || (process.env.NODE_ENV === 'production' ? 'json' : 'console'),
    outputDir: process.env.LOG_DIR || path.join(__dirname, '../../logs'),
    maxFileSize: process.env.LOG_MAX_FILE_SIZE || '10MB',
    maxFiles: process.env.LOG_MAX_FILES || 30,
  },

  // 限流配置
  rateLimit: {
    submitRequests: process.env.RATE_LIMIT_SUBMIT || 10,
    submitWindowMs: process.env.RATE_LIMIT_SUBMIT_WINDOW || 60000,
    globalRequests: process.env.RATE_LIMIT_GLOBAL || 100,
    globalWindowMs: process.env.RATE_LIMIT_GLOBAL_WINDOW || 60000,
  },

  // 测试模式
  testMode: process.env.TEST_MODE === 'true',
}

module.exports = config
