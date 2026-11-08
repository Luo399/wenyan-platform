/**
 * SQLite 数据库 Promise 化工具模块
 * 将回调风格的数据库操作转换为 Promise
 */

const { AsyncLocalStorage } = require('async_hooks')

/**
 * Promise 化数据库的 get 方法
 * @param {import('sqlite3').Database} db - SQLite 数据库实例
 * @param {string} sql - SQL 查询语句
 * @param {Array} params - 查询参数
 * @returns {Promise<object|null>} - 查询结果
 */
function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err)
      } else {
        resolve(row || null)
      }
    })
  })
}

/**
 * Promise 化数据库的 all 方法
 * @param {import('sqlite3').Database} db - SQLite 数据库实例
 * @param {string} sql - SQL 查询语句
 * @param {Array} params - 查询参数
 * @returns {Promise<Array>} - 查询结果数组
 */
function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err)
      } else {
        resolve(rows || [])
      }
    })
  })
}

/**
 * Promise 化数据库的 run 方法
 * @param {import('sqlite3').Database} db - SQLite 数据库实例
 * @param {string} sql - SQL 执行语句
 * @param {Array} params - 执行参数
 * @returns {Promise<{changes: number, lastID: number}>} - 执行结果
 */
function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err)
      } else {
        resolve({ changes: this.changes, lastID: this.lastID })
      }
    })
  })
}

/**
 * Promise 化预处理语句的 run 方法
 * @param {import('sqlite3').Statement} stmt - 预处理语句
 * @param {...any} params - 执行参数
 * @returns {Promise<{changes: number, lastID: number}>} - 执行结果
 */
function stmtRun(stmt, ...params) {
  return new Promise((resolve, reject) => {
    stmt.run(...params, function (err) {
      if (err) {
        reject(err)
      } else {
        resolve({ changes: this.changes, lastID: this.lastID })
      }
    })
  })
}

/**
 * 事务串行队列：
 * 模块级单连接上 BEGIN/COMMIT/ROLLBACK 没有互斥，两个并发事务会互相把对方的
 * 事务提交或回滚掉。这里用 Promise 链把所有事务串行化，保证任意时刻只有一个事务。
 */
let transactionQueue = Promise.resolve()

/**
 * 嵌套调用检测：
 * 只认"同一调用链内再次进入事务"（真正的嵌套，会等待自己而死锁）。
 * 不能用模块级 boolean 判断——并发请求之间共享该标记，会把第二个并发请求
 * 误判为嵌套调用直接失败（两个学生同时提交答案即触发 500）。
 * AsyncLocalStorage 让标记只对当前事务回调的异步调用链可见。
 */
const transactionContext = new AsyncLocalStorage()

/**
 * 执行数据库事务（同一进程内串行执行）
 * @param {import('sqlite3').Database} db - SQLite 数据库实例
 * @param {Function} fn - 事务函数，接收 dbRun/dbGet/dbAll 工具
 * @returns {Promise<any>} - 事务结果
 */
function dbTransaction(db, fn) {
  // 事务内部再次调用 dbTransaction 会等待自己，必然死锁；直接拒绝并提示调用方
  if (transactionContext.getStore()) {
    return Promise.reject(new Error('dbTransaction 不支持嵌套调用'))
  }

  const execute = () =>
    transactionContext.run(true, async () => {
      try {
        await dbRun(db, 'BEGIN TRANSACTION')
        // 将 dbRun/dbGet/dbAll 预绑定 db 参数，事务内调用时无需重复传 db
        const result = await fn({
          dbGet: (sql, params = []) => dbGet(db, sql, params),
          dbAll: (sql, params = []) => dbAll(db, sql, params),
          dbRun: (sql, params = []) => dbRun(db, sql, params),
          stmtRun,
        })
        await dbRun(db, 'COMMIT')
        return result
      } catch (err) {
        try {
          await dbRun(db, 'ROLLBACK')
        } catch {
          // BEGIN 失败时 ROLLBACK 也会失败，保留原始错误
        }
        throw err
      }
    })

  // 前一个事务无论成功失败，都不能阻断后续事务
  const result = transactionQueue.then(execute, execute)
  transactionQueue = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

module.exports = {
  dbGet,
  dbAll,
  dbRun,
  stmtRun,
  dbTransaction,
}