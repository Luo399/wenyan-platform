/**
 * SQLite 数据库 Promise 化工具模块
 * 将回调风格的数据库操作转换为 Promise
 */

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
 * 执行数据库事务
 * @param {import('sqlite3').Database} db - SQLite 数据库实例
 * @param {Function} fn - 事务函数，接收 dbRun/dbGet/dbAll 工具
 * @returns {Promise<any>} - 事务结果
 */
async function dbTransaction(db, fn) {
  await dbRun(db, 'BEGIN TRANSACTION')
  try {
    const result = await fn({ dbGet, dbAll, dbRun, stmtRun })
    await dbRun(db, 'COMMIT')
    return result
  } catch (err) {
    await dbRun(db, 'ROLLBACK')
    throw err
  }
}

module.exports = {
  dbGet,
  dbAll,
  dbRun,
  stmtRun,
  dbTransaction,
}