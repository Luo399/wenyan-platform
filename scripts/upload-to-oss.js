import * as dotenv from 'dotenv';
dotenv.config();
import OSS from 'ali-oss';
import fs from 'fs';
import path from 'path';

const ossConfig = {
  region: process.env.OSS_REGION || 'oss-cn-hangzhou',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET
};

const publicDir = path.join(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]):/, '$1:'), '..', 'public');

const mediaExtensions = ['.mp4', '.mp3', '.png', '.jpg', '.jpeg', '.gif', '.webm', '.webp'];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

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

async function runUpload() {
  console.log('========================================');
  console.log('OSS 媒体文件上传脚本');
  console.log('========================================');
  console.log(`OSS 区域: ${ossConfig.region}`);
  console.log(`OSS Bucket: ${ossConfig.bucket}`);
  console.log(`本地目录: ${publicDir}`);
  console.log(`运行模式: ${dryRun ? '预览模式（不上传）' : '上传模式'}`);
  console.log('========================================');

  if (!dryRun) {
    validateConfig();
  }

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

  if (dryRun) {
    console.log('\n========================================');
    console.log('✅ 预览完成！以上文件将被上传到 OSS');
    console.log('========================================');
    console.log('\n运行 node scripts/upload-to-oss.js 执行实际上传');
    process.exit(0);
  }

  const client = new OSS(ossConfig);

  console.log('\n开始上传...');
  const results = [];

  for (const localPath of files) {
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

runUpload();