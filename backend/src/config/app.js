const path = require('path')
const dotenv = require('dotenv')

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env'

dotenv.config({ path: path.join(__dirname, '../../', envFile) })

// S02: 生产环境缺少 JWT_SECRET 时直接启动失败，禁止静默回退到可预测弱密钥
const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production')
}

// S10: 环境变量读取的数值统一转 number，避免字符串传入 express-rate-limit 等数值型配置
function toNumber(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

// S06: CORS 白名单数组化，支持逗号分隔多域名；未配置时仅允许本地开发源
function parseOriginList(value) {
  if (!value || !value.trim()) {
    return ['http://localhost:5173']
  }
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

const config = {
  server: {
    port: toNumber(process.env.PORT, 3000),
    host: process.env.HOST || '0.0.0.0',
  },

  cors: {
    origin: parseOriginList(process.env.CORS_ORIGIN),
    methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
    credentials: true,
  },

  jsonParser: {
    limit: process.env.JSON_LIMIT || '1mb',
  },

  jwt: {
    // 开发/测试环境使用显式 dev 密钥；生产环境无 JWT_SECRET 时已在上方抛错
    secret: jwtSecret || 'wenyan_platform_dev_secret_do_not_use_in_production',
    expiresIn: toNumber(process.env.JWT_EXPIRES_IN, 3600),
  },

  data: {
    basePath: process.env.DATA_BASE_PATH || path.join(__dirname, '../../data'),
  },

  logger: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG'),
    format: process.env.LOG_FORMAT || (process.env.NODE_ENV === 'production' ? 'json' : 'console'),
    outputDir: process.env.LOG_DIR || path.join(__dirname, '../../logs'),
    maxFileSize: process.env.LOG_MAX_FILE_SIZE || '10MB',
    maxFiles: process.env.LOG_MAX_FILES || 30,
  },

  rateLimit: {
    submitRequests: toNumber(process.env.RATE_LIMIT_SUBMIT, 10),
    submitWindowMs: toNumber(process.env.RATE_LIMIT_SUBMIT_WINDOW, 60000),
    globalRequests: toNumber(process.env.RATE_LIMIT_GLOBAL, 100),
    globalWindowMs: toNumber(process.env.RATE_LIMIT_GLOBAL_WINDOW, 60000),
    // S05: 登录接口专用限流，防暴力破解
    loginRequests: toNumber(process.env.RATE_LIMIT_LOGIN, 5),
    loginWindowMs: toNumber(process.env.RATE_LIMIT_LOGIN_WINDOW, 60000),
  },

  testMode: process.env.TEST_MODE === 'true',
}

module.exports = config