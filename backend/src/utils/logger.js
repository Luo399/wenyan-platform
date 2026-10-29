/**
 * 结构化日志工具模块
 * 提供统一的日志记录功能，支持不同级别和结构化输出
 */

const fs = require('fs');
const path = require('path');
const config = require('../config/app');

/**
 * 日志级别枚举
 */
const LOG_LEVEL = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
};

/**
 * 日志配置（从app配置读取）
 */
const LOG_CONFIG = config.logger;

/**
 * 确保日志目录存在
 */
function ensureLogDir() {
  try {
    if (!fs.existsSync(LOG_CONFIG.outputDir)) {
      fs.mkdirSync(LOG_CONFIG.outputDir, { recursive: true });
    }
  } catch (err) {
    console.error('创建日志目录失败:', err);
  }
}

ensureLogDir();

/**
 * 获取当前日期字符串（YYYY-MM-DD）
 */
function getDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 获取当前时间戳（毫秒）
 */
function getTimestamp() {
  return Date.now();
}

/**
 * 获取当前时间ISO字符串
 */
function getISOTimestamp() {
  return new Date().toISOString();
}

/**
 * 判断是否需要记录该级别的日志
 */
function shouldLog(level) {
  const levels = [LOG_LEVEL.DEBUG, LOG_LEVEL.INFO, LOG_LEVEL.WARN, LOG_LEVEL.ERROR];
  const currentIndex = levels.indexOf(LOG_CONFIG.level);
  const targetIndex = levels.indexOf(level);
  return targetIndex >= currentIndex;
}

/**
 * 生成日志条目
 */
function createLogEntry(level, message, data = {}) {
  return {
    timestamp: getISOTimestamp(),
    timestampMs: getTimestamp(),
    level: level,
    message: message,
    ...normalizeLogData(data),
  };
}

/**
 * 输出日志到控制台
 */
function consoleOutput(logEntry) {
  const levelColors = {
    DEBUG: '\x1b[34m',
    INFO: '\x1b[32m',
    WARN: '\x1b[33m',
    ERROR: '\x1b[31m',
  };
  const resetColor = '\x1b[0m';
  
  const color = levelColors[logEntry.level] || '';
  const levelTag = `[${logEntry.level}]`;
  
  if (LOG_CONFIG.format === 'json') {
    console.log(JSON.stringify(logEntry));
  } else {
    const dataStr = Object.keys(logEntry).length > 3 
      ? ` ${JSON.stringify(logEntry, null, 2)}` 
      : '';
    console.log(`${color}${levelTag} ${logEntry.timestamp} - ${logEntry.message}${dataStr}${resetColor}`);
  }
}

/**
 * 解析 maxFileSize 配置字符串为字节数
 * 支持格式: "10MB", "1MB", "500KB" 等
 */
function parseMaxFileSize(sizeStr) {
  if (!sizeStr) return 10 * 1024 * 1024 // 默认 10MB
  const str = String(sizeStr).toUpperCase()
  const match = str.match(/^(\d+(?:\.\d+)?)\s*(KB|MB|GB|B)?$/)
  if (!match) return 10 * 1024 * 1024
  const num = parseFloat(match[1])
  const unit = match[2] || 'B'
  const multipliers = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 }
  return Math.floor(num * multipliers[unit])
}

const MAX_FILE_SIZE_BYTES = parseMaxFileSize(LOG_CONFIG.maxFileSize)
/** 日志保留天数：只按文件年龄清理，避免按数量清理时"越删越少" */
const LOG_RETENTION_DAYS = 14
/** 清理节流：每个进程每小时最多扫描一次日志目录 */
const LOG_CLEANUP_INTERVAL_MS = 60 * 60 * 1000
let lastLogCleanupAt = 0

/**
 * 从文件名解析日志日期（app-YYYY-MM-DD*.log），失败时回退到文件 mtime
 */
