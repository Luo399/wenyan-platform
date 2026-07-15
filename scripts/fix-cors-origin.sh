#!/bin/bash
# 修复 CORS_ORIGIN 中的反引号

sed -i 's/CORS_ORIGIN=`\(.*\)`/CORS_ORIGIN=\1/' .env

# 验证
if grep -q '^CORS_ORIGIN=`' .env; then
    echo "错误：反引号仍然存在"
    cat .env | grep "CORS_ORIGIN"
    exit 1
else
    echo "修复成功："
    cat .env | grep "CORS_ORIGIN"
fi