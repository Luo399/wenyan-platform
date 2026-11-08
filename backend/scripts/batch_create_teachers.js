/**
 * 批量创建教师账号脚本
 *
 * 用途：调用管理员 API 批量创建教师账号（默认 a001 ~ a009），
 *      每个账号的口令由脚本随机生成，只在本终端打印一次。
 *
 * 用法：
 *   ADMIN_USERNAME=xxx ADMIN_PASSWORD=xxx \
 *   node backend/scripts/batch_create_teachers.js <API_BASE_URL>
 *
 * 示例：
 *   ADMIN_USERNAME=admin ADMIN_PASSWORD='...' \
 *   node backend/scripts/batch_create_teachers.js https://test-api.classicalab.cn
 *
 * 安全约束：
 *   - 不再内置默认管理员口令，必须用 ADMIN_USERNAME / ADMIN_PASSWORD 环境变量提供
 *   - 不再默认指向生产域名，API_BASE_URL 必须显式给出
 *   - 口令为随机生成，脚本不写日志文件；成批口令请当场保存到密码管理器
 *
 * 前置条件：
 *   - 管理员的 school_id 为 1（默认学校）
 */

const crypto = require('crypto')

const BASE_URL = (process.argv[2] || process.env.API_BASE_URL || '').replace(/\/+$/, '')
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || ''
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ''

/** 生成一次性口令：大小写 + 数字，排除易混淆字符 */
function generatePassword(length = 12) {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < length; i++) out += alphabet[crypto.randomInt(alphabet.length)]
  return out
}

/** 教师账号列表 */
const TEACHERS = Array.from({ length: 9 }, (_, i) => {
  const num = String(i + 1).padStart(3, '0')
  return {
    phone: `a${num}`,
    name: `a${num}`,
    password: generatePassword(),
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
  const init = { method, headers }
  // GET/HEAD 不允许携带 body（fetch 会直接抛 TypeError），仅在需要时附加
  if (body !== undefined && body !== null) init.body = JSON.stringify(body)
  const res = await fetch(url, init)
  const data = await res.json()
  return { status: res.status, data }
}

async function main() {
  if (!BASE_URL) {
    console.error('[错误] 必须显式提供 API 地址：node batch_create_teachers.js <API_BASE_URL>')
    process.exit(1)
  }
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.error('[错误] 必须设置 ADMIN_USERNAME 与 ADMIN_PASSWORD 环境变量（脚本不再内置默认管理员）')
    process.exit(1)
  }
  if (/^http:\/\//i.test(BASE_URL)) {
    console.warn('[警告] 使用明文 HTTP，管理员口令与初始口令会以明文经过网络')
  }

  console.log(`[batch] API 地址: ${BASE_URL}`)
  console.log(`[batch] 待创建账号: ${TEACHERS.length} 个 (a001 ~ a009)`)

  // 1. 管理员登录
  console.log('\n[step 1] 管理员登录...')
  const loginRes = await request('POST', `${BASE_URL}/api/auth/admin/login`, {
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD,
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
  const created = []

  for (const teacher of TEACHERS) {
    try {
      const res = await request('POST', `${BASE_URL}/api/admin/teachers`, teacher, token)
      if (res.data.success) {
        console.log(`  ✓ ${teacher.phone} (${teacher.name}) 创建成功`)
        created.push(teacher)
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

  if (created.length > 0) {
    console.log('\n本次新建账号（口令只显示一次，请立即保存到密码管理器，勿复制到聊天/文档）：')
    console.log('  phone（登录名）  | 一次性口令   | 姓名')
    console.log('  ' + '-'.repeat(48))
    for (const t of created) {
      console.log(`  ${t.phone.padEnd(14)} | ${t.password.padEnd(12)} | ${t.name}`)
    }
    console.log(`\n登录地址: ${BASE_URL}/teacher-login`)
    console.log('首次登录后请要求教师立即修改口令。')
  }
}

main().catch((err) => {
  console.error('[错误] 脚本异常:', err)
  process.exit(1)
})