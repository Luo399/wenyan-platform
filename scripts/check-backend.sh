#!/bin/bash
# 检查后端进程和代码状态
set -e

cd /www/wwwroot/api.classicalab.cn/backend

echo "=== 1. PM2 进程详情 ==="
pm2 jlist | head -100

echo ""
echo "=== 2. backend 进程配置 ==="
pm2 show backend 2>&1 | head -20

echo ""
echo "=== 3. server.js 大小和健康端点检查 ==="
wc -l server.js
grep -n "health\|/api/" server.js | head -20

echo ""
echo "=== 4. 查看 wenyan-backend 错误日志 ==="
pm2 logs wenyan-backend --lines 20 --nostream 2>&1 | tail -30

echo ""
echo "=== 5. 查看 backend 进程日志 ==="
pm2 logs backend --lines 10 --nostream 2>&1 | tail -20