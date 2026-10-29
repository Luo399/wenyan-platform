/**
 * PM2 配置文件
 * 用于管理 Node.js 应用进程
 *
 * 入口是 backend/server.js（不是 src/app.js；src/app.js 只是 Express app 工厂，
 * 由 server.js 加载并 listen）。
 */

const path = require('path')

module.exports = {
  apps: [
    {
      name: 'backend',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // 绝对路径，避免 PM2 从其它 cwd 启动时把日志写到意外位置
      error_file: path.join(__dirname, 'logs', 'pm2-error.log'),
      out_file: path.join(__dirname, 'logs', 'pm2-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
}
