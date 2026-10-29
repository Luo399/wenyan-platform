// 同步 backend/data 与 public/data 的答题数据
//
// 安全策略（有损合并已被移除）：
//   1. 合并前逐字段计算 diff，并打印摘要（新增 / 修改 / 从 backend 补齐 / 冲突）
//   2. 数组长度不一致、public 缺少 backend 字段、答案类字段取值冲突 → 拒绝写入并以非零码退出
//   3. 只有显式传入 --force 才允许用 public 覆盖 backend（此时 backend 独有字段会丢失，会明确告警）
//
// 用法：
//   node scripts/sync-quiz-data.cjs           # 安全模式，只写无冲突文件
//   node scripts/sync-quiz-data.cjs --force   # 强制用 public 覆盖冲突文件
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '../public/data');
const BACKEND_DIR = path.join(__dirname, '../backend/data');

const FORCE = process.argv.includes('--force');

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

// 答案类字段：这些字段 public/backend 取值冲突时不允许静默丢弃 backend 值
const ANSWER_PATH_RE = /(^|[.[])(answers?|correct|correctAnswer|correct_answer|solution|key|答案|正确答案)([.[]|$)/i;

function isValidJson(content) {
  try {
    JSON.parse(content);
    return true;
  } catch {
    return false;
  }
}

function typeName(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function isNullish(value) {
  return value === null || value === undefined;
}

function lastKey(keyPath) {
  const match = keyPath.match(/([^.[\]]+)$/);
  return match ? match[1] : '';
}

function createReport() {
  return { added: [], changed: [], filled: [], conflicts: [] };
}

function hasConflict(report) {
  return report.conflicts.length > 0;
}

/**
 * 递归合并 public 与 backend 数据。
 * - public 优先（public 是数据流水线的产出方向）
 * - public 为 null 而 backend 有值 → 用 backend 补齐（不丢答案字段）
 * - public 缺字段 / 数组长度不一致 / 答案字段取值冲突 → 记录冲突
 */
function mergeNode(publicVal, backendVal, keyPath, report) {
  const childPath = keyPath || '(root)';

  if (publicVal === undefined) {
    report.conflicts.push({
      path: childPath,
      reason: 'public 缺少该字段，合并会丢弃 backend 值',
    });
    return backendVal;
  }

  if (isNullish(publicVal) && !isNullish(backendVal)) {
    report.filled.push(childPath);
    return backendVal;
  }

  const publicType = typeName(publicVal);
  const backendType = typeName(backendVal);

  if (publicType !== backendType) {
    report.conflicts.push({
      path: childPath,
      reason: `类型不一致（public=${publicType}, backend=${backendType}）`,
    });
    return publicVal;
  }

  if (publicType === 'array') {
    if (publicVal.length !== backendVal.length) {
      report.conflicts.push({
        path: childPath,
        reason: `数组长度不一致（public=${publicVal.length}, backend=${backendVal.length}）`,
      });
      return publicVal;
    }
    return publicVal.map((item, index) =>
      mergeNode(item, backendVal[index], `${keyPath}[${index}]`, report),
    );
  }

  if (publicType === 'object') {
    const result = { ...publicVal };

    Object.keys(backendVal).forEach((key) => {
      const fieldPath = keyPath ? `${keyPath}.${key}` : key;
      if (!Object.prototype.hasOwnProperty.call(publicVal, key)) {
        report.conflicts.push({
          path: fieldPath,
          reason: 'public 缺少该字段，合并会丢弃 backend 值',
        });
        result[key] = backendVal[key];
        return;
      }
      result[key] = mergeNode(publicVal[key], backendVal[key], fieldPath, report);
    });

    Object.keys(publicVal).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(backendVal, key)) {
        report.added.push(keyPath ? `${keyPath}.${key}` : key);
      }
    });

    return result;
  }

  // 标量
  if (publicVal === backendVal) {
    return publicVal;
  }

  if (ANSWER_PATH_RE.test(keyPath) || ANSWER_PATH_RE.test(lastKey(keyPath))) {
    report.conflicts.push({
      path: childPath,
      reason: `答案字段取值冲突（public=${JSON.stringify(publicVal)}, backend=${JSON.stringify(backendVal)}）`,
    });
    return publicVal;
  }

  report.changed.push(childPath);
  return publicVal;
}

function printDiffSummary(label, report) {
  console.log(
    `  [差异] ${label}: 新增 ${report.added.length}, 修改 ${report.changed.length}, ` +
      `补齐 ${report.filled.length}, 冲突 ${report.conflicts.length}`,
  );
  report.conflicts.slice(0, 5).forEach((conflict) => {
    console.log(`    冲突 ${conflict.path}: ${conflict.reason}`);
  });
  if (report.conflicts.length > 5) {
    console.log(`    ... 另有 ${report.conflicts.length - 5} 处冲突未列出`);
  }
}

