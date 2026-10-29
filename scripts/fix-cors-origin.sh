#!/bin/bash
# 修复 CORS_ORIGIN 中的反引号
# 用法：在 backend 目录执行 bash scripts/fix-cors-origin.sh [env 文件路径]，默认 ./.env
set -euo pipefail

ENV_FILE="${1:-.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: 找不到 env 文件: $ENV_FILE" >&2
  echo "用法: $0 [env 文件路径]" >&2
  exit 1
fi

sed -i 's/CORS_ORIGIN=`\(.*\)`/CORS_ORIGIN=\1/' "$ENV_FILE"

# 验证
if grep -q '^CORS_ORIGIN=`' "$ENV_FILE"; then
    echo "错误：反引号仍然存在"
    grep "CORS_ORIGIN" "$ENV_FILE"
    exit 1
else
    echo "修复成功："
    grep "CORS_ORIGIN" "$ENV_FILE"
fi
