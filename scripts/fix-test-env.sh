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
echo "=== 3. 后端目录结构 ==="
ls -la "$BACKEND_PATH/" 2>&1 || echo "后端目录不存在"

echo ""
echo "=== 4. 检查 .env 文件 ==="
if [ -f "$BACKEND_PATH/.env" ]; then
    cat "$BACKEND_PATH/.env"
else
    echo ".env 文件不存在，创建中..."
    echo "PORT=3001" > "$BACKEND_PATH/.env"
    echo "CORS_ORIGIN=https://test.classicalab.cn,http://test.classicalab.cn" >> "$BACKEND_PATH/.env"
    echo "AUTH_SECRET=wenyan-test-secret-2024" >> "$BACKEND_PATH/.env"
    echo "已创建 .env 文件"
    cat "$BACKEND_PATH/.env"
fi

echo ""
echo "=== 5. 检查 node_modules ==="
if [ -d "$BACKEND_PATH/node_modules" ]; then
    echo "node_modules 存在"
    if [ -f "$BACKEND_PATH/node_modules/dotenv/package.json" ]; then
        echo "dotenv 已安装"
    else
        echo "dotenv 未安装！"
    fi
else
    echo "node_modules 不存在"
fi

echo ""
echo "=== 6. 重新安装依赖 ==="
cd "$BACKEND_PATH"
npm ci --production 2>&1 | tail -10

echo ""
echo "=== 7. 删除旧 PM2 进程 ==="
pm2 delete wenyan-backend-test 2>&1 || true

echo ""
echo "=== 8. 启动后端服务 ==="
cd "$PROJECT_PATH"
pm2 start backend/server.js --name wenyan-backend-test 2>&1

echo ""
echo "=== 9. 等待服务启动 (3s) ==="
sleep 3

echo ""
echo "=== 10. PM2 状态 ==="
pm2 status

echo ""
echo "=== 11. PM2 错误日志 ==="
pm2 logs wenyan-backend-test --nostream --lines 30 2>&1 || echo "无法获取日志"

echo ""
echo "=== 12. 本地测试后端 API ==="
curl -s -w "\nHTTP状态码: %{http_code}\n" http://127.0.0.1:3001/api/health 2>&1 || echo "连接失败"

echo ""
echo "=== 13. Nginx 配置测试 ==="
nginx -t 2>&1

echo ""
echo "=== 14. 检查 Nginx 反向代理配置 ==="
cat /www/server/panel/vhost/nginx/test-api.classicalab.cn.conf 2>&1 || echo "Nginx 配置文件不存在"

echo ""
echo "=== 15. 域名反向代理测试 ==="
curl -s -w "\nHTTP状态码: %{http_code}\n" http://test-api.classicalab.cn/api/health 2>&1 || echo "连接失败"

echo ""
echo "========================================"
echo "  后端检查完成"
echo "========================================"
