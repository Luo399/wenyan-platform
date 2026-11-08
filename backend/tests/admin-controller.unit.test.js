/**
 * adminController.approveTeacher / rejectTeacher 单元测试
 *
 * 目的：覆盖漏洞修复逻辑（status !== 'pending' → NOT_PENDING）。
 * 不启动 HTTP 层、不连真实 SQLite，直接 mock dbGet / dbRun / logger，
 * 构造 fake req/res 后调用 controller 函数本身。
 *
 * 运行方式：npm test（已纳入 CI backend-check）
 */

// controller 内通过 require('../config/database') 拿到 db，这里先 mock 掉
const mockDbGet = jest.fn()
const mockDbRun = jest.fn()
jest.mock('../src/config/database', () => ({
  db: {}, // controller 只用 .run / .exec / 无参数 require 侧效应
}))
jest.mock('../src/utils/dbPromise', () => ({
  dbGet: (...args) => mockDbGet(...args),
  dbRun: (...args) => mockDbRun(...args),
  dbAll: jest.fn(),
}))
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}))

describe('adminController.approveTeacher 单元测试', () => {
  let approveTeacher
  let res
  let resStatusFn
  let resJsonFn

  beforeEach(async () => {
    // 每个用例前重置 mock
    jest.resetModules()
    mockDbGet.mockReset()
    mockDbRun.mockReset()

    resJsonFn = jest.fn((body) => body)
    resStatusFn = jest.fn(() => ({ json: resJsonFn }))
    res = { status: resStatusFn, json: resJsonFn }

    // 动态重新 require（在 mock setup 之后）
    const adminController = require('../src/controllers/adminController')
    approveTeacher = adminController.approveTeacher
  })

  it('教师不存在 → 404 NOT_FOUND', async () => {
    mockDbGet.mockResolvedValue(null)
    const req = { params: { phone: 'no-such-phone' } }

    await approveTeacher(req, res)

    expect(mockDbGet).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('SELECT id, status FROM teachers WHERE phone = ?'),
      ['no-such-phone'],
    )
    expect(resStatusFn).toHaveBeenCalledWith(404)
    expect(resJsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'NOT_FOUND' }),
    )
    expect(mockDbRun).not.toHaveBeenCalled()
  })

  it('active 状态 → 400 ALREADY_ACTIVE', async () => {
    mockDbGet.mockResolvedValue({ id: 1, status: 'active' })
    const req = { params: { phone: 'p1' } }

    await approveTeacher(req, res)

    expect(resStatusFn).toHaveBeenCalledWith(400)
    expect(resJsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'ALREADY_ACTIVE' }),
    )
    expect(mockDbRun).not.toHaveBeenCalled()
  })

  it('rejected 状态（漏洞修复目标）→ 400 NOT_PENDING', async () => {
    mockDbGet.mockResolvedValue({ id: 1, status: 'rejected' })
    const req = { params: { phone: 'p1' } }

    await approveTeacher(req, res)

    expect(resStatusFn).toHaveBeenCalledWith(400)
    expect(resJsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'NOT_PENDING' }),
    )
    expect(mockDbRun).not.toHaveBeenCalled()
  })

  it('disabled 状态（漏洞修复目标）→ 400 NOT_PENDING', async () => {
    mockDbGet.mockResolvedValue({ id: 1, status: 'disabled' })
    const req = { params: { phone: 'p1' } }

    await approveTeacher(req, res)

    expect(resStatusFn).toHaveBeenCalledWith(400)
    expect(resJsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'NOT_PENDING' }),
    )
    expect(mockDbRun).not.toHaveBeenCalled()
  })

  it('pending 状态 → 200 + UPDATE SET status=active, must_reset_password=1', async () => {
    mockDbGet.mockResolvedValue({ id: 1, status: 'pending' })
    mockDbRun.mockResolvedValue({ changes: 1 })
    const req = { params: { phone: 'p1' } }

    await approveTeacher(req, res)

    expect(mockDbRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining(`UPDATE teachers SET status = 'active', must_reset_password = 1`),
      expect.arrayContaining(['p1']),
    )
    expect(resStatusFn).toHaveBeenCalledWith(200)
    expect(resJsonFn).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
  })

  it('dbRun 抛错 → 500 INTERNAL_ERROR', async () => {
    mockDbGet.mockResolvedValue({ id: 1, status: 'pending' })
    mockDbRun.mockRejectedValue(new Error('disk full'))
    const req = { params: { phone: 'p1' } }

    await approveTeacher(req, res)

    expect(resStatusFn).toHaveBeenCalledWith(500)
    expect(resJsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'INTERNAL_ERROR' }),
    )
  })
})

