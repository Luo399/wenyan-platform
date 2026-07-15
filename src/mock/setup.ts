/**
 * Mock 服务配置
 *
 * 在开发环境中拦截 HTTP 请求并返回模拟数据
 */

import { handleLogin, handleRefresh, handleGetUser } from './auth'

/**
 * 启动 mock 服务
 */
export async function startMockService(): Promise<void> {
  if (import.meta.env.DEV === false) {
    return
  }

  // 保存原始 fetch
  const originalFetch = window.fetch

  // 拦截 fetch 请求
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

    // 处理刷新 token 请求（保留 mock）
    if (url.endsWith('/api/auth/refresh') && init?.method === 'POST') {
      return handleRefresh(new Request(input, init))
    }

    // 处理获取用户信息请求（保留 mock）
    if (url.endsWith('/api/auth/user') && init?.method === 'GET') {
      return handleGetUser(new Request(input, init))
    }

    // 登录请求和其他请求直接转发到后端（不再使用 mock）
    return originalFetch(input, init)
  }

  console.log('[Mock Service] Mock 服务已启动')
}
