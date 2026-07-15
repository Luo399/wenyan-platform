const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');

const config = require('./config/app');
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
      const allowedOrigins = config.cors.origin === '*'
        ? ['https://www.classicalab.cn', 'https://api.classicalab.cn']
        : config.cors.origin.split(',');
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('不允许的跨域请求'));
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
      authEnabled: config.auth.secret.length > 0,
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
        console.log(`服务器运行在 http://${host}:${port}`);
        console.log(`CORS 白名单: ${config.cors.origin}`);
        console.log(`鉴权状态: ${config.auth.secret.length > 0 ? '已启用' : '未启用'}`);
      });

      process.on('SIGINT', () => {
        server.close(() => {
          console.log('服务器已关闭');
          process.exit(0);
        });
      });
    }

    return app;
  } catch (err) {
    console.error('启动服务器失败:', err);
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