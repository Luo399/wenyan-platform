/**
 * Playwright E2E 测试鉴权 fixture
 *
 * 设计意图：
 * - authStore.initialize() 从 localStorage 恢复 token，解 payload.exp 字段判断过期
 *   但不验签名——所以 fake JWT 只要 exp 正确就能被 authStore 接受
 * - loginAsStudent() 优先走后端真实 /api/auth/student/login 拿 JWT
 *   后端不可用时 fallback 直接编一个 fake JWT（exp > now）
 * - setExpiredToken() 给 A3 测试用：构造一个 exp < now 的 token 存 localStorage
 *   触发 authStore.isTokenExpired() → authStore.logout() 的真实链路
 */

import type { Page } from '@playwright/test'

function b64url(obj: unknown): string {
  return btoa(JSON.stringify(obj))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** 构造过期 JWT（exp = now - 1h）—— A3 token 过期登出测试用 */
export function makeExpiredJwt(): string {
  const header = b64url({ alg: 'HS256', typ: 'JWT' })
  const payload = b64url({ exp: Math.floor(Date.now() / 1000) - 3600 })
  return `${header}.${payload}.fake-sign`
}

/** 构造有效 JWT（exp = now + 1h）—— 后端 API 不可用时 fallback 用 */
export function makeValidJwt(studentId: string, role = 'student'): string {
  const header = b64url({ alg: 'HS256', typ: 'JWT' })
  const payload = b64url({
    sub: studentId,
    role,
    exp: Math.floor(Date.now() / 1000) + 3600,
  })
  return `${header}.${payload}.fake-sign`
}

/**
 * 走后端 API 拿真实 JWT；后端不可用时 fallback 编一个
 * 注入时机：通过 page.addInitScript 在页面 JS 执行前写入 localStorage
 *
 * @param page Playwright page 实例
 * @param studentId 学号（测试用：2024001）
 * @param password 密码（测试用：valid-password）
 */
export async function loginAsStudent(
  page: Page,
  studentId = '2024001',
  password = 'valid-password',
): Promise<void> {
  const apiBase = process.env.PLAYWRIGHT_API_URL || 'https://test-api.classicalab.cn'
  let jwt: string

  try {
    const res = await page.request.post(`${apiBase}/api/auth/student/login`, {
      data: { studentId, password },
      timeout: 5000,
    })
    const envelope = await res.json()
    if (!envelope.success) {
      throw new Error(`登录失败: ${envelope.message}`)
    }
    jwt = envelope.data.token
  } catch (e) {
    console.warn('[fixture] 后端 API 不可用，fallback 编 JWT:', (e as Error).message)
    jwt = makeValidJwt(studentId, 'student')
  }

  await page.addInitScript(
    ({ jwt, user }) => {
      localStorage.setItem('auth_token', jwt)
      localStorage.setItem('auth_user', JSON.stringify(user))
    },
    { jwt, user: { studentId, role: 'student', username: '测试用户' } },
  )
}

/**
 * 构造"过期 token 存 localStorage"（A3 专用）
 * 注入时机：同 loginAsStudent
 */
export async function setExpiredToken(page: Page): Promise<void> {
  const expiredJwt = makeExpiredJwt()
  await page.addInitScript(
    ({ token }) => {
      localStorage.setItem('auth_token', token)
    },
    { token: expiredJwt },
  )
}
