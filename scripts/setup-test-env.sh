#!/usr/bin/env bash
set -euo pipefail

if [ -z "${SERVER_PROJECT_PATH:-}" ]; then
    echo "ERROR: SERVER_PROJECT_PATH not set"
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

cat > "$TEST_PATH/backend/.env" << 'EOF'
PORT=3001
CORS_ORIGIN=https://test.classicalab.cn
AUTH_SECRET=test-secret-key-change-in-production
EOF

echo "测试环境配置完成"
echo ""
echo "=== 启动测试后端 ==="

cd "$TEST_PATH/backend"
npm ci --production

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