describe('adminController.rejectTeacher 单元测试', () => {
  let rejectTeacher
  let res
  let resStatusFn
  let resJsonFn

  beforeEach(async () => {
    jest.resetModules()
    mockDbGet.mockReset()
    mockDbRun.mockReset()

    resJsonFn = jest.fn((body) => body)
    resStatusFn = jest.fn(() => ({ json: resJsonFn }))
    res = { status: resStatusFn, json: resJsonFn }

    const adminController = require('../src/controllers/adminController')
    rejectTeacher = adminController.rejectTeacher
  })

  it('教师不存在 → 404 NOT_FOUND', async () => {
    mockDbGet.mockResolvedValue(null)
    const req = { params: { phone: 'nope' }, body: {} }

    await rejectTeacher(req, res)

    expect(resStatusFn).toHaveBeenCalledWith(404)
    expect(resJsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'NOT_FOUND' }),
    )
    expect(mockDbRun).not.toHaveBeenCalled()
  })

  it('pending 状态 → 200 + UPDATE SET status=rejected', async () => {
    mockDbGet.mockResolvedValue({ id: 1, status: 'pending' })
    mockDbRun.mockResolvedValue({ changes: 1 })
    const req = { params: { phone: 'p1' }, body: { reason: '资质不全' } }

    await rejectTeacher(req, res)

    expect(mockDbRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining(`UPDATE teachers SET status = 'rejected'`),
      expect.arrayContaining(['p1']),
    )
    expect(resStatusFn).toHaveBeenCalledWith(200)
    expect(resJsonFn).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
  })

  it('active 状态 → 400 NOT_PENDING', async () => {
    mockDbGet.mockResolvedValue({ id: 1, status: 'active' })
    const req = { params: { phone: 'p1' }, body: {} }

    await rejectTeacher(req, res)

    expect(resStatusFn).toHaveBeenCalledWith(400)
    expect(resJsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'NOT_PENDING' }),
    )
    expect(mockDbRun).not.toHaveBeenCalled()
  })

  it('rejected 状态（double reject）→ 400 NOT_PENDING', async () => {
    mockDbGet.mockResolvedValue({ id: 1, status: 'rejected' })
    const req = { params: { phone: 'p1' }, body: {} }

    await rejectTeacher(req, res)

    expect(resStatusFn).toHaveBeenCalledWith(400)
    expect(resJsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'NOT_PENDING' }),
    )
    expect(mockDbRun).not.toHaveBeenCalled()
  })

  it('disabled 状态 → 400 NOT_PENDING', async () => {
    mockDbGet.mockResolvedValue({ id: 1, status: 'disabled' })
    const req = { params: { phone: 'p1' }, body: {} }

    await rejectTeacher(req, res)

    expect(resStatusFn).toHaveBeenCalledWith(400)
    expect(resJsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'NOT_PENDING' }),
    )
    expect(mockDbRun).not.toHaveBeenCalled()
  })

  it('dbRun 抛错 → 500 INTERNAL_ERROR', async () => {
    mockDbGet.mockResolvedValue({ id: 1, status: 'pending' })
    mockDbRun.mockRejectedValue(new Error('lock busy'))
    const req = { params: { phone: 'p1' }, body: {} }

    await rejectTeacher(req, res)

    expect(resStatusFn).toHaveBeenCalledWith(500)
    expect(resJsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'INTERNAL_ERROR' }),
    )
  })
})
