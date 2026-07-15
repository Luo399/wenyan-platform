#!/bin/bash

PROJECT_PATH="/www/wwwroot/wenyan-platform-test"
BACKEND_PATH="$PROJECT_PATH/backend"

echo "========================================"
echo "  测试环境诊断与修复脚本"
echo "========================================"

echo ""
echo "=== 1. PM2 进程状态 ==="
pm2 status

echo ""
echo "=== 2. 端口监听检查 ==="
ss -tlnp | grep -E ':(3000|3001)\s' || echo "3000/3001 端口均未监听"

echo ""
echo "=== 3. 创建/修复 .env 文件 ==="
cat > "$BACKEND_PATH/.env" << 'EOF'
PORT=3001
CORS_ORIGIN=http://test.classicalab.cn,https://test.classicalab.cn
AUTH_SECRET=wenyan-test-secret-2024
EOF
echo "已创建 .env 文件:"
cat "$BACKEND_PATH/.env"

echo ""
echo "=== 4. 删除旧 PM2 进程 ==="
pm2 delete wenyan-backend-test 2>&1 || true

echo ""
echo "=== 5. 重新安装依赖 ==="
cd "$BACKEND_PATH"
rm -rf node_modules package-lock.json
npm install --production 2>&1 | tail -5

echo ""
echo "=== 6. 启动后端服务（从 backend 目录）==="
pm2 start server.js --name wenyan-backend-test

echo ""
echo "=== 7. 等待服务启动 (3s) ==="
sleep 3

echo ""
echo "=== 8. PM2 状态 ==="
pm2 status

echo ""
echo "=== 9. 本地测试后端 API ==="
curl -s -w "\nHTTP状态码: %{http_code}\n" http://127.0.0.1:3001/api/health 2>&1 || echo "连接失败"

echo ""
echo "=== 10. 域名反向代理测试 ==="
curl -s -w "\nHTTP状态码: %{http_code}\n" http://test-api.classicalab.cn/api/health 2>&1 || echo "连接失败"

echo ""
echo "========================================"
echo "  后端检查完成"
echo "========================================"
