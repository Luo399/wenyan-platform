#!/bin/bash
# ============================================================
# 宝塔 nginx 反代配置脚本
# 用于配置 api.classicalab.cn 指向后端 Node 服务
# ============================================================

set -e

# 配置变量（请根据实际情况修改）
DOMAIN="api.classicalab.cn"
BACKEND_PORT="3000"
SSL_EMAIL="admin@classicalab.cn"  # Let's Encrypt 证书邮箱

echo "=== 宝塔 nginx 反代配置脚本 ==="
echo ""
echo "此脚本将帮助你在宝塔面板配置以下内容："
echo "1. 添加 api.classicalab.cn 站点"
echo "2. 配置 nginx 反向代理到 localhost:3000"
echo "3. 申请 Let's Encrypt SSL 证书"
echo ""

# 检查是否在宝塔环境
if [ ! -d "/www/server/panel" ]; then
    echo "错误：未检测到宝塔面板，请确保在宝塔服务器上运行此脚本"
    exit 1
fi

echo "=== 步骤 1：创建站点 ==="
echo ""
echo "请在宝塔面板执行以下操作："
echo "1. 登录宝塔面板"
echo "2. 点击左侧「网站」"
echo "3. 点击「添加站点」"
echo "4. 填写以下信息："
echo "   - 域名：api.classicalab.cn"
echo "   - 根目录：/www/wwwroot/api.classicalab.cn"
echo "   - PHP版本：纯静态"
echo "   - 数据库：不创建"
echo "5. 点击「提交」创建站点"
echo ""
read -p "已完成站点创建？按 Enter 继续..."

echo ""
echo "=== 步骤 2：配置反向代理 ==="
echo ""

# 创建 nginx 配置文件
NGINX_CONF="/www/server/panel/vhost/nginx/api.classicalab.cn.conf"

cat > /tmp/api_classicalab_cn.conf << 'NGINX_EOF'
# api.classicalab.cn 反向代理配置
# 由脚本自动生成，请勿手动修改

server {
    listen 80;
    server_name api.classicalab.cn;
    
    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # CORS 预检请求处理
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' $http_origin always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;
        add_header 'Access-Control-Max-Age' 86400 always;
        add_header 'Content-Length' 0;
        add_header 'Content-Type' 'text/plain charset=UTF-8';
        return 204;
    }
    
    # 反向代理到 Node 后端
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超时配置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # 请求体大小限制
        client_max_body_size 1m;
    }
    
    # 健康检查端点（不需要鉴权）
    location /api/health {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        access_log off;
    }
    
    # 日志配置
    access_log /www/wwwlogs/api.classicalab.cn.log;
    error_log /www/wwwlogs/api.classicalab.cn.error.log;
}

# HTTPS 配置（SSL 证书申请成功后启用）
# server {
#     listen 443 ssl http2;
#     server_name api.classicalab.cn;
#     
#     ssl_certificate /www/server/panel/vhost/cert/api.classicalab.cn/fullchain.pem;
#     ssl_certificate_key /www/server/panel/vhost/cert/api.classicalab.cn/privkey.pem;
#     ssl_protocols TLSv1.2 TLSv1.3;
#     ssl_ciphers HIGH:!aNULL:!MD5;
#     ssl_prefer_server_ciphers on;
#     ssl_session_cache shared:SSL:10m;
#     ssl_session_timeout 10m;
#     
#     # HSTS
#     add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
#     
#     # 其他配置同上...
# }
NGINX_EOF

echo "已生成 nginx 配置文件: /tmp/api_classicalab_cn.conf"
echo ""
echo "请执行以下命令应用配置："
echo ""
echo "  # 1. 备份原配置"
echo "  cp $NGINX_CONF ${NGINX_CONF}.bak"
echo ""
echo "  # 2. 复制新配置"
echo "  cp /tmp/api_classicalab_cn.conf $NGINX_CONF"
echo ""
echo "  # 3. 测试 nginx 配置"
echo "  nginx -t"
echo ""
echo "  # 4. 重载 nginx"
echo "  nginx -s reload"
echo ""

read -p "已执行上述命令？按 Enter 继续..."

echo ""
echo "=== 步骤 3：申请 SSL 证书 ==="
echo ""
echo "在宝塔面板执行："
echo "1. 点击「网站」→ 找到 api.classicalab.cn → 点击「设置」"
echo "2. 点击左侧「SSL」"
echo "3. 点击「Let's Encrypt」"
echo "4. 填写邮箱：$SSL_EMAIL"
echo "5. 点击「申请」"
echo ""
echo "申请成功后，宝塔会自动配置 HTTPS。"
echo ""

read -p "SSL 证书申请完成？按 Enter 继续..."

echo ""
echo "=== 步骤 4：验证配置 ==="
echo ""
echo "执行以下命令验证："
echo ""
echo "  # 1. 检查 DNS 解析"
echo "  nslookup api.classicalab.cn"
echo ""
echo "  # 2. 测试健康检查端点"
echo "  curl http://api.classicalab.cn/api/health"
echo ""
echo "  # 3. 测试 HTTPS（SSL 申请成功后）"
echo "  curl https://api.classicalab.cn/api/health"
echo ""

echo "=== 配置完成 ==="
echo ""
echo "api.classicalab.cn 已成功配置反向代理到 localhost:3000"
echo "请确保："
echo "1. 后端 Node 服务已在 PM2 中启动（进程名：wenyan-backend）"
echo "2. DNS 已正确解析到本服务器 IP"
echo "3. 防火墙已开放 80 和 443 端口"