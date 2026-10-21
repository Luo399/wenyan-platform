/**
 * upload-to-oss.js
 * 统一数据上传脚本：把 public/data + public/images + public/video + public/audio 推到阿里云 OSS
 *
 * 用法（Windows / PowerShell，node 路径按本机实际调整）：
 *   $env:Path = "<node-dir>;$env:Path"
 *   node scripts/upload-to-oss.js --env test          # 全量上传测试桶
 *   node scripts/upload-to-oss.js --env test --only data
 *   node scripts/upload-to-oss.js --env prod           # 全量上传生产桶
 *   node scripts/upload-to-oss.js --env prod --dry-run # 预览（不上传）
 *
 * 配置：读取根目录 .env 文件（不进 git），参考 .env.example 填 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET
 *
 * 证书到期：本脚本走 OSS SDK + AK/SK 直连，不走浏览器 HTTPS 证书，不受影响。
 */
import * as dotenv from 'dotenv'
import OSS from 'ali-oss'
import fs from 'fs'
import path from 'path'

dotenv.config()

// ===== Bucket 映射 =====
// 用户填了 OSS_BUCKET_PROD / OSS_BUCKET_TEST 就用环境变量，否则 fallback 硬编码
const BUCKET_MAP = {
  prod: process.env.OSS_BUCKET_PROD || 'classic-chinese',
  test: process.env.OSS_BUCKET_TEST || 'wenyan-test-online',
}

const REGION = process.env.OSS_REGION || 'oss-cn-guangzhou'
const DRY_RUN = process.argv.includes('--dry-run')

// 只传某一类（data / images / video / audio / dist），默认全传
const ONLY_DIR = (() => {
  const idx = process.argv.indexOf('--only')
  return idx >= 0 ? process.argv[idx + 1] : null
})()

const ENV = (() => {
  const idx = process.argv.indexOf('--env')
  return idx >= 0 ? process.argv[idx + 1] : 'prod'
})()

if (!['test', 'prod'].includes(ENV)) {
  console.error('❌ 请用 --env test 或 --env prod')
  process.exit(1)
}

const BUCKET = BUCKET_MAP[ENV]
const TARGET_BASE = 'public' // 非 --dist 模式时上传的根目录

// 非 dist 模式：要上传的顶层子目录（按 only 过滤）
const ALL_DIRS = ['data', 'images', 'video', 'audio']
const DIRS_TO_UPLOAD = ONLY_DIR ? [ONLY_DIR] : ALL_DIRS

const ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]):/, '$1:'),
  '..',
)

const ossConfig = {
  region: REGION,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: BUCKET,
  timeout: 300000, // 5 min for large mp4
  secure: true,
}

function validateConfig() {
  const missing = []
  if (!ossConfig.accessKeyId) missing.push('OSS_ACCESS_KEY_ID')
  if (!ossConfig.accessKeySecret) missing.push('OSS_ACCESS_KEY_SECRET')
  if (missing.length > 0) {
    console.error('❌ 缺少 .env 配置：')
    missing.forEach((k) => console.error(`   - ${k}`))
    console.error(`\n请在仓库根目录建 .env 文件，参考 .env.example 填好。\n` +
      `注意：.env 含 AK/SK，.gitignore 已忽略，禁止提交到 git。`)
    process.exit(1)
  }
}

function scanDir(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`  ⚠️  跳过不存在的目录: ${path.relative(ROOT, dir)}`)
    return []
  }
  const files = []
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) walk(full)
      else files.push(full)
    }
  }
  walk(dir)
  return files
}

async function uploadOne(client, localPath, ossPath) {
  try {
    const result = await client.put(ossPath, localPath, {
      headers: { 'x-oss-object-acl': 'public-read' },
    })
    return { ok: true, ossPath, url: result.url }
  } catch (err) {
    return { ok: false, ossPath, error: err.message }
  }
}

async function run() {
  console.log('========================================')
  console.log(`OSS 数据上传 --env ${ENV}`)
  console.log('========================================')
  console.log(`Bucket:   ${BUCKET} (${REGION})`)
  console.log(`目录:     ${DIRS_TO_UPLOAD.join(', ')}`)
  console.log(`模式:     ${DRY_RUN ? 'DRY-RUN（预览，不上传）' : '实际上传'}`)
  console.log('========================================\n')

  // 扫描所有目录
  const groups = {}
  let total = 0
  for (const dir of DIRS_TO_UPLOAD) {
    const local = path.join(ROOT, TARGET_BASE, dir)
    const files = scanDir(local)
    groups[dir] = files
    total += files.length
    const relCount = files.length
    console.log(`📂 ${dir}/  ${relCount} 个文件`)
  }

  if (total === 0) {
    console.log('\n⚠️  没找到任何文件，退出。')
    process.exit(0)
  }

  if (DRY_RUN) {
    console.log(`\n✅ DRY-RUN 完成：共 ${total} 个文件将上传到 oss://${BUCKET}/`)
    console.log('   去掉 --dry-run 执行实际上传。')
    process.exit(0)
  }

  validateConfig()
  const client = new OSS(ossConfig)

  let success = 0
  let fail = 0
  const errors = []

  for (const dir of DIRS_TO_UPLOAD) {
    const files = groups[dir]
    if (files.length === 0) continue
    console.log(`\n--- 上传 ${dir}/ (${files.length}) ---`)

    for (const local of files) {
      const ossPath = path.relative(path.join(ROOT, TARGET_BASE), local).replace(/\\/g, '/')
      const sizeKB = Math.round(fs.statSync(local).size / 1024)
      const result = await uploadOne(client, local, ossPath)
      if (result.ok) {
        console.log(`  ✅ ${ossPath} (${sizeKB} KB)`)
        success++
      } else {
        console.log(`  ❌ ${ossPath}: ${result.error}`)
        errors.push(result)
        fail++
      }
    }
  }

  console.log('\n========================================')
  console.log(`上传完成：成功 ${success} | 失败 ${fail}`)
  console.log(`目标 URL：${ENV === 'prod' ? 'https://www.classicalab.cn' : 'https://test.classicalab.cn'}`)
  console.log('========================================')

  if (errors.length > 0) {
    console.log('\n失败的文件（复制下来重跑即可）：')
    errors.forEach((e) => console.log(`  - ${e.ossPath}: ${e.error}`))
    process.exit(1)
  }
  process.exit(0)
}

run().catch((e) => {
  console.error('💥 脚本异常:', e.message)
  process.exit(1)
})
