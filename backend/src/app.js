const express = require('express')
const cors = require('cors')
const helmet = require('helmet')

const config = require('./config/app')
const logger = require('./utils/logger')
const { initAllTables } = require('./config/database')
const { migrateAiTables } = require('../scripts/migrate_ai')
const { registerRoutes } = require('./routes')
const { errorHandler, notFoundHandler, requestLogger } = require('./middleware/errorHandler')
const { globalLimiter } = require('./middleware/rateLimitMiddleware')
const aiAlerts = require('./services/aiAlerts')

// S11: 进程级错误兜底——未捕获的 Promise rejection 记录日志；
// uncaughtException 记录后退出，由 PM2 自动重启，避免进程处于未知状态
process.on('unhandledRejection', (reason, _promise) => {
  logger.error('Unhandled Rejection:', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  })
})

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', {
    message: err.message,
    stack: err.stack,
  })
  process.exit(1)
})

function createApp() {
  const app = express()

  // 部署链路为 nginx(1 层) → Node，信任一层代理以获取真实客户端 IP（限流/审计依赖）
  app.set('trust proxy', 1)

  // S08: 开启 CSP（后端仅提供 JSON API，默认严格策略禁止加载外部内容）
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  )

  // CORS：按 CORS_ORIGIN 白名单（逗号分隔）校验来源；
  // 无 Origin 的请求（curl、服务端调用、同源）放行，白名单外来源直接 403
  const allowedOrigins = config.cors.origin
  app.use((req, res, next) => {
    const origin = req.headers.origin
    if (!origin || allowedOrigins.includes(origin)) return next()
    logger.warn('[cors] 拒绝非白名单来源', { origin, path: req.path })
    return res.status(403).json({
      success: false,
      error: 'CORS_ORIGIN_FORBIDDEN',
      message: '请求来源不在白名单',
    })
  })

  app.use(
    cors({
      origin(origin, callback) {
        // 无 Origin（curl / 服务端 / 同源）不参与跨域校验
        if (!origin) return callback(null, true)
        return callback(null, allowedOrigins.includes(origin))
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
      exposedHeaders: ['Authorization'],
      credentials: false,
      preflightContinue: false,
      optionsSuccessStatus: 204,
    }),
  )

  app.use(globalLimiter)

  app.use(express.json({ limit: config.jsonParser.limit }))

  app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    next()
  })

  app.use(requestLogger)

  // 移除 express.static：backend/public 下的 admin.html 无鉴权裸奔（已下线），
  // 后端仅提供 JSON API，静态资源统一由前端 OSS 承载

  // R7: /v1 版本前缀别名 —— 仅给缺失 /api 前缀的路径补齐，
  // 避免 /v1/api/texts 被改写成 /api/api/texts；/v1/texts 仍等价于 /api/texts
  //
  // 注意：不能写成 app.use('/v1', fn)。挂载式中间件返回时 Express 会用保存的
  // 原始 url 还原 req.url（router 的 restore 逻辑），改写等于没生效——实测
  // /v1/texts 会 404。必须在 app 级别判断前缀再改写。
  app.use((req, res, next) => {
    if (req.url === '/v1' || req.url.startsWith('/v1/') || req.url.startsWith('/v1?')) {
      // 去掉 /v1：/v1/texts → /texts → /api/texts；/v1/api/texts → /api/texts
      // （保留已有的 /api，避免出现 /api/api/texts）
      const rest = req.url.slice('/v1'.length)
      req.url = rest === '/api' || rest.startsWith('/api/') || rest.startsWith('/api?')
        ? rest
        : '/api' + rest
    }
    next()
  })

  registerRoutes(app)

  app.use('/api/health', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'OK',
      timestamp: new Date().toISOString(),
    })
  })

  app.use(notFoundHandler)

  app.use(errorHandler)

  return app
}

async function startServer() {
  try {
    await initAllTables()
    await migrateAiTables()
    aiAlerts.checkApiKeyStartup()

    const app = createApp()
    const { port, host } = config.server

    if (!config.testMode) {
      const server = app.listen(port, host, () => {
        logger.info(`服务器运行在 http://${host}:${port}`)
        logger.info(`CORS 白名单: ${config.cors.origin}`)
        // R90: 鉴权统一走 JWT，HMAC AUTH_SECRET 已弃用
      })

      // SIGINT / SIGTERM 统一优雅停机（PM2 reload 发送 SIGINT）
      const shutdown = (signal) => {
        logger.info(`收到 ${signal}，正在关闭服务器...`)
        server.close(() => {
          logger.info('服务器已关闭')
          process.exit(0)
        })
      }
      process.on('SIGINT', () => shutdown('SIGINT'))
      process.on('SIGTERM', () => shutdown('SIGTERM'))
    }

    return app
  } catch (err) {
    logger.error('启动服务器失败:', err)
    process.exit(1)
  }
}

if (require.main === module) {
  startServer()
}

module.exports = {
  createApp,
  startServer,
}
