#!/bin/bash
# 测试环境诊断与修复脚本（只操作本项目测试目录/进程）
set -euo pipefail

PROJECT_PATH="${PROJECT_PATH:-/www/wwwroot/wenyan-platform-test}"
BACKEND_PATH="$PROJECT_PATH/backend"
TEST_API_BASE="${TEST_API_BASE:-http://127.0.0.1:3001}"
TEST_DOMAIN="${TEST_DOMAIN:-test-api.classicalab.cn}"

if [ ! -d "$BACKEND_PATH" ]; then
  echo "ERROR: 后端目录不存在: $BACKEND_PATH（可用 PROJECT_PATH=... 覆盖）" >&2
  exit 1
fi
if ! command -v pm2 >/dev/null 2>&1; then
  echo "ERROR: 未找到 pm2，请先安装/加载 Node 环境" >&2
  exit 1
fi

echo "========================================"
echo "  测试环境诊断与修复脚本"
echo "========================================"

echo ""
echo "=== 1. PM2 进程状态 ==="
pm2 status || true

echo ""
echo "=== 2. 端口监听检查 ==="
if command -v ss >/dev/null 2>&1; then
  ss -tlnp | grep -E ':(3000|3001)\s' || echo "3000/3001 端口均未监听"
else
  echo "未找到 ss，跳过端口检查"
fi

echo ""
echo "=== 3. 创建/修复 .env 文件 ==="
ENV_FILE="$BACKEND_PATH/.env"
umask 077
if [ -f "$ENV_FILE" ]; then
  PREV="$ENV_FILE.prev"
  cp -p "$ENV_FILE" "$PREV"
  # 只覆盖 PORT/CORS，其余键（JWT_SECRET / ASSET_SYNC_TOKEN / DASHBOARD_PASSWORD 等）原样保留
  grep -vE '^(PORT|CORS_ORIGIN)=' "$PREV" > "$ENV_FILE" || true
else
  PREV=""
  : > "$ENV_FILE"
fi

set_if_missing() {
  KEY="$1"
  VALUE="$2"
  if ! grep -qE "^${KEY}=.+" "$ENV_FILE" && [ -n "$VALUE" ]; then
    printf '%s=%s\n' "$KEY" "$VALUE" >> "$ENV_FILE"
    echo "$KEY 已从环境变量写入"
  fi
}

echo "PORT=3001" >> "$ENV_FILE"
echo "CORS_ORIGIN=http://test.classicalab.cn,https://test.classicalab.cn" >> "$ENV_FILE"
set_if_missing JWT_SECRET "${JWT_SECRET:-}"
set_if_missing ASSET_SYNC_TOKEN "${ASSET_SYNC_TOKEN:-}"

chmod 600 "$ENV_FILE"
if [ -n "$PREV" ]; then
  rm -f "$PREV"
fi

MISSING=""
for KEY in JWT_SECRET ASSET_SYNC_TOKEN; do
  if ! grep -qE "^${KEY}=.+" "$ENV_FILE"; then
    MISSING="$MISSING $KEY"
  fi
done
if [ -n "$MISSING" ]; then
  echo "ERROR: $ENV_FILE 缺少必需变量:$MISSING" >&2
  echo "请通过环境变量 JWT_SECRET / ASSET_SYNC_TOKEN 提供后重跑（不会打印变量值）" >&2
  exit 1
fi
echo "已更新 $ENV_FILE（chmod 600，不打印内容）"

echo ""
echo "=== 4. 删除旧 PM2 进程 ==="
pm2 delete wenyan-backend-test 2>&1 || true

echo ""
echo "=== 5. 重新安装依赖 ==="
echo "提示：如依赖仍然异常，请手动执行（脚本不再自动删除目录）："
echo "  cd \"$BACKEND_PATH\" && rm -rf node_modules && npm install --omit=dev --no-audit --no-fund"
cd "$BACKEND_PATH"
npm install --omit=dev --no-audit --no-fund 2>&1 | tail -5

echo ""
echo "=== 6. 启动后端服务（从 backend 目录）==="
pm2 start server.js --name wenyan-backend-test

echo ""
echo "=== 7. 等待服务启动 (3s) ==="
sleep 3

echo ""
echo "=== 8. PM2 状态 ==="
pm2 status || true

echo ""
echo "=== 9. 本地测试后端 API ==="
curl -s -w "\nHTTP状态码: %{http_code}\n" "$TEST_API_BASE/api/health" 2>&1 || echo "连接失败"

echo ""
echo "=== 10. 域名反向代理测试 ==="
curl -s -w "\nHTTP状态码: %{http_code}\n" "http://$TEST_DOMAIN/api/health" 2>&1 || echo "连接失败"

echo ""
echo "========================================"
echo "  后端检查完成"
echo "========================================"
