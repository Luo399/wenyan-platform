const express = require('express')
const cors = require('cors')
const helmet = require('helmet')

const config = require('./config/app')
const logger = require('./utils/logger')
const { initAllTables } = require('./config/database')
const { registerRoutes } = require('./routes')
const { errorHandler, notFoundHandler, requestLogger } = require('./middleware/errorHandler')
const { globalLimiter } = require('./middleware/rateLimitMiddleware')

// S11: 进程级错误兜底——未捕获的 Promise rejection 记录日志；
// uncaughtException 记录后退出，由 PM2 自动重启，避免进程处于未知状态
process.on('unhandledRejection', (reason, promise) => {
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

  // CORS：临时放开所有来源（origin: true），用于 Figma 插件在 data: iframe 内跨域访问接口。
  // 注意：这是临时方案，存在安全降级风险。安全版本已备份至 backend/src/app.cjs.bak，
  // 待解决后恢复为显式白名单策略。
  app.use(
    cors({
      origin: true,
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
