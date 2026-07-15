#!/bin/bash
# 修复后端依赖并启动
set -e

cd /www/wwwroot/api.classicalab.cn/backend

# 1. 使用 npm install 同步依赖（解决 lock 文件不同步）
echo "=== 安装依赖 ==="
npm install --omit=dev

# 2. 验证 server.js 有 health 端点
echo ""
echo "=== 检查 health 端点 ==="
if grep -q "/api/health" server.js; then
    echo "health 端点存在"
else
    echo "错误：server.js 中没有 health 端点"
    echo "当前 server.js 大小：$(wc -l < server.js) 行"
    echo "请检查代码版本"
    exit 1
fi

# 3. 检查 PM2 进程
echo ""
echo "=== 检查 PM2 进程 ==="
pm2 list

# 4. 重启服务
echo ""
echo "=== 重启服务 ==="
pm2 reload wenyan-backend --update-env || pm2 start server.js --name wenyan-backend

# 5. 等待并验证
echo ""
echo "=== 等待服务启动 ==="
sleep 3
pm2 status

# 6. 测试 health 端点
echo ""
echo "=== 测试 health 端点 ==="
curl -v https://api.classicalab.cn/api/health 2>&1 | head -20