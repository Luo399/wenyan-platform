/**
 * Express应用主模块
 * 配置和初始化Express应用
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

// 导入配置
const config = require('./config/app');
const { initTables } = require('./config/database');

// 导入路由
const { registerRoutes } = require('./routes');

// 导入中间件
const { errorHandler, notFoundHandler, requestLogger } = require('./middleware/errorHandler');

/**
 * 创建Express应用实例
 * @returns {object} - Express应用实例
 */
function createApp() {
  const app = express();

  // ============================================================
  // 中间件配置
  // ============================================================
  
  // CORS配置
  app.use(cors({
    origin: config.cors.origin,
    methods: config.cors.methods,
    allowedHeaders: config.cors.allowedHeaders,
  }));

  // JSON请求体解析，设置最大10MB
  app.use(express.json({ limit: config.jsonParser.limit }));

  // 设置UTF-8响应头，解决中文乱码问题
  app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
  });

  // 请求日志
  app.use(requestLogger);

  // 静态文件服务
  app.use(express.static(path.join(__dirname, '../public')));

  // ============================================================
  // 路由注册
  // ============================================================
  registerRoutes(app);

  // ============================================================
  // 错误处理
  // ============================================================
  
  // 404处理
  app.use(notFoundHandler);
  
  // 全局错误处理
  app.use(errorHandler);

  return app;
}

/**
 * 启动服务器
 */
async function startServer() {
  try {
    // 初始化数据库表
    await initTables();
    
    const app = createApp();
    const { port, host } = config.server;

    // 仅在非测试模式下启动服务器
    if (!config.testMode) {
      const server = app.listen(port, host, () => {
        console.log(`服务器运行在 http://${host}:${port}`);
      });

      // 优雅关闭
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

// 如果直接运行此文件，则启动服务器
if (require.main === module) {
  startServer();
}

// 导出应用实例用于测试
module.exports = {
  createApp,
  startServer
};