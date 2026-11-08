#!/bin/bash
set -euo pipefail

PROJECT_PATH="${PROJECT_PATH:-/www/wwwroot/wenyan-platform-test}"
DOMAIN="${DOMAIN:-test-api.classicalab.cn}"
LOCAL_HEALTH="${LOCAL_HEALTH:-http://127.0.0.1:3001/api/health}"

echo "=== PM2 进程状态 ==="
pm2 status || true

echo ""
echo "=== 检查 3001 端口 ==="
if command -v ss >/dev/null 2>&1; then
  ss -tlnp | grep 3001 || echo "3001 端口未监听"
elif command -v netstat >/dev/null 2>&1; then
  netstat -tlnp | grep 3001 || echo "3001 端口未监听"
else
  echo "未找到 ss/netstat，跳过端口检查"
fi

echo ""
echo "=== 测试后端本地访问 ==="
curl -s -o /dev/null -w "%{http_code}\n" "$LOCAL_HEALTH" 2>/dev/null || echo "无法连接"

echo ""
echo "=== 检查测试项目目录 ==="
ls -la "$PROJECT_PATH/" || true

echo ""
echo "=== 检查 Nginx 配置 ==="
cat "/www/server/panel/vhost/nginx/$DOMAIN.conf" || echo "无 nginx 配置"

echo ""
echo "=== Nginx error log ==="
tail -20 "/www/wwwlogs/$DOMAIN.error.log" 2>/dev/null || echo "无错误日志"
