/**
 * dbPromise 工具测试 (Jest)
 */

const sqlite3 = require('sqlite3')
const { dbGet, dbAll, dbRun, stmtRun, dbTransaction } = require('../src/utils/dbPromise')

describe('dbPromise 工具函数', () => {
  let db

  beforeEach((done) => {
    // 创建内存数据库用于测试
    db = new sqlite3.Database(':memory:', (err) => {
      if (err) return done(err)
      // 创建测试表
      db.run(`
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          value INTEGER
        )
      `, done)
    })
  })

  afterEach((done) => {
    db.close(done)
  })

  describe('dbGet', () => {
    it('应该返回查询到的行', async () => {
      await dbRun(db, 'INSERT INTO test_table (name, value) VALUES (?, ?)', ['test', 100])
      const row = await dbGet(db, 'SELECT * FROM test_table WHERE name = ?', ['test'])
      expect(row.name).toBe('test')
      expect(row.value).toBe(100)
    })

    it('查询不存在时应返回 null', async () => {
      const row = await dbGet(db, 'SELECT * FROM test_table WHERE name = ?', ['notexist'])
      expect(row).toBeNull()
    })
  })

  describe('dbAll', () => {
    it('应该返回所有匹配的行', async () => {
      await dbRun(db, 'INSERT INTO test_table (name, value) VALUES (?, ?)', ['a', 1])
      await dbRun(db, 'INSERT INTO test_table (name, value) VALUES (?, ?)', ['b', 2])
      const rows = await dbAll(db, 'SELECT * FROM test_table ORDER BY id')
      expect(rows.length).toBe(2)
      expect(rows[0].name).toBe('a')
      expect(rows[1].name).toBe('b')
    })

    it('无数据时应返回空数组', async () => {
      const rows = await dbAll(db, 'SELECT * FROM test_table')
      expect(rows).toEqual([])
    })
  })

  describe('dbRun', () => {
    it('应该返回 changes 和 lastID', async () => {
      const result = await dbRun(db, 'INSERT INTO test_table (name, value) VALUES (?, ?)', ['test', 100])
      expect(result.changes).toBe(1)
      expect(result.lastID).toBeGreaterThan(0)
    })

    it('更新操作应返回正确的 changes', async () => {
      await dbRun(db, 'INSERT INTO test_table (name, value) VALUES (?, ?)', ['test', 100])
      const result = await dbRun(db, 'UPDATE test_table SET value = ? WHERE name = ?', [200, 'test'])
      expect(result.changes).toBe(1)
    })

    it('删除操作应返回正确的 changes', async () => {
      await dbRun(db, 'INSERT INTO test_table (name, value) VALUES (?, ?)', ['test', 100])
      const result = await dbRun(db, 'DELETE FROM test_table WHERE name = ?', ['test'])
      expect(result.changes).toBe(1)
    })
  })

  describe('stmtRun', () => {
    it('应该执行预处理语句', async () => {
      const stmt = db.prepare('INSERT INTO test_table (name, value) VALUES (?, ?)')
      const result = await stmtRun(stmt, 'prepared', 999)
      expect(result.changes).toBe(1)
      expect(result.lastID).toBeGreaterThan(0)
      stmt.finalize() // 清理语句
    })
  })

  describe('dbTransaction', () => {
    it('事务成功时应提交', async () => {
      await dbTransaction(db, async ({ dbRun }) => {
        // dbRun 已预绑定 db 参数，无需重复传入
        await dbRun('INSERT INTO test_table (name, value) VALUES (?, ?)', ['tx1', 1])
        await dbRun('INSERT INTO test_table (name, value) VALUES (?, ?)', ['tx2', 2])
      })

      const rows = await dbAll(db, 'SELECT * FROM test_table')
      expect(rows.length).toBe(2)
    })

    it('事务失败时应回滚', async () => {
      await expect(async () => {
        await dbTransaction(db, async ({ dbRun }) => {
          await dbRun('INSERT INTO test_table (name, value) VALUES (?, ?)', ['tx1', 1])
          throw new Error('测试错误')
        })
      }).rejects.toThrow('测试错误')

      const rows = await dbAll(db, 'SELECT * FROM test_table')
      expect(rows.length).toBe(0)
    })

    it('并发事务应串行执行且全部成功（回归：曾被模块级 transactionActive 误判为嵌套）', async () => {
      const runOne = (name) =>
        dbTransaction(db, async ({ dbRun }) => {
          // 模拟真实事务内的异步读写
          await dbRun('INSERT INTO test_table (name, value) VALUES (?, ?)', [name, 1])
          return name
        })

      const results = await Promise.all(
        ['c1', 'c2', 'c3', 'c4', 'c5'].map((name) => runOne(name)),
      )

      expect(results).toEqual(['c1', 'c2', 'c3', 'c4', 'c5'])
      const rows = await dbAll(db, 'SELECT * FROM test_table')
      expect(rows.length).toBe(5)
    })

    it('同一事务内部再次调用 dbTransaction 应被拒绝（防死锁）', async () => {
      await expect(
        dbTransaction(db, async () => {
          await dbTransaction(db, async () => undefined)
        }),
      ).rejects.toThrow('dbTransaction 不支持嵌套调用')
    })
  })
})