function getLogFileTime(fileName, filePath) {
  const match = fileName.match(/^app-(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    const time = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00`).getTime()
    if (!Number.isNaN(time)) return time
  }
  try {
    return fs.statSync(filePath).mtimeMs
  } catch {
    return null
  }
}

/**
 * 按年龄清理过期日志（保留 14 天）
 * - 只删除 app-*.log，且绝不动当天的文件
 * - 清理失败只打 console，不影响业务日志写入
 */
function cleanupExpiredLogs(now = Date.now()) {
  if (now - lastLogCleanupAt < LOG_CLEANUP_INTERVAL_MS) return
  lastLogCleanupAt = now

  const cutoff = now - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000
  const todayFile = path.join(LOG_CONFIG.outputDir, `app-${getDateString()}.log`)

  try {
    for (const fileName of fs.readdirSync(LOG_CONFIG.outputDir)) {
      if (!/^app-.*\.log$/.test(fileName)) continue
      const filePath = path.join(LOG_CONFIG.outputDir, fileName)
      if (filePath === todayFile) continue
      const fileTime = getLogFileTime(fileName, filePath)
      if (fileTime !== null && fileTime < cutoff) {
        fs.unlinkSync(filePath)
      }
    }
  } catch (err) {
    console.error('清理过期日志失败:', err.message)
  }
}

/**
 * B12: 检查并执行日志文件轮转
 * - 当日志文件超过 maxFileSize 时，将其重命名为带时间戳的归档文件
 * - 归档后按年龄清理（保留 14 天），不再按文件数量清理
 */
function rotateLogIfNeeded(filePath) {
  try {
    if (!fs.existsSync(filePath)) return

    const stats = fs.statSync(filePath)
    if (stats.size < MAX_FILE_SIZE_BYTES) return

    // 归档当前日志文件，加时间戳后缀
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const dir = path.dirname(filePath)
    const baseName = path.basename(filePath, '.log')
    const archivedPath = path.join(dir, `${baseName}-${timestamp}.log`)
    fs.renameSync(filePath, archivedPath)

    cleanupExpiredLogs()
  } catch (err) {
    console.error('日志轮转失败:', err.message)
  }
}

/**
 * 输出日志到文件（含 B12 日志轮转）
 */
function fileOutput(logEntry) {
  const filePath = path.join(LOG_CONFIG.outputDir, `app-${getDateString()}.log`);
  const logLine = JSON.stringify(logEntry) + '\n';

  // 按年龄清理（内部有节流，不会每次写日志都扫描目录）
  cleanupExpiredLogs()
  rotateLogIfNeeded(filePath)

  fs.appendFile(filePath, logLine, (err) => {
    if (err) {
      console.error('写入日志文件失败:', err);
    }
  });
}

/**
 * 记录日志
 */
function log(level, message, data = {}) {
  if (!shouldLog(level)) {
    return;
  }
  
  const logEntry = createLogEntry(level, message, data);
  
  consoleOutput(logEntry);
  
  if (process.env.NODE_ENV === 'production') {
    fileOutput(logEntry);
  }
}

/**
 * 调试级别日志
 */
function debug(message, data = {}) {
  log(LOG_LEVEL.DEBUG, message, data);
}

/**
 * 信息级别日志
 */
function info(message, data = {}) {
  log(LOG_LEVEL.INFO, message, data);
}

/**
 * 警告级别日志
 */
function warn(message, data = {}) {
  log(LOG_LEVEL.WARN, message, data);
}

/**
 * 错误级别日志
 */
function error(message, data = {}) {
  log(LOG_LEVEL.ERROR, message, data);
}

/**
 * 是否为认证相关路由（登录/注册/改密等，禁止整包打印 body）
 */
function isAuthRoute(req) {
  const pathname = req.path || req.originalUrl || ''
  return pathname.startsWith('/api/auth')
}

/**
 * 记录HTTP请求日志
 */
function logRequest(req, res, duration) {
  const logEntry = {
    timestamp: getISOTimestamp(),
    timestampMs: getTimestamp(),
    level: LOG_LEVEL.INFO,
    message: 'HTTP请求',
    type: 'REQUEST',
    method: req.method,
    path: req.path,
    query: req.query ? sanitizeBody(req.query) : null,
    // 认证路由不打印 body（即使脱敏也不记录密码/令牌原文）
    body: isAuthRoute(req) ? '[REDACTED]' : req.body ? sanitizeBody(req.body) : null,
    statusCode: res.statusCode,
    durationMs: duration,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('User-Agent'),
    // B09: 与 authController 签发的 payload 字段对齐
    // student -> student_id, teacher -> phone, admin -> username
    userId: req.user?.student_id || req.user?.phone || req.user?.username || null,
    studentId: req.user?.student_id || null,
  };
  
  consoleOutput(logEntry);
  
  if (process.env.NODE_ENV === 'production') {
    fileOutput(logEntry);
  }
}

/**
 * 记录业务操作日志
 */
function logOperation(operation, data = {}) {
  const logEntry = {
    timestamp: getISOTimestamp(),
    timestampMs: getTimestamp(),
    level: LOG_LEVEL.INFO,
    message: operation,
    type: 'OPERATION',
    ...normalizeLogData(data),
  };
  
  consoleOutput(logEntry);
  
  if (process.env.NODE_ENV === 'production') {
    fileOutput(logEntry);
  }
}

/**
 * 记录错误日志
 */
function logError(error, context = {}) {
  const logEntry = {
    timestamp: getISOTimestamp(),
    timestampMs: getTimestamp(),
    level: LOG_LEVEL.ERROR,
    message: error.message || '未知错误',
    type: 'ERROR',
    stack: error.stack,
    name: error.name,
    ...normalizeLogData(context),
  };
  
  consoleOutput(logEntry);
  
  if (process.env.NODE_ENV === 'production') {
    fileOutput(logEntry);
  }
}

/**
 * 清理敏感信息
 * 键名大小写不敏感，覆盖密码/令牌/密钥/会话等常见字段
 */
const SENSITIVE_KEY_PATTERN =
  /password|passwd|pwd|old_password|new_password|token|secret|authorization|cookie|api[-_]?key/i

const MAX_SANITIZE_DEPTH = 6
const MAX_LOG_STRING_LENGTH = 2000

function isSensitiveKey(key) {
  return typeof key === 'string' && SENSITIVE_KEY_PATTERN.test(key)
}

function sanitizeBody(body, depth = 0) {
  if (body === null || body === undefined) return body
  if (typeof body === 'string') {
    return body.length > MAX_LOG_STRING_LENGTH
      ? `${body.slice(0, MAX_LOG_STRING_LENGTH)}...[TRUNCATED]`
      : body
  }
  if (typeof body !== 'object') return body
  if (body instanceof Date) return body.toISOString()
  if (body instanceof Error) {
    return { name: body.name, message: body.message, stack: body.stack }
  }
  if (depth >= MAX_SANITIZE_DEPTH) return '[MAX_DEPTH]'
  if (Array.isArray(body)) return body.map((item) => sanitizeBody(item, depth + 1))

  const sanitized = {}
  for (const [key, value] of Object.entries(body)) {
    sanitized[key] = isSensitiveKey(key) ? '[REDACTED]' : sanitizeBody(value, depth + 1)
  }
  return sanitized
}

/**
 * 保证脱敏后的日志数据可直接展开进日志条目（非对象包一层 data）
 */
function normalizeLogData(data) {
  const sanitized = sanitizeBody(data)
  if (sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)) {
    return sanitized
  }
  return { data: sanitized }
}

module.exports = {
  LOG_LEVEL,
  debug,
  info,
  warn,
  error,
  logRequest,
  logOperation,
  logError,
  getTimestamp,
};
