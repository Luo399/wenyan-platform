/**
 * 环境变量装载与启动校验测试
 *
 * 覆盖升级 dotenv 18 后的两个风险点：
 * - 17+ 默认打印注入 banner、默认覆盖语义是否被显式约束；
 * - 生产缺 JWT_SECRET / 非法 JWT_EXPIRES_IN 必须启动失败，不能静默回退。
 */

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
}

function restoreEnv() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  jest.resetModules()
}

function loadFresh(modulePath) {
  let loaded
  jest.isolateModules(() => {
    loaded = require(modulePath)
  })
  return loaded
}

describe('config/env：dotenv 18 装载参数', () => {
  afterEach(() => {
    restoreEnv()
  })

  it('生产环境读取 .env.production，并显式 quiet / override:false', () => {
    process.env.NODE_ENV = 'production'

    const env = loadFresh('../src/config/env')

    expect(env.envFile).toBe('.env.production')
    expect(env.envPath).toContain('.env.production')
    expect(env.dotenvOptions).toMatchObject({ quiet: true, override: false })
    expect(env.dotenvOptions.path).toBe(env.envPath)
  })

  it('非生产环境读取 .env', () => {
    process.env.NODE_ENV = 'test'

    const env = loadFresh('../src/config/env')

    expect(env.envFile).toBe('.env')
    expect(env.envPath.endsWith('.env')).toBe(true)
    expect(env.envPath).not.toContain('.env.production')
  })
})

describe('config/app：启动期 fail-fast', () => {
  afterEach(() => {
    restoreEnv()
  })

  it('生产环境缺 JWT_SECRET → 直接抛错', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.JWT_SECRET

    expect(() => loadFresh('../src/config/app')).toThrow('JWT_SECRET must be set in production')
  })

  it('JWT_EXPIRES_IN 非法 → 直接抛错，不回退默认值', () => {
    process.env.NODE_ENV = 'test'
    process.env.JWT_SECRET = 'test-secret'
    process.env.JWT_EXPIRES_IN = '7x'

    expect(() => loadFresh('../src/config/app')).toThrow(/JWT_EXPIRES_IN 配置非法/)
  })

  it('非生产环境缺 JWT_SECRET → 使用 dev-only-secret 兜底', () => {
    process.env.NODE_ENV = 'test'
    delete process.env.JWT_SECRET
    delete process.env.JWT_EXPIRES_IN
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const config = loadFresh('../src/config/app')

    expect(config.jwt.secret).toBe('dev-only-secret')
    expect(config.jwt.expiresIn).toBe(3600)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
