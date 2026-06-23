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
    ...data,
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
 * 输出日志到文件
 */
function fileOutput(logEntry) {
  const filePath = path.join(LOG_CONFIG.outputDir, `app-${getDateString()}.log`);
  const logLine = JSON.stringify(logEntry) + '\n';
  
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
    query: req.query,
    body: req.body ? sanitizeBody(req.body) : null,
    statusCode: res.statusCode,
    durationMs: duration,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('User-Agent'),
    userId: req.user?.userId || req.user?.id || null,
    studentId: req.user?.studentId || null,
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
    ...data,
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
    ...context,
  };
  
  consoleOutput(logEntry);
  
  if (process.env.NODE_ENV === 'production') {
    fileOutput(logEntry);
  }
}

/**
 * 清理敏感信息
 */
function sanitizeBody(body) {
  if (typeof body !== 'object') {
    return body;
  }
  
  const sensitiveFields = ['password', 'token', 'secret', 'authorization'];
  const sanitized = { ...body };
  
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
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
