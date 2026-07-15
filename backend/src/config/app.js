const path = require('path')
const dotenv = require('dotenv')

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env'

dotenv.config({ path: path.join(__dirname, '../../', envFile) })

const config = {
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  },

  jsonParser: {
    limit: process.env.JSON_LIMIT || '10mb',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'wenyan_platform_2026_secret_key',
    expiresIn: process.env.JWT_EXPIRES_IN || 3600,
  },

  auth: {
    secret: process.env.AUTH_SECRET || '',
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
    submitRequests: process.env.RATE_LIMIT_SUBMIT || 10,
    submitWindowMs: process.env.RATE_LIMIT_SUBMIT_WINDOW || 60000,
    globalRequests: process.env.RATE_LIMIT_GLOBAL || 100,
    globalWindowMs: process.env.RATE_LIMIT_GLOBAL_WINDOW || 60000,
  },

  testMode: process.env.TEST_MODE === 'true',
}

module.exports = config