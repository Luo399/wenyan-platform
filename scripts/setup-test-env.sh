#!/usr/bin/env bash
set -euo pipefail

# 必需参数/变量校验（只报变量名，不打印值）
if [ -z "${SERVER_PROJECT_PATH:-}" ]; then
  echo "ERROR: SERVER_PROJECT_PATH not set" >&2
  exit 1
fi
if [ -z "${JWT_SECRET:-}" ]; then
  echo "ERROR: JWT_SECRET not set（生成：openssl rand -hex 32）" >&2
  exit 1
fi
if [ -z "${ASSET_SYNC_TOKEN:-}" ]; then
  echo "ERROR: ASSET_SYNC_TOKEN not set（生成：openssl rand -hex 32）" >&2
  exit 1
fi

TEST_PATH="${SERVER_PROJECT_PATH}-test"

echo "=== 设置测试环境 ==="
echo "测试路径: $TEST_PATH"

if [ ! -d "$TEST_PATH" ]; then
  git clone https://github.com/Luo399/wenyan-platform.git "$TEST_PATH"
  echo "已克隆仓库到测试目录"
fi

cd "$TEST_PATH"
git fetch origin feature-1
git checkout feature-1
git reset --hard origin/feature-1

echo "=== 配置测试环境变量 ==="

umask 077
ENV_FILE="$TEST_PATH/backend/.env"
if [ -f "$ENV_FILE" ]; then
  PREV="$ENV_FILE.prev"
  cp -p "$ENV_FILE" "$PREV"
  # 保留旧文件中除下面这些键以外的全部配置
  grep -vE '^(PORT|CORS_ORIGIN|JWT_SECRET|ASSET_SYNC_TOKEN)=' "$PREV" > "$ENV_FILE" || true
else
  PREV=""
  : > "$ENV_FILE"
fi

cat >> "$ENV_FILE" <<EOF
PORT=3001
CORS_ORIGIN=https://test.classicalab.cn
JWT_SECRET=$JWT_SECRET
ASSET_SYNC_TOKEN=$ASSET_SYNC_TOKEN
EOF
chmod 600 "$ENV_FILE"
if [ -n "$PREV" ]; then
  rm -f "$PREV"
fi

# 写入后再校验一次，防止空值落盘
MISSING=""
for KEY in JWT_SECRET ASSET_SYNC_TOKEN; do
  if ! grep -qE "^${KEY}=.+" "$ENV_FILE"; then
    MISSING="$MISSING $KEY"
  fi
done
if [ -n "$MISSING" ]; then
  echo "ERROR: $ENV_FILE 缺少必需变量:$MISSING" >&2
  exit 1
fi

echo "测试环境配置完成"
echo ""
echo "=== 启动测试后端 ==="

cd "$TEST_PATH/backend"
# 项目约定：后端 lock 文件可能不同步，不用 npm ci
npm install --omit=dev --no-audit --no-fund

if pm2 describe wenyan-backend-test > /dev/null 2>&1; then
  pm2 reload wenyan-backend-test --update-env
  echo "已重载测试后端"
else
  pm2 start server.js --name wenyan-backend-test
  echo "已启动测试后端"
fi

echo ""
echo "测试环境状态:"
pm2 status wenyan-backend-test
