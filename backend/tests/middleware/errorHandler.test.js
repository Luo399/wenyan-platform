/**
 * 错误处理中间件单元测试
 * 覆盖 errorHandler、notFoundHandler、requestLogger 三个中间件
 */

// 先 mock logger，避免真实写日志到文件
jest.mock('../../src/utils/logger', () => ({
  logError: jest.fn(),
  logRequest: jest.fn(),
}))

const { logError, logRequest } = require('../../src/utils/logger')
const {
  requestLogger,
  notFoundHandler,
  errorHandler,
} = require('../../src/middleware/errorHandler')

describe('errorHandler middleware', () => {
  // 每个用例前清空 mock 调用记录
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ========== errorHandler ==========

  describe('errorHandler：全局错误处理中间件', () => {
    // 构造最小可用的 req / res
    function createMockReq(overrides = {}) {
      return {
        method: 'POST',
        path: '/api/submit',
        query: { id: '1' },
        user: null,
        ...overrides,
      }
    }

    function createMockRes() {
      const res = {
        _statusCode: undefined,
        _json: undefined,
      }
      res.status = jest.fn((code) => {
        res._statusCode = code
        return res
      })
      res.json = jest.fn((body) => {
        res._json = body
        return res
      })
      return res
    }

    it('普通 Error：statusCode 默认 500，message 取 err.message，errorCode 默认 INTERNAL_ERROR', () => {
      const err = new Error('数据库连接失败')
      const req = createMockReq()
      const res = createMockRes()

      errorHandler(err, req, res, jest.fn())

      // 调用了 logError
      expect(logError).toHaveBeenCalledTimes(1)
      const [firstArg, secondArg] = logError.mock.calls[0]
      expect(firstArg).toBe(err)
      expect(secondArg).toMatchObject({
        method: 'POST',
        path: '/api/submit',
        query: { id: '1' },
        userId: null,
      })

      // 响应
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledTimes(1)
      const body = res._json
      expect(body.success).toBe(false)
      expect(body.error).toBe('INTERNAL_ERROR')
      expect(body.message).toBe('数据库连接失败')
      expect(typeof body.timestamp).toBe('string')
      // timestamp 是 ISO 日期格式
      expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp)
    })

    it('自定义错误：err.statusCode / err.error / err.message 全部被读取', () => {
      const err = {
        statusCode: 400,
        error: 'BAD_REQUEST',
        message: '学号格式错误',
      }
      const req = createMockReq()
      const res = createMockRes()

      errorHandler(err, req, res, jest.fn())

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res._json.error).toBe('BAD_REQUEST')
      expect(res._json.message).toBe('学号格式错误')
    })

    it('err.message 缺失 -> 回退到"服务器内部错误"', () => {
      const err = { statusCode: 500 }
      const req = createMockReq()
      const res = createMockRes()

      errorHandler(err, req, res, jest.fn())

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res._json.message).toBe('服务器内部错误')
      expect(res._json.error).toBe('INTERNAL_ERROR')
    })

    it('PayloadTooLargeError：被识别并覆盖为 413 / PAYLOAD_TOO_LARGE / 请求体超过大小限制', () => {
      const err = new Error('request entity too large')
      err.name = 'PayloadTooLargeError'
      // 故意设置错误的 statusCode，看是否被覆盖
      err.statusCode = 500
      err.error = 'OLD_CODE'
      err.message = 'old message'
      const req = createMockReq()
      const res = createMockRes()

      errorHandler(err, req, res, jest.fn())

      expect(res.status).toHaveBeenCalledWith(413)
      expect(res._json.error).toBe('PAYLOAD_TOO_LARGE')
      expect(res._json.message).toBe('请求体超过大小限制')
    })

    it('req.user.userId 存在时：上下文 userId 正确传入 logError', () => {
      const err = new Error('校验失败')
      const req = createMockReq({
        user: { userId: '2024001', name: '张三' },
      })
      const res = createMockRes()

      errorHandler(err, req, res, jest.fn())

      expect(logError).toHaveBeenCalledTimes(1)
      expect(logError.mock.calls[0][1].userId).toBe('2024001')
    })

    it('req.user 存在但没有 userId 字段：userId 回退到 null', () => {
      const err = new Error('x')
      const req = createMockReq({ user: { name: '匿名' } })
      const res = createMockRes()

      errorHandler(err, req, res, jest.fn())

      expect(logError.mock.calls[0][1].userId).toBeNull()
    })

    it('next 形参不被调用（_next 已声明但未使用，验证没有误调用破坏 Express 错误链）', () => {
      const err = new Error('x')
      const req = createMockReq()
      const res = createMockRes()
      const next = jest.fn()

      errorHandler(err, req, res, next)

      expect(next).not.toHaveBeenCalled()
    })
  })

  // ========== notFoundHandler ==========

  describe('notFoundHandler：404 中间件', () => {
    function createMockRes() {
      const res = {}
      res.status = jest.fn((code) => {
        res._statusCode = code
        return res
      })
      res.json = jest.fn((body) => {
        res._json = body
        return res
      })
      return res
    }

    it('固定返回 404 / NOT_FOUND / 接口不存在，success=false', () => {
      const req = { method: 'GET', path: '/non/existent' }
      const res = createMockRes()

      notFoundHandler(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledTimes(1)
      expect(res._json).toEqual({
        success: false,
        error: 'NOT_FOUND',
        message: '接口不存在',
      })
    })

    it('不依赖 next 参数（形参只有 req、res）', () => {
      // 如果有 next 形参会让人困惑，测试形参数量
      expect(notFoundHandler.length).toBe(2)
    })
  })

  // ========== requestLogger ==========

  describe('requestLogger：请求日志中间件', () => {
    function createMockReq(overrides = {}) {
      return {
        method: 'GET',
        path: '/api/health',
        ...overrides,
      }
    }

    function createMockRes() {
      const res = {
        _listeners: {},
      }
      res.on = jest.fn((event, cb) => {
        res._listeners[event] = cb
        return res
      })
      return res
    }

    it('立即调用 next() 不阻塞请求流程', () => {
      const req = createMockReq()
      const res = createMockRes()
      const next = jest.fn()

      requestLogger(req, res, next)

      expect(next).toHaveBeenCalledTimes(1)
      expect(next).toHaveBeenCalledWith()
    })

    it('注册了 res.on(\'finish\') 监听器（但同步阶段不调用 logRequest）', () => {
      const req = createMockReq()
      const res = createMockRes()

      requestLogger(req, res, jest.fn())

      expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function))
      // finish 还没触发 -> logRequest 还没调用
      expect(logRequest).not.toHaveBeenCalled()
    })

    it('res.finish 触发后：调用 logRequest，传入 req、res、duration（正数毫秒数）', () => {
      const req = createMockReq()
      const res = createMockRes()

      requestLogger(req, res, jest.fn())

      const finishCb = res._listeners.finish
      // 触发 finish
      finishCb()

      expect(logRequest).toHaveBeenCalledTimes(1)
      const [logReq, logRes, duration] = logRequest.mock.calls[0]
      expect(logReq).toBe(req)
      expect(logRes).toBe(res)
      // duration 应为数字且 >= 0（同步代码极快，通常为 0）
      expect(typeof duration).toBe('number')
      expect(duration).toBeGreaterThanOrEqual(0)
    })
  })
})
