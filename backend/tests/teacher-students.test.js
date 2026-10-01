/**
 * 教师端学生管理（删除本班学生）集成测试（R104）
 *
 * 覆盖 teacherController.deleteStudent：
 * - 教师删除本班学生 → 200，删除后查询 404
 * - 教师删除非本班学生 → 403（越权防护）
 * - 教师删除不存在的学生 → 404
 * - 无 token 访问 → 401
 *
 * 运行方式：npm test（已纳入 CI backend-check）
 */

const request = require('supertest')

process.env.DB_PATH = ':memory:'
process.env.JWT_SECRET = 'ci-test-secret'

const { db, initAllTables } = require('../src/config/database')
const { dbGet } = require('../src/utils/dbPromise')

let app
let adminToken
let teacherToken

function asAdmin(agent) {
  return agent.set('Authorization', `Bearer ${adminToken}`)
}

function asTeacher(agent) {
  return agent.set('Authorization', `Bearer ${teacherToken}`)
}

beforeAll(async () => {
  process.env.TEST_MODE = 'true'
  await initAllTables()

  const { createApp } = require('../src/app')
  app = createApp()

  // 管理员登录，用于准备教师 / 学生数据
  const adminLogin = await request(app)
    .post('/api/auth/admin/login')
    .send({ username: 'admin', password: 'admin123' })
  adminToken = adminLogin.body.data.token

  const school = await dbGet(db, 'SELECT id FROM schools LIMIT 1')

  // 创建教师（班级 202501）并登录
  await asAdmin(request(app).post('/api/admin/teachers')).send({
    phone: 't9101',
    name: '删除测试教师',
    password: '12345678',
    school_id: school.id,
    class_codes: ['202501'],
  })
  const teacherLogin = await request(app)
    .post('/api/auth/teacher/login')
    .send({ phone: 't9101', password: '12345678' })
  teacherToken = teacherLogin.body.data.token
})

afterAll((done) => {
  db.close(() => done())
})

describe('教师删除本班学生账号', () => {
  it('教师可删除本班学生，删除后查询返回 404', async () => {
    await asAdmin(request(app).post('/api/admin/students')).send({
      student_id: '2025010001',
      student_name: '待删除学生',
      class_code: '202501',
    })

    const del = await asTeacher(request(app).delete('/api/teacher/students/2025010001'))
    expect(del.status).toBe(200)
    expect(del.body.success).toBe(true)

    const after = await asTeacher(request(app).get('/api/teacher/students/2025010001'))
    expect(after.status).toBe(404)
  })

  it('教师删除非本班学生应返回 403', async () => {
    await asAdmin(request(app).post('/api/admin/students')).send({
      student_id: '2025990001',
      student_name: '他班学生',
      class_code: '202599',
    })

    const res = await asTeacher(request(app).delete('/api/teacher/students/2025990001'))
    expect(res.status).toBe(403)

    // 越权删除失败后学生仍然存在
    const still = await asAdmin(request(app).get('/api/admin/students/2025990001'))
    expect(still.status).toBe(200)
  })

  it('教师删除不存在的学生应返回 404', async () => {
    const res = await asTeacher(request(app).delete('/api/teacher/students/2099010001'))
    expect(res.status).toBe(404)
  })

  it('未登录访问教师删除接口应返回 401', async () => {
    const res = await request(app).delete('/api/teacher/students/2025010001')
    expect(res.status).toBe(401)
  })
})
