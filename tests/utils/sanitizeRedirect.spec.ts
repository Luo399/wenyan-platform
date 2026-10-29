import { describe, it, expect } from 'vitest'
import { sanitizeRedirect } from '@/utils/api'

/**
 * sanitizeRedirect：登录后跳转目标的白名单校验（防开放重定向）
 *
 * 修复前 `route.query.redirect` 直接进 router.push，攻击者构造
 * /student-login?redirect=https://evil.example 即可把学生带去钓鱼页。
 */
describe('sanitizeRedirect', () => {
  const FALLBACK = '/'

  it('站内绝对路径原样通过', () => {
    expect(sanitizeRedirect('/detail/WEN_01', FALLBACK)).toBe('/detail/WEN_01')
  })

  it('带查询串的站内路径保留', () => {
    expect(sanitizeRedirect('/detail/WEN_01?step=2', FALLBACK)).toBe('/detail/WEN_01?step=2')
  })

  it('协议相对地址 //evil.com 被拒', () => {
    expect(sanitizeRedirect('//evil.com', FALLBACK)).toBe(FALLBACK)
  })

  it('反斜杠绕过 /\\evil.com 被拒', () => {
    expect(sanitizeRedirect('/\\evil.com', FALLBACK)).toBe(FALLBACK)
  })

  it('绝对 URL 被拒', () => {
    expect(sanitizeRedirect('https://evil.com', FALLBACK)).toBe(FALLBACK)
    expect(sanitizeRedirect('javascript:alert(1)', FALLBACK)).toBe(FALLBACK)
  })

  it('相对路径（不以 / 开头）被拒', () => {
    expect(sanitizeRedirect('detail/WEN_01', FALLBACK)).toBe(FALLBACK)
  })

  it('嵌入反斜杠或 scheme 的路径被拒', () => {
    expect(sanitizeRedirect('/detail\\WEN_01', FALLBACK)).toBe(FALLBACK)
    expect(sanitizeRedirect('/redirect?to=https://evil.com', FALLBACK)).toBe(FALLBACK)
  })

  it('空值/非字符串回落到调用方给的 fallback', () => {
    expect(sanitizeRedirect(undefined, '/home')).toBe('/home')
    expect(sanitizeRedirect(null, '/home')).toBe('/home')
    expect(sanitizeRedirect('', '/home')).toBe('/home')
    expect(sanitizeRedirect(['/a'], '/home')).toBe('/home')
    expect(sanitizeRedirect('   ', '/home')).toBe('/home')
  })

  it('前后空白会被 trim 后再判断', () => {
    expect(sanitizeRedirect('  /detail/WEN_01  ', FALLBACK)).toBe('/detail/WEN_01')
  })
})
