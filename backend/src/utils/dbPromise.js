/**
 * SQLite 回调风格 Promise 化工具
 */

/**
 * 包装 db.get，返回单行结果
 * @param {import('sqlite3').Database} db
 * @param {string} sql
 * @param {Array} [params]
 * @returns {Promise<object|undefined>}
 */
function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

/**
 * 包装 db.all，返回所有行
 * @param {import('sqlite3').Database} db
 * @param {string} sql
 * @param {Array} [params]
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
 * 包装 db.run，返回 { lastID, changes }
 * @param {import('sqlite3').Database} db
 * @param {string} sql
 * @param {Array} [params]
 * @returns {Promise<{lastID: number, changes: number}>}
 */
function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

/**
 * 包装 db.prepare + stmt.run + stmt.finalize，返回 { lastID, changes }
 * @param {import('sqlite3').Database} db
 * @param {string} sql
 * @param {Array} [params]
 * @returns {Promise<{lastID: number, changes: number}>}
 */
function dbPrepareRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(sql);
    stmt.run(...params, function (err) {
      stmt.finalize();
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

/**
 * 包装 db.serialize，在串行区执行异步操作
 * @param {import('sqlite3').Database} db
 * @param {function} operations - 返回 Promise 的异步函数
 * @returns {Promise} operations 的返回值
 */
function dbSerialize(db, operations) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      operations().then(resolve).catch(reject);
    });
  });
}

module.exports = {
  dbGet,
  dbAll,
  dbRun,
  dbPrepareRun,
  dbSerialize,
};
