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
  if (process.env.NODE_ENV !== 'development') {
    return
  }

  // 保存原始 fetch
  const originalFetch = window.fetch

  // 拦截 fetch 请求
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url)

    // 处理登录请求
    if (url.endsWith('/api/auth/login') && init?.method === 'POST') {
      return handleLogin(new Request(input, init))
    }

    // 处理刷新 token 请求
    if (url.endsWith('/api/auth/refresh') && init?.method === 'POST') {
      return handleRefresh(new Request(input, init))
    }

    // 处理获取用户信息请求
    if (url.endsWith('/api/auth/user') && init?.method === 'GET') {
      return handleGetUser(new Request(input, init))
    }

    // 其他请求使用原始 fetch
    return originalFetch(input, init)
  }

  console.log('[Mock Service] Mock 服务已启动')
}