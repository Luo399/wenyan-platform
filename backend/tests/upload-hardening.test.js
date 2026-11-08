/**
 * 上传链路加固测试（真实 Express 路由 + multer 2.5 + supertest 7）
 *
 * 覆盖此前缺失的路径：
 * - 合法单文件上传（资源上传工具）
 * - PDF 等「multer 放行但业务不支持」的扩展名
 * - 路径穿越
 * - /api/assets/upload 的多文件 .any() 模式
 * - 20MB 上限触发 MulterError 后由 errorHandler 映射为 413
 * - 404 与畸形 JSON 的错误信封
 */

const request = require('supertest')

process.env.DB_PATH = ':memory:'
process.env.JWT_SECRET = 'ci-test-secret'
process.env.TEST_MODE = 'true'
process.env.INITIAL_ADMIN_USERNAME = 'admin'
process.env.INITIAL_ADMIN_PASSWORD = 'AdminInit#2024'
process.env.RATE_LIMIT_GLOBAL = '100000'
process.env.RATE_LIMIT_LOGIN = '1000'
process.env.RATE_LIMIT_SUBMIT = '1000'
process.env.ASSET_SYNC_TOKEN = 'asset-sync-test-token'

jest.setTimeout(20000)

let app
let adminToken
let studentToken
let assetService

async function login(path, body) {
  const res = await request(app).post(path).send(body)
  if (res.status !== 200 || typeof res.body.data?.token !== 'string') {
    throw new Error(`登录失败 ${path}: ${res.status} ${JSON.stringify(res.body)}`)
  }
  return res.body.data.token
}

beforeAll(async () => {
  const { initAllTables } = require('../src/config/database')
  await initAllTables()

  const { createApp } = require('../src/app')
  assetService = require('../src/services/assetService')
  app = createApp()

  adminToken = await login('/api/auth/admin/login', {
    username: process.env.INITIAL_ADMIN_USERNAME,
    password: process.env.INITIAL_ADMIN_PASSWORD,
  })
  studentToken = await login('/api/auth/student/login', {
    student_id: '99999999',
    password: '99999999',
  })
})

beforeEach(() => {
  jest.spyOn(assetService, 'processFileUpload').mockResolvedValue({
    ossUrl: 'https://oss.example.test/audio/test.mp3',
    md5: 'fake-md5',
  })
  jest.spyOn(assetService, 'batchProcessFiles').mockResolvedValue({
    uploaded: [],
    skipped: [],
    errors: [],
  })
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('POST /api/upload/resource', () => {
  it('未登录 → 401，且不会进入 multer', async () => {
    const res = await request(app)
      .post('/api/upload/resource')
      .attach('file', Buffer.from('ID3'), { filename: 'a.mp3', contentType: 'audio/mpeg' })

    expect(res.status).toBe(401)
    expect(assetService.processFileUpload).not.toHaveBeenCalled()
  })

  it('学生角色 → 403', async () => {
    const res = await request(app)
      .post('/api/upload/resource')
      .set('Authorization', `Bearer ${studentToken}`)
      .attach('file', Buffer.from('ID3'), { filename: 'a.mp3', contentType: 'audio/mpeg' })

    expect(res.status).toBe(403)
    expect(assetService.processFileUpload).not.toHaveBeenCalled()
  })

  it('管理员上传合法音频：推断类型并保留 buffer', async () => {
    const res = await request(app)
      .post('/api/upload/resource')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('ossPath', 'audio/test.mp3')
      .field('wenId', 'WEN_05')
      .attach('file', Buffer.from('ID3'), { filename: 'test.mp3', contentType: 'audio/mpeg' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.ossUrl).toBe('https://oss.example.test/audio/test.mp3')

    expect(assetService.processFileUpload).toHaveBeenCalledTimes(1)
    const [file, ossConfig] = assetService.processFileUpload.mock.calls[0]
    expect(file).toMatchObject({ ossPath: 'audio/test.mp3', type: 'audio' })
    expect(Buffer.isBuffer(file.buffer)).toBe(true)
    expect(file.buffer.length).toBe(3)
    expect(ossConfig).toBeTruthy()
  })

  it('multer 放行但业务不支持的扩展名（PDF）→ 400 UNSUPPORTED_TYPE', async () => {
    const res = await request(app)
      .post('/api/upload/resource')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('ossPath', 'files/test.pdf')
      .attach('file', Buffer.from('%PDF-1.7'), { filename: 'test.pdf', contentType: 'application/pdf' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('UNSUPPORTED_TYPE')
    expect(assetService.processFileUpload).not.toHaveBeenCalled()
  })

  it('路径穿越 → 400 INVALID_OSS_PATH', async () => {
    const res = await request(app)
      .post('/api/upload/resource')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('ossPath', '../etc/passwd.mp3')
      .attach('file', Buffer.from('ID3'), { filename: 'a.mp3', contentType: 'audio/mpeg' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('INVALID_OSS_PATH')
    expect(assetService.processFileUpload).not.toHaveBeenCalled()
  })
})

describe('POST /api/assets/upload（Figma 插件）', () => {
  it('拒绝白名单外 MIME（application/zip）', async () => {
    const res = await request(app)
      .post('/api/assets/upload')
      .set('X-API-Key', process.env.ASSET_SYNC_TOKEN)
      .field('ossPath', 'images/general/a.zip')
      .attach('file', Buffer.from('PK'), { filename: 'a.zip', contentType: 'application/zip' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('INVALID_FILE_TYPE')
    expect(assetService.batchProcessFiles).not.toHaveBeenCalled()
  })

  it('多文件 .any() 模式：两个文件与 ossPath 一一对应', async () => {
    const res = await request(app)
      .post('/api/assets/upload')
      .set('X-API-Key', process.env.ASSET_SYNC_TOKEN)
      .field('ossPath', 'images/general/a.png')
      .field('ossPath', 'images/general/b.png')
      .attach('file', Buffer.from('a'), { filename: 'a.png', contentType: 'image/png' })
      .attach('file', Buffer.from('b'), { filename: 'b.png', contentType: 'image/png' })

    expect(res.status).toBe(200)
    expect(assetService.batchProcessFiles).toHaveBeenCalledTimes(1)

    const [files] = assetService.batchProcessFiles.mock.calls[0]
    expect(files).toHaveLength(2)
    expect(files.map((file) => file.ossPath)).toEqual(['images/general/a.png', 'images/general/b.png'])
    expect(files.every((file) => file.type === 'image')).toBe(true)
  })

  it('超过 20MB → 413 FILE_TOO_LARGE，而不是 500', async () => {
    const overLimit = Buffer.alloc(20 * 1024 * 1024 + 1, 0x61)
    const res = await request(app)
      .post('/api/assets/upload')
      .set('X-API-Key', process.env.ASSET_SYNC_TOKEN)
      .field('ossPath', 'images/general/too-large.png')
      .attach('file', overLimit, { filename: 'too-large.png', contentType: 'image/png' })

    expect(res.status).toBe(413)
    expect(res.body.error).toBe('FILE_TOO_LARGE')
    expect(assetService.batchProcessFiles).not.toHaveBeenCalled()
  })
})

describe('通用错误信封（supertest 7 升级回归）', () => {
  it('未知路由 → 404 NOT_FOUND', async () => {
    const res = await request(app).get('/api/definitely-not-exist')

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ success: false, error: 'NOT_FOUND' })
  })

  it('畸形 JSON → 400，不返回 500', async () => {
    const res = await request(app)
      .post('/api/auth/student/login')
      .set('Content-Type', 'application/json')
      .send('{"student_id":')

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })
})
