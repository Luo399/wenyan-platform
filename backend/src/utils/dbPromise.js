/**
 * SQLite3 Promise 化工具
 * 将 sqlite3 的回调风格 API 包装为 Promise
 */

/**
 * 包装 db.run
 * @param {object} db - sqlite3 数据库实例
 * @param {string} sql - SQL 语句
 * @param {Array} [params=[]] - 参数数组
 * @returns {Promise<{changes: number, lastID: number}>}
 */
function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

/**
 * 包装 db.get
 * @param {object} db - sqlite3 数据库实例
 * @param {string} sql - SQL 语句
 * @param {Array} [params=[]] - 参数数组
 * @returns {Promise<object|null>}
 */
function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

/**
 * 包装 db.all
 * @param {object} db - sqlite3 数据库实例
 * @param {string} sql - SQL 语句
 * @param {Array} [params=[]] - 参数数组
 * @returns {Promise<Array>}
 */
function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

/**
 * 包装 db.prepare().run()
 * @param {object} db - sqlite3 数据库实例
 * @param {string} sql - SQL 语句
 * @param {Array} [params=[]] - 参数数组
 * @returns {Promise<{changes: number, lastID: number}>}
 */
function dbPrepareRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(sql);
    const callback = function (err) {
      stmt.finalize();
      if (err) return reject(err);
      resolve({ changes: this.changes, lastID: this.lastID });
    };
    if (Array.isArray(params) && params.length > 0) {
      stmt.run(...params, callback);
    } else {
      stmt.run(callback);
    }
  });
}

module.exports = {
  dbRun,
  dbGet,
  dbAll,
  dbPrepareRun,
};