function syncDir(dirName) {
  const publicPath = path.join(PUBLIC_DIR, dirName);
  const backendPath = path.join(BACKEND_DIR, dirName);

  if (!fs.existsSync(publicPath) || !fs.existsSync(backendPath)) {
    return { synced: 0, skipped: 0, conflict: 0, error: 0 };
  }

  const publicFiles = fs.readdirSync(publicPath);
  const stats = { synced: 0, skipped: 0, conflict: 0, error: 0 };

  publicFiles.forEach((file) => {
    const publicFile = path.join(publicPath, file);
    const backendFile = path.join(backendPath, file);
    const stat = fs.statSync(publicFile);

    if (!stat.isFile() || !file.endsWith('.json')) return;

    const publicContent = fs.readFileSync(publicFile, 'utf-8');
    if (!isValidJson(publicContent)) {
      // public 是数据源，无效就无法安全合并
      console.warn(`  [跳过] ${dirName}/${file}: public 侧 JSON 无效`);
      stats.skipped++;
      return;
    }

    if (!fs.existsSync(backendFile)) {
      fs.mkdirSync(backendPath, { recursive: true });
      fs.copyFileSync(publicFile, backendFile);
      console.log(`  [新建] ${dirName}/${file}`);
      stats.synced++;
      return;
    }

    const backendContent = fs.readFileSync(backendFile, 'utf-8');
    if (!isValidJson(backendContent)) {
      if (!FORCE) {
        console.error(
          `  [拒绝写入] ${dirName}/${file}: backend 侧 JSON 无效，覆盖会丢失 backend 数据。` +
            '请先人工修复，或确认后加 --force 覆盖。',
        );
        stats.conflict++;
        return;
      }
      fs.copyFileSync(publicFile, backendFile);
      console.warn(`  [--force 覆盖] ${dirName}/${file}: backend JSON 无效，已用 public 覆盖`);
      stats.synced++;
      return;
    }

    const publicData = JSON.parse(publicContent);
    const backendData = JSON.parse(backendContent);
    const report = createReport();
    const merged = mergeNode(publicData, backendData, '', report);
    const label = `${dirName}/${file}`;

    printDiffSummary(label, report);

    if (hasConflict(report) && !FORCE) {
      console.error(
        `  [拒绝写入] ${dirName}/${file}: 存在 ${report.conflicts.length} 处冲突，` +
          '已跳过（backend 未改动）。确认 public 为唯一正确来源后可用 --force 覆盖。',
      );
      stats.conflict++;
      return;
    }

    if (hasConflict(report) && FORCE) {
      fs.writeFileSync(backendFile, JSON.stringify(publicData, null, 2) + '\n', 'utf-8');
      console.warn(
        `  [--force 覆盖] ${dirName}/${file}: backend 独有字段/取值已被丢弃（见上方冲突清单）`,
      );
      stats.synced++;
      return;
    }

    if (JSON.stringify(merged) !== JSON.stringify(backendData)) {
      fs.writeFileSync(backendFile, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
      console.log(`  [更新] ${dirName}/${file}`);
      stats.synced++;
    } else {
      stats.skipped++;
    }
  });

  console.log(
    `[完成] ${dirName}: 写入${stats.synced}, 跳过${stats.skipped}, 冲突${stats.conflict}, 错误${stats.error}`,
  );
  return stats;
}

function main() {
  console.log(`开始同步 backend/data 与 public/data 的答题数据...${FORCE ? '（--force 模式）' : ''}\n`);

  const total = { synced: 0, skipped: 0, conflict: 0, error: 0 };
  SYNC_DIRS.forEach((dir) => {
    console.log(`\n=== 同步目录: ${dir} ===`);
    const stats = syncDir(dir);
    Object.keys(total).forEach((key) => {
      total[key] += stats[key];
    });
  });

  console.log(
    `\n=== 同步完成: 写入 ${total.synced}, 跳过 ${total.skipped}, 冲突 ${total.conflict}, 错误 ${total.error} ===`,
  );

  if (total.conflict > 0 || total.error > 0) {
    console.error('\n存在冲突或错误，已以非零码退出。');
    if (!FORCE) {
      console.error('如确认 public 是唯一权威数据源，可显式执行：node scripts/sync-quiz-data.cjs --force');
    }
    process.exitCode = 1;
  }
}

main();
