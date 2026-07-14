#!/bin/bash

VHOST_DIR="/www/server/panel/vhost/nginx"
SITE_DIR="/www/wwwroot/test-api.classicalab.cn"
DOMAIN="test-api.classicalab.cn"

mkdir -p "$SITE_DIR"

cat > "$VHOST_DIR/$DOMAIN.conf" << 'NGINXEOF'
server {
    listen 80;
    listen [::]:80;
    server_name test-api.classicalab.cn;
    root /www/wwwroot/test-api.classicalab.cn;
    index index.html index.htm;

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
echo "Nginx proxy configured for $DOMAIN"