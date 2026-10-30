/**
 * bcryptjs 3 兼容性测试
 *
 * 升级风险不在新哈希，而在历史数据：库里已有 bcryptjs 2.x 生成的 $2a$ 哈希，
 * 必须保证 compare 仍然通过。这里用 2.4.3 实际生成的一条哈希做固定夹具。
 */

process.env.DB_PATH = ':memory:'
process.env.JWT_SECRET = 'ci-test-secret'

const bcrypt = require('bcryptjs')

// bcryptjs 2.4.3 hash('legacy-password-2026', 10)
const LEGACY_V2_HASH =
  '$2a$10$JUljCelT1eb0TlRkeNBNfO4sIAP0Bmv3RjT8txIqjh5pZ9j1tbAIm'

describe('bcryptjs 2.x 历史哈希兼容', () => {
  test('v2 生成的 $2a$ 哈希在 v3 下仍可校验', async () => {
    expect(LEGACY_V2_HASH.startsWith('$2a$')).toBe(true)
    await expect(bcrypt.compare('legacy-password-2026', LEGACY_V2_HASH)).resolves.toBe(true)
    await expect(bcrypt.compare('wrong-password', LEGACY_V2_HASH)).resolves.toBe(false)
  })

  test('authService.verifyPassword 对历史哈希同样通过', async () => {
    const { verifyPassword } = require('../src/services/authService')
    await expect(verifyPassword('legacy-password-2026', LEGACY_V2_HASH)).resolves.toBe(true)
    await expect(verifyPassword('bad', LEGACY_V2_HASH)).resolves.toBe(false)
  })
})

describe('bcryptjs 3 新哈希与 seed 回调 API', () => {
  test('新哈希为 $2b$，可正确往返', async () => {
    const hash = await bcrypt.hash('new-password-2026', 4)
    expect(hash.startsWith('$2b$')).toBe(true)
    await expect(bcrypt.compare('new-password-2026', hash)).resolves.toBe(true)
    await expect(bcrypt.compare('other', hash)).resolves.toBe(false)
  })

  test('callback 版 hash 仍可用（database 种子数据依赖此 API）', async () => {
    const hash = await new Promise((resolve, reject) => {
      bcrypt.hash('seed-password', 4, (err, value) => (err ? reject(err) : resolve(value)))
    })

    expect(typeof hash).toBe('string')
    await expect(bcrypt.compare('seed-password', hash)).resolves.toBe(true)
  })

  test('seed 的 12 轮哈希参数仍可用（不静默降轮）', async () => {
    const { hashPassword } = require('../src/services/authService')
    const hash = await hashPassword('rounds-check')
    expect(hash.startsWith('$2b$12$')).toBe(true)
    await expect(bcrypt.compare('rounds-check', hash)).resolves.toBe(true)
  })
})
