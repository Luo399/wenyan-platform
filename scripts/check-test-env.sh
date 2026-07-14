#!/bin/bash

echo "=== PM2 进程状态 ==="
pm2 status

echo ""
echo "=== 检查 3001 端口 ==="
netstat -tlnp | grep 3001 || ss -tlnp | grep 3001

echo ""
echo "=== 测试后端本地访问 ==="
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/health 2>/dev/null || echo "无法连接"

echo ""
echo "=== 检查测试项目目录 ==="
ls -la /www/wwwroot/wenyan-platform-test/

echo ""
echo "=== 检查 Nginx 配置 ==="
cat /www/server/panel/vhost/nginx/test-api.classicalab.cn.conf

echo ""
echo "=== Nginx error log ==="
tail -20 /www/wwwlogs/test-api.classicalab.cn.error.log 2>/dev/null || echo "无错误日志"
