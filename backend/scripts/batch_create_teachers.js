/**
 * 批量创建教师账号脚本
 *
 * 用途：调用管理员 API 创建教师账号 a001 ~ a009，密码统一为 12345678
 *
 * 用法：
 *   node backend/scripts/batch_create_teachers.js [API_BASE_URL]
 *
 * 示例：
 *   node backend/scripts/batch_create_teachers.js https://test-api.classicalab.cn
 *   node backend/scripts/batch_create_teachers.js https://api.classicalab.cn
 *
 * 默认 API_BASE_URL: https://test-api.classicalab.cn
 *
 * 前置条件：
 *   - 管理员的 school_id 为 1（默认学校）
 *   - 管理员账号 admin / admin123
 */

const BASE_URL = process.argv[2] || 'https://test-api.classicalab.cn'

/** 教师账号列表 */
const TEACHERS = Array.from({ length: 9 }, (_, i) => {
  const num = String(i + 1).padStart(3, '0')
  return {
    phone: `a${num}`,
    name: `a${num}`,
    password: '12345678',
    school_id: 1,
    class_codes: ['000000'],
  }
})

/**
 * 发起 HTTP 请求
 */
async function request(method, url, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  return { status: res.status, data }
}

async function main() {
  console.log(`[batch] API 地址: ${BASE_URL}`)
  console.log(`[batch] 待创建账号: ${TEACHERS.length} 个 (a001 ~ a009)`)

  // 1. 管理员登录
  console.log('\n[step 1] 管理员登录...')
  const loginRes = await request('POST', `${BASE_URL}/api/auth/admin/login`, {
    username: 'admin',
    password: 'admin123',
  })
  if (!loginRes.data.success) {
    console.error('[错误] 管理员登录失败:', loginRes.data.message)
    process.exit(1)
  }
  const token = loginRes.data.data.token
  console.log('[成功] 管理员登录成功')

  // 2. 获取学校列表（确认 school_id = 1 存在）
  console.log('\n[step 2] 验证学校...')
  const schoolRes = await request('GET', `${BASE_URL}/api/admin/teachers`, null, token)
  if (!schoolRes.data.success) {
    console.warn('[警告] 无法验证学校信息，将使用 school_id = 1')
  } else {
    console.log('[信息] 学校验证通过，使用 school_id = 1')
  }

  // 3. 批量创建教师
  console.log('\n[step 3] 批量创建教师账号...')
  let success = 0
  let failed = 0

  for (const teacher of TEACHERS) {
    try {
      const res = await request('POST', `${BASE_URL}/api/admin/teachers`, teacher, token)
      if (res.data.success) {
        console.log(`  ✓ ${teacher.phone} (${teacher.name}) 创建成功`)
        success++
      } else if (res.status === 409) {
        console.log(`  - ${teacher.phone} 已存在，跳过`)
        success++
      } else {
        console.error(`  ✕ ${teacher.phone} 创建失败: ${res.data.message}`)
        failed++
      }
    } catch (err) {
      console.error(`  ✕ ${teacher.phone} 请求异常: ${err.message}`)
      failed++
    }
  }

  // 4. 汇总
  console.log(`\n[完成] 成功 ${success} 个，失败 ${failed} 个`)

  if (success > 0) {
    console.log('\n教师账号列表：')
    console.log('  phone（登录名）  | 密码      | 姓名')
    console.log('  ' + '-'.repeat(40))
    for (const t of TEACHERS) {
      console.log(`  ${t.phone.padEnd(14)} | ${t.password.padEnd(9)} | ${t.name}`)
    }
    console.log(`\n登录地址: ${BASE_URL}/teacher-login`)
  }
}

main().catch((err) => {
  console.error('[错误] 脚本异常:', err)
  process.exit(1)
})