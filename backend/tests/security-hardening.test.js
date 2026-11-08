/**
 * 安全加固回归测试（集成层，走真实 Express 路由 + 内存 SQLite）
 *
 * 覆盖 2026-10 全量审查里「已修但此前没有 HTTP 级测试」的条目：
 * - P0-7  CORS 白名单（非白名单 Origin 直接 403，不进业务）
 * - P2-45 /v1 前缀别名不再重复拼 /api
 * - P0-1  zod 校验中间件：非法参数 → 400 VALIDATION_ERROR
 * - P1-46 登录先验密再判状态（错误密码不泄露「待审批」）
 * - P1-16 公开注册不能自带 can_view_all
 * - P1-20 /api/track 不信任 body.user_id（匿名记空串，登录记学号）
 * - P2-42 texts/batch 单次 ≤ 50 且校验 ID 白名单
 * - P1-22 资产上传必须带令牌、拒绝 SVG
 * - P1-24 预签名路径/Content-Type 白名单
 * - P1-48 重置口令是一次性随机值 + must_reset_password=1 + 审计
 * - P1-21 删除学生级联清理 answers / tracking_events / password_resets
 * - P3-47 改密：验原密码、成功后 must_reset_password=0
 * - F-004 令牌刷新：无 token 401，有 token 换新
 * - P1-20 姓名回显接口必须登录
 */

const request = require('supertest')

// 必须在 require config 之前设置（config 在模块加载时读取 env）
process.env.DB_PATH = ':memory:'
process.env.JWT_SECRET = 'ci-test-secret'
process.env.TEST_MODE = 'true'
process.env.INITIAL_ADMIN_USERNAME = 'admin'
process.env.INITIAL_ADMIN_PASSWORD = 'AdminInit#2024'
// 限流全部放宽，避免本文件的多组登录互相挤占配额；限流本身另有单测
process.env.RATE_LIMIT_GLOBAL = '100000'
process.env.RATE_LIMIT_LOGIN = '1000'
process.env.RATE_LIMIT_SUBMIT = '1000'
process.env.CORS_ORIGIN = 'https://www.classicalab.cn,https://test.classicalab.cn'
process.env.ASSET_SYNC_TOKEN = 'asset-sync-test-token'
process.env.DASHBOARD_PASSWORD = 'dash-test-secret'

let app
let studentToken
let adminToken

/** 登录并取 token（登录失败直接炸，避免后续断言变成迷雾） */
async function login(path, body) {
  const res = await request(app).post(path).send(body)
  if (res.status !== 200 || typeof res.body.data?.token !== 'string') {
    throw new Error(`登录失败 ${path}: ${res.status} ${JSON.stringify(res.body)}`)
  }
  return res.body.data.token
}

const asStudent = (agent) => agent.set('Authorization', `Bearer ${studentToken}`)
const asAdmin = (agent) => agent.set('Authorization', `Bearer ${adminToken}`)

/** db 句柄在 config/database，查询封装在 utils/dbPromise，两者不在同一模块 */
function dbHelpers() {
  const { db } = require('../src/config/database')
  const { dbGet, dbAll } = require('../src/utils/dbPromise')
  return { db, dbGet, dbAll }
}

beforeAll(async () => {
  const { initAllTables } = require('../src/config/database')
  await initAllTables()

  const { createApp } = require('../src/app')
  app = createApp()

  studentToken = await login('/api/auth/student/login', {
    student_id: '99999999',
    password: '99999999',
  })
  adminToken = await login('/api/auth/admin/login', {
    username: process.env.INITIAL_ADMIN_USERNAME,
    password: process.env.INITIAL_ADMIN_PASSWORD,
  })
})

describe('CORS 白名单（P0-7）', () => {
  it('非白名单 Origin 直接 403，且不返回 ACAO', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example')

    expect(res.status).toBe(403)
    expect(res.body.error).toBe('CORS_ORIGIN_FORBIDDEN')
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('白名单 Origin 放行并回显 ACAO', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://www.classicalab.cn')

    expect(res.status).toBe(200)
    expect(res.headers['access-control-allow-origin']).toBe('https://www.classicalab.cn')
  })

  it('不带 Origin 的服务端调用不受影响', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
  })
})

