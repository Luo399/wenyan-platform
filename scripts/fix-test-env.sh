#!/bin/bash

PROJECT_PATH="/www/wwwroot/wenyan-platform-test"
BACKEND_PATH="$PROJECT_PATH/backend"

echo "=== 1. 检查后端服务状态 ==="
pm2 status

echo ""
echo "=== 2. 检查 3001 端口 ==="
ss -tlnp | grep 3001 && echo "端口 3001 正在监听" || echo "端口 3001 未监听"

echo ""
echo "=== 3. 检查后端代码 ==="
ls -la "$BACKEND_PATH/"

echo ""
echo "=== 4. 启动/重启测试后端 ==="
cd "$PROJECT_PATH"

if [ ! -f backend/.env ]; then
    echo "创建 .env 文件..."
    cat > backend/.env << 'EOF'
PORT=3001
CORS_ORIGIN=https://test.classicalab.cn
AUTH_SECRET=wenyan-test-secret-2024
EOF
fi

cd backend
npm ci --production 2>&1 | tail -3

if pm2 describe wenyan-backend-test > /dev/null 2>&1; then
    echo "重启 wenyan-backend-test..."
    pm2 restart wenyan-backend-test --update-env
else
    echo "启动 wenyan-backend-test..."
    cd ..
    pm2 start backend/server.js --name wenyan-backend-test
fi

sleep 2

echo ""
echo "=== 5. 验证后端服务 ==="
curl -s -o /dev/null -w "HTTP状态码: %{http_code}\n" http://127.0.0.1:3001/api/health 2>/dev/null || echo "无法连接后端"

echo ""
echo "=== 6. 验证 Nginx 配置 ==="
nginx -t 2>&1

echo ""
echo "=== 7. 测试域名访问 ==="
curl -s -o /dev/null -w "HTTP状态码: %{http_code}\n" http://test-api.classicalab.cn/api/health 2>/dev/null || echo "无法连接"

echo ""
echo "检查完成！"
