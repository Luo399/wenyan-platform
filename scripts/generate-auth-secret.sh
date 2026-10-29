#!/usr/bin/env bash
#
# generate-auth-secret.sh —— 生成后端 JWT 密钥
#
# 鉴权使用 JWT Bearer token，服务端密钥只存在于后端。
# 本脚本只生成 JWT_SECRET，写入服务器上的 backend/.env。
#
# 用法：
#   bash scripts/generate-auth-secret.sh
#   JWT_EXPIRES_IN=12h bash scripts/generate-auth-secret.sh   # 仅影响提示文本

set -euo pipefail

if ! command -v openssl >/dev/null 2>&1; then
  echo "ERROR: 未找到 openssl，请先安装后再运行本脚本" >&2
  exit 1
fi

JWT_EXPIRES_IN="${JWT_EXPIRES_IN:-12h}"

echo "=== JWT 密钥生成脚本 ==="
echo ""

# 生成 256 位（32 字节）的十六进制密钥
JWT_SECRET="$(openssl rand -hex 32)"

# 输出前先校验格式，避免把异常值贴进 .env
if [[ ! "$JWT_SECRET" =~ ^[a-f0-9]{64}$ ]]; then
  echo "ERROR: 生成的密钥格式异常（应为 64 位十六进制），请重新运行" >&2
  exit 1
fi

echo "已生成新的 JWT_SECRET："
echo ""
echo "$JWT_SECRET"
echo ""
echo "请写入后端 .env（例如服务器 /www/wwwroot/<项目目录>/backend/.env，禁止提交 git）："
echo ""
echo "JWT_SECRET=$JWT_SECRET"
echo "JWT_EXPIRES_IN=$JWT_EXPIRES_IN"
echo ""
echo "注意："
echo "1. 该密钥只属于后端；前端构建不需要、也不允许持有它"
echo "2. 修改密钥会让所有已签发的登录 token 立即失效"
echo "3. 写入后重启后端：pm2 reload wenyan-backend --update-env"
echo "4. 不要将密钥粘贴到聊天、工单或任何会入库的文档里"
echo ""
echo "密钥格式校验通过（64 位十六进制）"
