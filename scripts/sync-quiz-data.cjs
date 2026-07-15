// 同步 backend/data 与 public/data 的答题数据
// 策略：只同步两边都是有效 JSON 的文件；忽略有问题的文件
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '../public/data');
const BACKEND_DIR = path.join(__dirname, '../backend/data');

const SYNC_DIRS = [
  'level1_quiz',
  'pages_level2_dialog_quiz',
  'pages_level3_adaptive_quiz',
  'text-quiz',
  'level2_quiz',
  'level3_quiz',
  'level2_dialog',
  'level3_scenario_text',
];

function isValidJson(content) {
  try {
    JSON.parse(content);
    return true;
  } catch (e) {
    return false;
  }
}

function syncDir(dirName) {
  const publicPath = path.join(PUBLIC_DIR, dirName);
  const backendPath = path.join(BACKEND_DIR, dirName);

  if (!fs.existsSync(publicPath) || !fs.existsSync(backendPath)) {
    return;
  }

  const publicFiles = fs.readdirSync(publicPath);
  let stats = { synced: 0, skipped: 0, error: 0 };

  publicFiles.forEach((file) => {
    const publicFile = path.join(publicPath, file);
    const backendFile = path.join(backendPath, file);
    const stat = fs.statSync(publicFile);

    if (!stat.isFile() || !file.endsWith('.json')) return;

    // 只处理两边都是有效 JSON 的文件
    const publicContent = fs.readFileSync(publicFile, 'utf-8');
    if (!isValidJson(publicContent)) {
      stats.skipped++;
      return;
    }

    if (!fs.existsSync(backendFile)) {
      // backend 缺失，从 public 复制（但 public 必须有效）
      fs.mkdirSync(backendPath, { recursive: true });
      fs.copyFileSync(publicFile, backendFile);
      console.log(`  [新建] ${dirName}/${file}`);
      stats.synced++;
      return;
    }

    const backendContent = fs.readFileSync(backendFile, 'utf-8');
    if (!isValidJson(backendContent)) {
      // backend 有问题但 public 有效 - 覆盖
      fs.copyFileSync(publicFile, backendFile);
      console.log(`  [覆盖修复] ${dirName}/${file}`);
      stats.synced++;
      return;
    }

    // 两边都有效，合并
    try {
      const publicData = JSON.parse(publicContent);
      const backendData = JSON.parse(backendContent);
      const merged = mergeData(publicData, backendData);

      if (JSON.stringify(merged) !== JSON.stringify(backendData)) {
        fs.writeFileSync(backendFile, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
        console.log(`  [更新] ${dirName}/${file}`);
        stats.synced++;
      } else {
        stats.skipped++;
      }
    } catch (err) {
      console.error(`  [错误] ${dirName}/${file}: ${err.message}`);
      stats.error++;
    }
  });

  console.log(`[完成] ${dirName}: 同步${stats.synced}, 跳过${stats.skipped}, 错误${stats.error}`);
}

function mergeData(publicData, backendData) {
  if (Array.isArray(publicData)) {
    return publicData;
  }

  if (typeof publicData !== 'object' || publicData === null) {
    return publicData || backendData;
  }

  // 优先用 public 的数据作为基础
  const result = { ...publicData };

  // backend 中非空的字段覆盖
  Object.keys(backendData).forEach((key) => {
    const backendVal = backendData[key];
    if (backendVal === null || backendVal === undefined) {
      return;
    }
    // 如果 public 中是 null/undefined，用 backend 覆盖
    if (result[key] === null || result[key] === undefined) {
      result[key] = backendVal;
    }
  });

  return result;
}

function main() {
  console.log('开始同步 backend/data 与 public/data 的答题数据...\n');
  SYNC_DIRS.forEach((dir) => {
    console.log(`\n=== 同步目录: ${dir} ===`);
    syncDir(dir);
  });
  console.log('\n=== 同步完成 ===');
}

main();
