const path = require('path')
const dotenv = require('dotenv')
const { parseDuration } = require('../utils/duration')

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env'

dotenv.config({ path: path.join(__dirname, '../../', envFile) })

// S02: 生产环境缺少 JWT_SECRET 时直接启动失败，禁止静默回退到可预测弱密钥
const isProduction = process.env.NODE_ENV === 'production'
const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret && isProduction) {
  throw new Error('JWT_SECRET must be set in production')
}

// 非生产环境允许固定开发密钥，但必须告警（禁止把该值带进生产）
const DEV_ONLY_JWT_SECRET = 'dev-only-secret'
if (!jwtSecret) {
  console.warn('[config] JWT_SECRET 未设置，使用开发专用密钥 dev-only-secret（仅限本地/测试）')
}

// F-003: JWT_EXPIRES_IN 支持秒数（3600）与单位写法（60s/30m/12h/7d）。
// 非法值直接启动失败，禁止静默回退：原实现 Number('7d') → NaN → 回退默认值，
// 运维以为配置已生效，实际仍是默认有效期。
const DEFAULT_JWT_EXPIRES_IN = 3600
const rawJwtExpiresIn = process.env.JWT_EXPIRES_IN
const jwtExpiresIn =
  rawJwtExpiresIn === undefined || String(rawJwtExpiresIn).trim() === ''
    ? DEFAULT_JWT_EXPIRES_IN
    : parseDuration(rawJwtExpiresIn)
if (jwtExpiresIn === null) {
  throw new Error(
    `JWT_EXPIRES_IN 配置非法: "${rawJwtExpiresIn}"（支持秒数或 60s/30m/12h/7d）`,
  )
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
    // 生产环境必须显式配置 JWT_SECRET（缺失已在上方抛错）；非生产使用 dev-only-secret 并告警
    secret: jwtSecret || DEV_ONLY_JWT_SECRET,
    expiresIn: jwtExpiresIn,
    algorithms: ['HS256'],
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

  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  },

  quota: {
    daily: toNumber(process.env.AI_QUOTA_DAILY, 8000),
    weekly: toNumber(process.env.AI_QUOTA_WEEKLY, 40000),
    monthly: toNumber(process.env.AI_QUOTA_MONTHLY, 120000),
  },

  ai: {
    maxConcurrent: toNumber(process.env.AI_MAX_CONCURRENT, 10),
    timeoutMs: toNumber(process.env.AI_TIMEOUT_MS, 30000),
    maxOutputTokens: toNumber(process.env.AI_MAX_OUTPUT_TOKENS, 1500),
  },
}

// DEEPSEEK_API_KEY 缺失时不硬阻断启动（AI 是可选功能），但在生产环境打 warn
// 实际调用时 aiService 会检查 apiKey 并返回 AI_UNAVAILABLE
if (process.env.NODE_ENV === 'production' && !config.deepseek.apiKey) {
  console.warn('[config] DEEPSEEK_API_KEY 未设置，AI 对话功能将返回 503')
}

module.exports = config