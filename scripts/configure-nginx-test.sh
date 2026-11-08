#!/bin/bash
# 配置测试环境 nginx 反代 + Let's Encrypt 证书
# 由 deploy-backend-test.yml 通过 scp 上传后执行；也可手动运行。
set -euo pipefail

VHOST_DIR="${VHOST_DIR:-/www/server/panel/vhost/nginx}"
DOMAIN="${DOMAIN:-test-api.classicalab.cn}"
SITE_DIR="${SITE_DIR:-/www/wwwroot/$DOMAIN}"
BACKEND_PORT="${BACKEND_PORT:-3001}"
SSL_EMAIL="${SSL_EMAIL:-admin@classicalab.cn}"
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"

if ! [[ "$BACKEND_PORT" =~ ^[0-9]+$ ]]; then
  echo "ERROR: BACKEND_PORT 必须是数字: $BACKEND_PORT" >&2
  exit 1
fi

NGINX_BIN="${NGINX_BIN:-}"
if [ -z "$NGINX_BIN" ]; then
  if [ -x /www/server/nginx/sbin/nginx ]; then
    NGINX_BIN=/www/server/nginx/sbin/nginx
  elif command -v nginx >/dev/null 2>&1; then
    NGINX_BIN="$(command -v nginx)"
  fi
fi
if [ -z "$NGINX_BIN" ]; then
  echo "ERROR: 未找到 nginx" >&2
  exit 1
fi

mkdir -p "$SITE_DIR"

# 安装 certbot（如未安装）
if ! command -v certbot &>/dev/null; then
  echo "Installing certbot..."
  if command -v dnf &>/dev/null; then
    dnf install -y epel-release || echo "WARNING: 安装 epel-release 失败，继续尝试"
    dnf install -y certbot || echo "WARNING: 安装 certbot 失败"
  elif command -v apt &>/dev/null; then
    apt-get update -y || echo "WARNING: apt-get update 失败，继续尝试"
    apt-get install -y certbot || echo "WARNING: 安装 certbot 失败"
  else
    echo "WARNING: Cannot install certbot, please install manually"
  fi
fi

# 申请 SSL 证书（如果尚未存在）
if [ ! -d "$CERT_DIR" ]; then
  echo "Obtaining SSL certificate for $DOMAIN..."
  # 临时停止 nginx 以便 certbot standalone 模式绑定 80 端口
  systemctl stop nginx 2>/dev/null || "$NGINX_BIN" -s stop 2>/dev/null || true
  certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos \
    --email "$SSL_EMAIL" || echo "WARNING: certbot 申请证书失败，请检查 DNS/80 端口"
  systemctl start nginx 2>/dev/null || "$NGINX_BIN" 2>/dev/null || true
fi

if [ ! -f "$CERT_DIR/fullchain.pem" ] || [ ! -f "$CERT_DIR/privkey.pem" ]; then
  echo "ERROR: 证书不存在: $CERT_DIR，终止写入 nginx 配置" >&2
  exit 1
fi

# 写入 nginx 配置（含 SSL）
TMP_CONF="$(mktemp /tmp/${DOMAIN}.conf.XXXXXX)"
cat > "$TMP_CONF" <<'NGINXEOF'
server {
    listen 80;
    listen [::]:80;
    server_name __DOMAIN__;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name __DOMAIN__;
    root __SITE_DIR__;
    index index.html index.htm;

    ssl_certificate __CERT_DIR__/fullchain.pem;
    ssl_certificate_key __CERT_DIR__/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://127.0.0.1:__BACKEND_PORT__;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 30s;
        proxy_read_timeout 30s;
        proxy_send_timeout 30s;
    }

    access_log /www/wwwlogs/__DOMAIN__.log;
    error_log /www/wwwlogs/__DOMAIN__.error.log;
}
NGINXEOF

sed -i "s#__DOMAIN__#${DOMAIN}#g; s#__SITE_DIR__#${SITE_DIR}#g; s#__CERT_DIR__#${CERT_DIR}#g; s#__BACKEND_PORT__#${BACKEND_PORT}#g" "$TMP_CONF"

mkdir -p "$VHOST_DIR"
if [ -f "$VHOST_DIR/$DOMAIN.conf" ]; then
  cp -p "$VHOST_DIR/$DOMAIN.conf" "$VHOST_DIR/$DOMAIN.conf.bak-$(date +%Y%m%d%H%M%S)"
fi
install -m 644 "$TMP_CONF" "$VHOST_DIR/$DOMAIN.conf"
rm -f "$TMP_CONF"

"$NGINX_BIN" -t
"$NGINX_BIN" -s reload
echo "Nginx proxy configured for $DOMAIN with HTTPS"

# 设置证书自动续期
if [ -d /etc/cron.d ] || mkdir -p /etc/cron.d 2>/dev/null; then
  echo "0 3 * * * root certbot renew --quiet --post-hook '$NGINX_BIN -s reload'" > /etc/cron.d/certbot-test-api
  echo "已写入证书续期 cron"
fi
