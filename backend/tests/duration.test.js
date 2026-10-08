/**
 * JWT_EXPIRES_IN 时长解析测试（F-003）
 *
 * 回归背景：旧实现用 Number(value) 解析 JWT_EXPIRES_IN，
 * 运维写 '7d' 时得到 NaN 后静默回退到 3600 秒，
 * 造成「配置改了却不生效、用户仍 1 小时被登出」的假象。
 */

const { parseDuration } = require('../src/utils/duration')

describe('parseDuration', () => {
  it('纯数字按秒解析', () => {
    expect(parseDuration('3600')).toBe(3600)
    expect(parseDuration(3600)).toBe(3600)
  })

  it('支持 s/m/h/d 单位', () => {
    expect(parseDuration('60s')).toBe(60)
    expect(parseDuration('30m')).toBe(1800)
    expect(parseDuration('12h')).toBe(43200)
    expect(parseDuration('7d')).toBe(604800)
  })

  it('大小写不敏感且允许空格', () => {
    expect(parseDuration('7D')).toBe(604800)
    expect(parseDuration(' 12 h ')).toBe(43200)
  })

  it('非法输入返回 null，不再静默回退', () => {
    expect(parseDuration('7days')).toBeNull()
    expect(parseDuration('abc')).toBeNull()
    expect(parseDuration('')).toBeNull()
    expect(parseDuration('   ')).toBeNull()
    expect(parseDuration(undefined)).toBeNull()
    expect(parseDuration(null)).toBeNull()
    expect(parseDuration('0')).toBeNull()
    expect(parseDuration('-5')).toBeNull()
    expect(parseDuration('1.5h')).toBeNull()
  })
})
