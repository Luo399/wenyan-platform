#!/bin/bash

VHOST_DIR="/www/server/panel/vhost/nginx"
SITE_DIR="/www/wwwroot/test-api.classicalab.cn"
DOMAIN="test-api.classicalab.cn"

mkdir -p "$SITE_DIR"

# 安装 certbot（如未安装）
if ! command -v certbot &>/dev/null; then
  echo "Installing certbot..."
  if command -v dnf &>/dev/null; then
    dnf install -y epel-release
    dnf install -y certbot
  elif command -v apt &>/dev/null; then
    apt-get update -y
    apt-get install -y certbot
  else
    echo "WARNING: Cannot install certbot, please install manually"
  fi
fi

# 申请 SSL 证书（如果尚未存在）
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  echo "Obtaining SSL certificate for $DOMAIN..."
  # 临时停止 nginx 以便 certbot standalone 模式绑定 80 端口
  systemctl stop nginx 2>/dev/null || nginx -s stop 2>/dev/null || true
  certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos \
    --email "admin@classicalab.cn" || true
  systemctl start nginx 2>/dev/null || nginx 2>/dev/null || true
fi

# 写入 nginx 配置（含 SSL）
cat > "$VHOST_DIR/$DOMAIN.conf" << 'NGINXEOF'
server {
    listen 80;
    listen [::]:80;
    server_name test-api.classicalab.cn;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name test-api.classicalab.cn;
    root /www/wwwroot/test-api.classicalab.cn;
    index index.html index.htm;

    ssl_certificate /etc/letsencrypt/live/test-api.classicalab.cn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/test-api.classicalab.cn/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 30s;
        proxy_read_timeout 30s;
        proxy_send_timeout 30s;
    }

    access_log /www/wwwlogs/test-api.classicalab.cn.log;
    error_log /www/wwwlogs/test-api.classicalab.cn.error.log;
}
NGINXEOF

nginx -t && nginx -s reload
echo "Nginx proxy configured for $DOMAIN with HTTPS"

# 设置证书自动续期
echo "0 3 * * * root certbot renew --quiet --post-hook 'nginx -s reload'" > /etc/cron.d/certbot-test-api