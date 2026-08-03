const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');

const config = require('./config/app');
const logger = require('./utils/logger');
const { initAllTables } = require('./config/database');
const { registerRoutes } = require('./routes');
const { errorHandler, notFoundHandler, requestLogger } = require('./middleware/errorHandler');
const { globalLimiter } = require('./middleware/rateLimitMiddleware');

function createApp() {
  const app = express();

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  app.use(cors({
    origin: function (origin, callback) {
      // 始终允许的域名（包括 OSS 独立看板桶）
      const fixedOrigins = [
        'https://www.classicalab.cn',
        'https://api.classicalab.cn',
        'https://classicalab.cn',
        'https://needed-data.classicalab.cn',
        'http://needed-data.classicalab.cn',
      ]
      // 合并 CORS_ORIGIN 环境变量中配置的域名
      const configuredOrigins = config.cors.origin === '*'
        ? []
        : config.cors.origin.split(',').map(s => s.trim()).filter(Boolean)
      const allowedOrigins = [...new Set([...fixedOrigins, ...configuredOrigins])]
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(null, false)
      }
    },
    methods: config.cors.methods,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Authorization'],
    credentials: config.cors.credentials,
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: 86400,
  }));

  app.use(globalLimiter);

  app.use(express.json({ limit: config.jsonParser.limit }));

  app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
  });

  app.use(requestLogger);

  app.use(express.static(path.join(__dirname, '../public')));

  registerRoutes(app);

  app.use('/api/health', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'OK',
      timestamp: new Date().toISOString(),
    });
  });

  app.use(notFoundHandler);

  app.use(errorHandler);

  return app;
}

async function startServer() {
  try {
    await initAllTables();

    const app = createApp();
    const { port, host } = config.server;

    if (!config.testMode) {
      const server = app.listen(port, host, () => {
        logger.info(`服务器运行在 http://${host}:${port}`);
        logger.info(`CORS 白名单: ${config.cors.origin}`);
        // R90: 鉴权统一走 JWT，HMAC AUTH_SECRET 已弃用
      });

      process.on('SIGINT', () => {
        server.close(() => {
          logger.info('服务器已关闭');
          process.exit(0);
        });
      });
    }

    return app;
  } catch (err) {
    logger.error('启动服务器失败:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createApp,
  startServer
};