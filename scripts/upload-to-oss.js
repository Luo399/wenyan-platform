/**
 * OSS 上传脚本
 * 将本地媒体文件批量上传到阿里云 OSS
 * 
 * 使用方法：
 *   node scripts/upload-to-oss.js
 *   node scripts/upload-to-oss.js --dry-run  仅预览不上传
 * 
 * 环境变量（在 .env 中配置）：
 *   OSS_REGION - OSS 区域，如 oss-cn-hangzhou
 *   OSS_ACCESS_KEY_ID - 阿里云 AccessKey ID
 *   OSS_ACCESS_KEY_SECRET - 阿里云 AccessKey Secret
 *   OSS_BUCKET - Bucket 名称
 */

require('dotenv').config();
const OSS = require('ali-oss');
const fs = require('fs');
const path = require('path');

// ============================================================
// 配置
// ============================================================

// OSS 配置（从环境变量读取）
const ossConfig = {
  region: process.env.OSS_REGION || 'oss-cn-hangzhou',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET
};

// 本地媒体目录
const publicDir = path.join(__dirname, '..', 'public');

// 媒体文件扩展名
const mediaExtensions = ['.mp4', '.mp3', '.png', '.jpg', '.jpeg', '.gif', '.webm', '.webp'];

// 命令行参数
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// ============================================================
// 验证配置
// ============================================================

function validateConfig() {
  const missing = [];
  if (!ossConfig.accessKeyId) missing.push('OSS_ACCESS_KEY_ID');
  if (!ossConfig.accessKeySecret) missing.push('OSS_ACCESS_KEY_SECRET');
  if (!ossConfig.bucket) missing.push('OSS_BUCKET');

  if (missing.length > 0) {
    console.error('❌ 缺少必要的环境变量配置：');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\n请在 .env 文件中配置这些变量，或参考 .env.example');
    process.exit(1);
  }
}

// ============================================================
// 扫描媒体文件
// ============================================================

function scanMediaFiles(dir, files = []) {
  if (!fs.existsSync(dir)) {
    console.log(`⚠️  目录不存在: ${dir}`);
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      scanMediaFiles(fullPath, files);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (mediaExtensions.includes(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

// ============================================================
// 上传文件到 OSS
// ============================================================

async function uploadToOSS(client, localPath, ossPath) {
  try {
    const result = await client.put(ossPath, localPath);
    return {
      success: true,
      url: result.url,
      ossPath
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      ossPath
    };
  }
}

// ============================================================
// 主函数
// ============================================================

async function runUpload() {
  console.log('========================================');
  console.log('OSS 媒体文件上传脚本');
  console.log('========================================');
  console.log(`OSS 区域: ${ossConfig.region}`);
  console.log(`OSS Bucket: ${ossConfig.bucket}`);
  console.log(`本地目录: ${publicDir}`);
  console.log(`运行模式: ${dryRun ? '预览模式（不上传）' : '上传模式'}`);
  console.log('========================================');

  // 验证配置
  if (!dryRun) {
    validateConfig();
  }

  // 扫描媒体文件
  console.log('\n扫描媒体文件...');
  const files = scanMediaFiles(publicDir);

  if (files.length === 0) {
    console.log('⚠️  未找到任何媒体文件');
    process.exit(0);
  }

  console.log(`找到 ${files.length} 个媒体文件：`);
  files.forEach(f => {
    const relativePath = path.relative(publicDir, f);
    const sizeKB = Math.round(fs.statSync(f).size / 1024);
    console.log(`  - ${relativePath} (${sizeKB} KB)`);
  });

  // 预览模式：仅显示文件列表
  if (dryRun) {
    console.log('\n========================================');
    console.log('✅ 预览完成！以上文件将被上传到 OSS');
    console.log('========================================');
    console.log('\n运行 node scripts/upload-to-oss.js 执行实际上传');
    process.exit(0);
  }

  // 创建 OSS 客户端
  const client = new OSS(ossConfig);

  // 上传文件
  console.log('\n开始上传...');
  const results = [];

  for (const localPath of files) {
    // 计算 OSS 路径（去掉 public 前缀）
    const ossPath = path.relative(publicDir, localPath);
    
    console.log(`上传: ${ossPath}`);
    const result = await uploadToOSS(client, localPath, ossPath);
    results.push(result);

    if (result.success) {
      console.log(`  ✅ 成功: ${result.url}`);
    } else {
      console.log(`  ❌ 失败: ${result.error}`);
    }
  }

  // 统计结果
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  console.log('\n========================================');
  console.log('上传完成！');
  console.log('========================================');
  console.log(`成功: ${successCount} 个`);
  console.log(`失败: ${failCount} 个`);

  if (failCount > 0) {
    console.log('\n失败的文件：');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.ossPath}: ${r.error}`);
    });
    process.exit(1);
  }

  process.exit(0);
}

// 执行上传
runUpload();