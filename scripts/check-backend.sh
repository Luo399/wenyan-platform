#!/bin/bash
# 检查后端进程和代码状态
set -euo pipefail

PROJECT_PATH="${PROJECT_PATH:-/www/wwwroot/api.classicalab.cn}"
BACKEND_PATH="$PROJECT_PATH/backend"

if [ ! -d "$BACKEND_PATH" ]; then
  echo "ERROR: 后端目录不存在: $BACKEND_PATH（可用 PROJECT_PATH=... 覆盖）" >&2
  exit 1
fi
if ! command -v pm2 >/dev/null 2>&1; then
  echo "ERROR: 未找到 pm2" >&2
  exit 1
fi

cd "$BACKEND_PATH"

echo "=== 1. PM2 进程详情 ==="
pm2 jlist | head -100 || true

echo ""
echo "=== 2. backend 进程配置 ==="
pm2 show backend 2>&1 | head -20 || true

echo ""
echo "=== 3. server.js 大小和健康端点检查 ==="
wc -l server.js
grep -n "health\|/api/" server.js | head -20 || true

echo ""
echo "=== 4. 查看 wenyan-backend 错误日志 ==="
pm2 logs wenyan-backend --lines 20 --nostream 2>&1 | tail -30 || true

echo ""
echo "=== 5. 查看 backend 进程日志 ==="
pm2 logs backend --lines 10 --nostream 2>&1 | tail -20 || true
