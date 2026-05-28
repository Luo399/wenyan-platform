/**
 * Mock 认证服务
 * 
 * 提供模拟的登录接口和用户数据
 */

/**
 * 模拟用户数据
 */
const mockUsers: Record<string, {
  id: string
  username: string
  student_id: string
  role: 'student' | 'teacher' | 'admin'
}> = {
  '2024001': {
    id: '1',
    username: '张三',
    student_id: '2024001',
    role: 'student'
  },
  '2024002': {
    id: '2',
    username: '李四',
    student_id: '2024002',
    role: 'student'
  },
  '2024003': {
    id: '3',
    username: '王五',
    student_id: '2024003',
    role: 'student'
  },
  'teacher001': {
    id: '100',
    username: '李老师',
    student_id: 'teacher001',
    role: 'teacher'
  }
}

/**
 * 生成模拟 JWT token
 */
function generateMockToken(studentId: string): string {
  const payload = {
    sub: studentId,
    exp: Math.floor(Date.now() / 1000) + 3600,
    role: mockUsers[studentId]?.role || 'student'
  }
  
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const encodedPayload = btoa(JSON.stringify(payload))
  const signature = 'mock_signature_for_development_only'
  
  return `${header}.${encodedPayload}.${signature}`
}

/**
 * 登录接口 mock
 */
export async function handleLogin(request: Request): Promise<Response> {
  try {
    const body = await request.json()
    const studentId = body.student_id as string

    await new Promise(resolve => setTimeout(resolve, 500))

    if (!studentId || studentId.trim().length < 3) {
      return new Response(
        JSON.stringify({ success: false, message: '学号格式不正确' }),
        { status: 400 }
      )
    }

    const user = mockUsers[studentId]
    if (!user) {
      return new Response(
        JSON.stringify({ success: false, message: '学号不存在，请使用测试账号' }),
        { status: 401 }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          token: generateMockToken(studentId),
          user
        }
      }),
      { status: 200 }
    )
  } catch {
    return new Response(
      JSON.stringify({ success: false, message: '请求格式错误' }),
      { status: 400 }
    )
  }
}

/**
 * 刷新 token 接口 mock
 */
export async function handleRefresh(request: Request): Promise<Response> {
  try {
    await new Promise(resolve => setTimeout(resolve, 300))

    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, message: '缺少认证信息' }),
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    
    try {
      const tokenParts = token.split('.')
      if (tokenParts.length < 2) throw new Error('Invalid token')
      const payload = JSON.parse(atob(tokenParts[1] as string))
      const studentId = payload.sub

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            token: generateMockToken(studentId)
          }
        }),
        { status: 200 }
      )
    } catch {
      return new Response(
        JSON.stringify({ success: false, message: '无效的 token' }),
        { status: 401 }
      )
    }
  } catch {
    return new Response(
      JSON.stringify({ success: false, message: '请求失败' }),
      { status: 500 }
    )
  }
}

/**
 * 获取用户信息接口 mock
 */
export async function handleGetUser(request: Request): Promise<Response> {
  try {
    await new Promise(resolve => setTimeout(resolve, 200))

    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, message: '未授权' }),
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    
    try {
      const tokenParts = token.split('.')
      if (tokenParts.length < 2) throw new Error('Invalid token')
      const payload = JSON.parse(atob(tokenParts[1] as string))
      const studentId = payload.sub
      const user = mockUsers[studentId]

      if (!user) {
        return new Response(
          JSON.stringify({ success: false, message: '用户不存在' }),
          { status: 404 }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: user
        }),
        { status: 200 }
      )
    } catch {
      return new Response(
        JSON.stringify({ success: false, message: 'token 解析失败' }),
        { status: 401 }
      )
    }
  } catch {
    return new Response(
      JSON.stringify({ success: false, message: '请求失败' }),
      { status: 500 }
    )
  }
}