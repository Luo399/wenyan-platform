/**
 * 日志子系统配置（叶子模块）
 *
 * 从 `config/app.js` 里拆出来的原因是一条依赖方向：`utils/logger` 只要这五个值，
 * 却得 `require('../config/app')` 才能拿到——而那个模块在加载时装配整份应用配置，
 * 其中 `JWT_SECRET` 缺失（生产）和 `JWT_EXPIRES_IN` 非法都会直接 throw。
 * 结果是 28 个引用 logger 的文件，全都被动地跑了一遍应用级启动校验；
 * 反过来 `config/app.js` 自己也不能用 logger（会成环），只能用裸 `console.warn`。
 *
 * 取值、默认值、`__dirname` 相对路径与拆分前逐字相同，`config.app.js`
 * 仍以 `logger` 字段暴露同一个对象，调用方无感。
 */

require('./env')

const path = require('path')

module.exports = {
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG'),
  format: process.env.LOG_FORMAT || (process.env.NODE_ENV === 'production' ? 'json' : 'console'),
  outputDir: process.env.LOG_DIR || path.join(__dirname, '../../logs'),
  maxFileSize: process.env.LOG_MAX_FILE_SIZE || '10MB',
  maxFiles: process.env.LOG_MAX_FILES || 30,
}
