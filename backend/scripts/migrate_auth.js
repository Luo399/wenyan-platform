/**
 * 账号体系迁移脚本
 *
 * 用途：
 *  1. 若 students_old 表存在（旧结构 students 被重命名而来），
 *     将其中的数据逐行迁移到新 students 表，使用默认密码 123456。
 *     对于不符合"学号长度 >= 6"的旧学生（如历史 4 位学号 "1001"），
 *     class_code 用构造占位值 "000000"，标记 created_by = 'migration:legacy-short-id'。
 *  2. 初始化一个默认管理员账号（若 admins 为空）：
 *       username: admin
 *       password: admin123   （首次部署后请立即修改）
 *  3. 初始化一个示例学校（若 schools 为空），便于教师注册时选择。
 *
 * 运行：
 *   node backend/scripts/migrate_auth.js
 *
 * 幂等：可重复执行，已迁移过的行将按 UNIQUE(student_id) 被跳过。
 */

const path = require('path')
const { db, initAllTables } = require(path.join(__dirname, '../src/config/database'))
const { getDefaultPasswordHash, extractClassCode } = require(path.join(
  __dirname,
  '../src/services/authService',
))
const { dbRun, dbAll, dbGet } = require(path.join(__dirname, '../src/utils/dbPromise'))

async function seedDefaultSchool() {
  const row = await dbGet(db, 'SELECT id FROM schools LIMIT 1')
  if (row) {
    console.log('[migrate] schools 已有数据，跳过默认学校初始化')
    return
  }
  await dbRun(
    db,
    `INSERT INTO schools (code, name) VALUES (?, ?)`,
    ['DEFAULT-SCHOOL-001', '默认学校（请在管理后台修改）'],
  )
  console.log('[migrate] 已插入示例学校')
}

async function seedDefaultAdmin() {
  const row = await dbGet(db, 'SELECT id FROM admins LIMIT 1')
  if (row) {
    console.log('[migrate] admins 已有数据，跳过默认管理员初始化')
    return
  }
  const bcrypt = require('bcryptjs')
  const hash = await bcrypt.hash('admin123', 10)
  await dbRun(
    db,
    `INSERT INTO admins (username, name, password_hash, role) VALUES (?, ?, ?, 'super_admin')`,
    ['admin', '超级管理员', hash],
  )
  console.log('[migrate] 已插入默认管理员  username=admin  password=admin123  (请立即修改)')
}

async function migrateOldStudents() {
  // 检查 students_old 是否存在
  const cols = await new Promise((resolve, reject) => {
    db.all("PRAGMA table_info(students_old)", (err, r) => {
      if (err) return reject(err)
      resolve(r || [])
    })
  })
  if (!cols || cols.length === 0) {
    console.log('[migrate] 未找到 students_old 表，跳过旧学生迁移')
    return
  }

  const oldRows = await dbAll(db, 'SELECT * FROM students_old')
  if (!oldRows || oldRows.length === 0) {
    console.log('[migrate] students_old 表为空，跳过旧学生迁移')
    return
  }

  const defaultHash = await getDefaultPasswordHash()
  const now = new Date().toISOString()

  const stmt = await new Promise((resolve, reject) => {
    const s = db.prepare(
      `INSERT OR IGNORE INTO students
         (student_id, student_name, class_code, school_id,
          password_hash, must_reset_password, created_by,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      (err) => {
        if (err) return reject(err)
        resolve(s)
      },
    )
  })

  let migrated = 0
  let skipped = 0

  for (const r of oldRows) {
    // 旧表列名可能有两种：(1) 老 init_db.js 中的 student_id + name
    // (2) config/database.js 老版本的 student_id + student_name
    const sid = String(r.student_id || '')
    const sname = String(r.student_name || r.name || '未命名学生')
    let cc = extractClassCode(sid)
    let createdBy = 'migration'
    if (!cc) {
      // 历史短学号，占位 class_code
      cc = '000000'
      createdBy = 'migration:legacy-short-id'
    }
    await new Promise((resolve, reject) => {
      stmt.run([sid, sname, cc, null, defaultHash, createdBy, now, now], function (err) {
        if (err) return reject(err)
        if (this.changes && this.changes > 0) migrated++
        else skipped++
        resolve()
      })
    })
  }

  await new Promise((resolve, reject) => stmt.finalize((err) => (err ? reject(err) : resolve())))
  console.log(
    `[migrate] 旧学生迁移完成：新增 ${migrated} 条，重复跳过 ${skipped} 条（共 ${oldRows.length} 条）`,
  )
}

async function main() {
  try {
    await initAllTables()
    await seedDefaultSchool()
    await seedDefaultAdmin()
    await migrateOldStudents()
    console.log('[migrate] 全部步骤完成')
  } catch (err) {
    console.error('[migrate] 迁移失败:', err)
    process.exitCode = 1
  } finally {
    db.close()
  }
}

main()