describe('/v1 版本前缀别名（P2-45）', () => {
  it('/v1/texts 等价于 /api/texts', async () => {
    const apiRes = await request(app).get('/api/texts')
    const v1Res = await request(app).get('/v1/texts')

    expect(apiRes.status).toBe(200)
    expect(v1Res.status).toBe(200)
    expect(v1Res.body.data).toEqual(apiRes.body.data)
  })

  it('/v1/api/texts 不会被拼成 /api/api/texts', async () => {
    const res = await request(app).get('/v1/api/texts')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

describe('zod 校验中间件（P0-1）', () => {
  it('学号格式非法 → 400 VALIDATION_ERROR，且提示首条 issue', async () => {
    const res = await request(app)
      .post('/api/auth/student/login')
      .send({ student_id: 'abc', password: '123456' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toBe('VALIDATION_ERROR')
    expect(res.body.message).toContain('学号')
  })

  it('缺字段 → 400 而不是 500（校验层兜住类型错误）', async () => {
    const res = await request(app).post('/api/auth/student/login').send({ student_id: '20240001' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('VALIDATION_ERROR')
  })
})

describe('登录顺序：先验密再判账号状态（P1-46）', () => {
  const phone = '13900000001'
  const password = 'Teacher#123'

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/teacher/register')
      .send({ phone, name: '待审教师', password, class_codes: ['202401'] })
    expect([200, 201]).toContain(res.status)
  })

  it('密码错误时返回 401，不泄露「账号待审批」', async () => {
    const res = await request(app)
      .post('/api/auth/teacher/login')
      .send({ phone, password: 'WrongPass#1' })

    expect(res.status).toBe(401)
    expect(res.body.error).toBe('INVALID_CREDENTIALS')
  })

  it('密码正确但状态 pending → 403 ACCOUNT_PENDING', async () => {
    const res = await request(app).post('/api/auth/teacher/login').send({ phone, password })

    expect(res.status).toBe(403)
    expect(res.body.error).toBe('ACCOUNT_PENDING')
  })

  it('公开注册无法自带 can_view_all（P1-16）', async () => {
    const { db, dbGet } = dbHelpers()
    const row = await dbGet(db, 'SELECT can_view_all FROM teachers WHERE phone = ?', [phone])

    expect(row.can_view_all).toBe(0)
  })

  it('注册时传 can_view_all 也不会写进库', async () => {
    const res = await request(app)
      .post('/api/auth/teacher/register')
      .send({
        phone: '13900000002',
        name: '越权教师',
        password: 'Teacher#123',
        can_view_all: 1,
      })
    expect([200, 201]).toContain(res.status)

    const { db, dbGet } = dbHelpers()
    const row = await dbGet(db, 'SELECT can_view_all FROM teachers WHERE phone = ?', [
      '13900000002',
    ])
    expect(row.can_view_all).toBe(0)
  })
})

describe('埋点不接受客户端 user_id（P1-20）', () => {
  it('匿名上报时 body.user_id 被丢弃，落库为空串', async () => {
    const res = await request(app)
      .post('/api/track')
      .send({
        events: [
          {
            event_type: 'step_enter',
            user_id: 'spoofed-admin',
            session_id: 'sess-anon',
            step_id: 'step1',
          },
        ],
      })

    expect(res.status).toBe(200)

    const { db, dbGet } = dbHelpers()
    const row = await dbGet(db, 'SELECT user_id FROM tracking_events WHERE session_id = ?', [
      'sess-anon',
    ])
    expect(row.user_id).toBe('')
  })

  it('带学生 token 上报时 user_id 由服务端注入为学号', async () => {
    const res = await asStudent(request(app).post('/api/track')).send({
      events: [
        {
          event_type: 'step_enter',
          user_id: 'someone-else',
          session_id: 'sess-student',
          step_id: 'step1',
        },
      ],
    })

    expect(res.status).toBe(200)

    const { db, dbGet } = dbHelpers()
    const row = await dbGet(db, 'SELECT user_id FROM tracking_events WHERE session_id = ?', [
      'sess-student',
    ])
    expect(row.user_id).toBe('99999999')
  })

  it('姓名回显接口必须登录（防匿名枚举学号）', async () => {
    const res = await request(app).get('/api/students/99999999/name')
    expect(res.status).toBe(401)
  })
})

describe('批量取文本上限（P2-42）', () => {
  it('超过 50 个 ID → 400 INVALID_REQUEST', async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `WEN_${String(i + 1).padStart(2, '0')}`)
    const res = await request(app).post('/api/texts/batch').send({ text_ids: ids })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('INVALID_REQUEST')
    expect(res.body.message).toContain('50')
  })

  it('ID 含路径穿越字符 → 400 INVALID_TEXT_ID', async () => {
    const res = await request(app)
      .post('/api/texts/batch')
      .send({ text_ids: ['../../etc/passwd'] })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('INVALID_TEXT_ID')
  })

  it('空数组 → 400', async () => {
    const res = await request(app).post('/api/texts/batch').send({ text_ids: [] })
    expect(res.status).toBe(400)
  })
})

describe('资产上传与预签名白名单（P1-22 / P1-24）', () => {
  it('没有 ASSET_SYNC_TOKEN 不能上传', async () => {
    const res = await request(app)
      .post('/api/assets/upload')
      .attach('file', Buffer.from('<svg/>'), { filename: 'a.svg', contentType: 'image/svg+xml' })

    expect(res.status).toBe(401)
  })

  it('带令牌也不能上传 SVG（可携带脚本）', async () => {
    const res = await request(app)
      .post('/api/assets/upload')
      .set('X-API-Key', process.env.ASSET_SYNC_TOKEN)
      .field('ossPath', 'images/general/a.svg')
      .attach('file', Buffer.from('<svg onload="alert(1)"/>'), {
        filename: 'a.svg',
        contentType: 'image/svg+xml',
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('INVALID_FILE_TYPE')
  })

  it('预签名拒绝路径穿越', async () => {
    const res = await request(app)
      .post('/api/assets/pre-signed')
      .set('X-API-Key', process.env.ASSET_SYNC_TOKEN)
      .send({ ossPath: '../../etc/passwd' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('PATH_NOT_ALLOWED')
  })

  it('预签名拒绝白名单外的 key（如 version.json）', async () => {
    const res = await request(app)
      .post('/api/assets/pre-signed')
      .set('X-API-Key', process.env.ASSET_SYNC_TOKEN)
      .send({ ossPath: 'version.json' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('PATH_NOT_ALLOWED')
  })

  it('预签名拒绝 text/html 这类可执行 Content-Type', async () => {
    const res = await request(app)
      .post('/api/assets/pre-signed')
      .set('X-API-Key', process.env.ASSET_SYNC_TOKEN)
      .send({ ossPath: 'images/general/x.png', contentType: 'text/html' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('CONTENT_TYPE_NOT_ALLOWED')
  })
})

describe('重置口令：一次性随机值（P1-48）', () => {
  const studentId = '20240199'
  let temporaryPassword

  beforeAll(async () => {
    const res = await asAdmin(request(app).post('/api/admin/students')).send({
      student_id: studentId,
      student_name: '重置测试',
    })
    expect(res.status).toBe(201)
    temporaryPassword = res.body.data.temporary_password
  })

  it('重置后返回的是一次性随机口令，不是 99999999', async () => {
    const res = await asAdmin(
      request(app).post(`/api/admin/students/${studentId}/reset-password`),
    ).send({})

    expect(res.status).toBe(200)
    const temp = res.body.data.temporary_password
    expect(typeof temp).toBe('string')
    expect(temp.length).toBeGreaterThanOrEqual(8)
    expect(temp).not.toBe('99999999')
  })

  it('重置会把 must_reset_password 置 1，并写审计日志', async () => {
    const { db, dbGet, dbAll } = dbHelpers()
    const student = await dbGet(
      db,
      'SELECT must_reset_password FROM students WHERE student_id = ?',
      [studentId],
    )
    expect(student.must_reset_password).toBe(1)

    const logs = await dbAll(
      db,
      'SELECT * FROM password_resets WHERE target_type = ? AND target_id = ?',
      ['student', studentId],
    )
    expect(logs.length).toBeGreaterThan(0)
  })

  it('审计日志可通过管理员接口查询', async () => {
    const res = await asAdmin(
      request(app).get('/api/admin/password-resets?target_type=student&target_id=' + studentId),
    )
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThan(0)
  })

  it('新口令能登录，旧默认口令不能再登录', async () => {
    // 用创建时拿到的那次口令登录（后续重置又换了新值，这里再重置一次拿最新的）
    const reset = await asAdmin(
      request(app).post(`/api/admin/students/${studentId}/reset-password`),
    ).send({})
    const latest = reset.body.data.temporary_password

    const ok = await request(app)
      .post('/api/auth/student/login')
      .send({ student_id: studentId, password: latest })
    expect(ok.status).toBe(200)

    const old = await request(app)
      .post('/api/auth/student/login')
      .send({ student_id: studentId, password: temporaryPassword })
    expect(old.status).toBe(401)
  })
})

describe('改密与令牌刷新（P3-47 / F-004）', () => {
  const studentId = '20240197'
  let token
  let initialPassword

  beforeAll(async () => {
    const created = await asAdmin(request(app).post('/api/admin/students')).send({
      student_id: studentId,
      student_name: '改密测试',
    })
    expect(created.status).toBe(201)
    initialPassword = created.body.data.temporary_password
    token = await login('/api/auth/student/login', {
      student_id: studentId,
      password: initialPassword,
    })
  })

  it('原密码错误 → 400 OLD_PASSWORD_WRONG', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ old_password: 'definitely-wrong', new_password: 'BrandNew#2026' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('OLD_PASSWORD_WRONG')
  })

  it('改密成功后旧密码失效、新密码可用，并清除 must_reset_password', async () => {
    const newPassword = 'BrandNew#2026'
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ old_password: initialPassword, new_password: newPassword })
    expect(res.status).toBe(200)

    const withNew = await request(app)
      .post('/api/auth/student/login')
      .send({ student_id: studentId, password: newPassword })
    expect(withNew.status).toBe(200)

    const withOld = await request(app)
      .post('/api/auth/student/login')
      .send({ student_id: studentId, password: initialPassword })
    expect(withOld.status).toBe(401)

    const { db, dbGet } = dbHelpers()
    const row = await dbGet(
      db,
      'SELECT must_reset_password FROM students WHERE student_id = ?',
      [studentId],
    )
    expect(row.must_reset_password).toBe(0)
  })

  it('刷新接口：无 token 401，有 token 返回新 token', async () => {
    const noToken = await request(app).post('/api/auth/refresh')
    expect(noToken.status).toBe(401)

    const refreshed = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${token}`)
    expect(refreshed.status).toBe(200)
    expect(typeof refreshed.body.data.token).toBe('string')

    // 新 token 能继续刷新（同一账号仍有效）
    const again = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${refreshed.body.data.token}`)
    expect(again.status).toBe(200)
  })
})

describe('删除学生级联清理（P1-21）', () => {
  const studentId = '20240196'
  let token
  let password

  beforeAll(async () => {
    const created = await asAdmin(request(app).post('/api/admin/students')).send({
      student_id: studentId,
      student_name: '级联测试',
    })
    expect(created.status).toBe(201)
    password = created.body.data.temporary_password
    token = await login('/api/auth/student/login', { student_id: studentId, password })

    // 造三条关联数据：答题、埋点、重置审计
    const submit = await request(app)
      .post('/api/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({
        studentId,
        wenId: 'WEN_01',
        submittedAt: new Date().toISOString(),
        answers: { WEN_01_Q1: 1 },
        questions: [{ id: 'WEN_01_Q1' }],
      })
    expect(submit.status).toBe(200)

    const track = await request(app)
      .post('/api/track')
      .set('Authorization', `Bearer ${token}`)
      .send({
        events: [{ event_type: 'step_enter', session_id: 'sess-cascade', step_id: 'step1' }],
      })
    expect(track.status).toBe(200)

    const reset = await asAdmin(
      request(app).post(`/api/admin/students/${studentId}/reset-password`),
    ).send({})
    expect(reset.status).toBe(200)
  })

  it('删除账号后 answers / tracking_events / password_resets 均不留孤儿', async () => {
    const del = await asAdmin(request(app).delete(`/api/admin/students/${studentId}`))
    expect(del.status).toBe(200)

    const { db, dbGet } = dbHelpers()
    const answers = await dbGet(db, 'SELECT COUNT(*) AS c FROM answers WHERE student_id = ?', [
      studentId,
    ])
    const events = await dbGet(db, 'SELECT COUNT(*) AS c FROM tracking_events WHERE user_id = ?', [
      studentId,
    ])
    const resets = await dbGet(
      db,
      'SELECT COUNT(*) AS c FROM password_resets WHERE target_type = ? AND target_id = ?',
      ['student', studentId],
    )
    const students = await dbGet(db, 'SELECT COUNT(*) AS c FROM students WHERE student_id = ?', [
      studentId,
    ])

    expect(answers.c).toBe(0)
    expect(events.c).toBe(0)
    expect(resets.c).toBe(0)
    expect(students.c).toBe(0)
  })
})
