#!/bin/bash
# ============================================================
# HMAC 鉴权密钥生成脚本
# 用于生成前后端共享的 AUTH_SECRET
# ============================================================

set -e

echo "=== HMAC 鉴权密钥生成脚本 ==="
echo ""

# 生成 256 位（32 字节）的十六进制密钥
AUTH_SECRET=$(openssl rand -hex 32)

echo "已生成新的 AUTH_SECRET："
echo ""
echo "$AUTH_SECRET"
echo ""

echo "请将此密钥配置到以下位置："
echo ""
echo "【后端】/www/wwwroot/wenyan-platform/backend/.env"
echo "AUTH_SECRET=$AUTH_SECRET"
echo ""
echo "【前端构建时】GitHub Actions Secrets"
echo "VITE_AUTH_SECRET=$AUTH_SECRET"
echo ""
echo "【本地开发】.env.development"
echo "VITE_AUTH_SECRET=$AUTH_SECRET"
echo ""

echo "注意："
echo "1. 此密钥必须前后端保持一致"
echo "2. 不要将密钥提交到 git 仓库"
echo "3. 更换密钥后需要重启后端服务：pm2 reload wenyan-backend --update-env"
echo ""

# 验证密钥格式
if [[ ! "$AUTH_SECRET" =~ ^[a-f0-9]{64}$ ]]; then
    echo "警告：生成的密钥格式异常，请重新运行脚本"
    exit 1
fi

echo "密钥格式验证通过（64 位十六进制）"