/**
 * PM2 配置文件
 * 用于管理 Node.js 应用进程
 */

module.exports = {
  apps: [
    {
      // E11: 入口统一为 server.js（与 package.json 的 main 及 deploy workflow 一致）
      // server.js 调用 src/app.js 的 startServer()；本文件为本地/参考配置，
      // deploy 实际使用 `pm2 start server.js --name wenyan-backend[-test]`
      name: 'wenyan-backend',
      script: 'server.js',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};