#!/bin/bash
# ============================================================
# 宝塔 nginx 反代配置脚本
# 用于配置 api.classicalab.cn 指向后端 Node 服务
#
# 用法：
#   bash scripts/baota-nginx-proxy-setup.sh                 # 只生成配置到 /tmp，打印应用步骤
#   bash scripts/baota-nginx-proxy-setup.sh --yes           # 生成并直接应用（备份旧配置 + nginx -t + reload）
#   DOMAIN=api.example.com BACKEND_PORT=3000 bash scripts/baota-nginx-proxy-setup.sh --yes
#
# 说明：
#   - client_max_body_size 全局 1m，仅 /api/ 放宽到 210m（支持 200MB 上传）
#   - nginx 不再添加任何 CORS 头（不回显 $http_origin），CORS 由 Express 统一处理
#   - HTTP 一律 301 到 HTTPS（证书不存在时临时保留 HTTP 反代并告警）
# ============================================================

set -euo pipefail

DOMAIN="${DOMAIN:-api.classicalab.cn}"
BACKEND_PORT="${BACKEND_PORT:-3000}"
SSL_EMAIL="${SSL_EMAIL:-admin@classicalab.cn}"
APPLY=0

usage() {
  cat <<'USAGE'
用法: baota-nginx-proxy-setup.sh [选项]

  --yes                生成后直接应用配置（备份 + nginx -t + reload）
  --domain <domain>    站点域名（默认 api.classicalab.cn）
  --backend-port <n>   后端端口（默认 3000）
  --email <email>      Let's Encrypt 邮箱（仅提示用）
  -h, --help           显示帮助
USAGE
}

while [ $# -gt 0 ]; do
  case "$1" in
    --yes|-y)
      APPLY=1
      shift
      ;;
    --domain)
      [ $# -ge 2 ] || { echo "ERROR: --domain 缺少参数值" >&2; exit 1; }
      DOMAIN="$2"
      shift 2
      ;;
    --backend-port)
      [ $# -ge 2 ] || { echo "ERROR: --backend-port 缺少参数值" >&2; exit 1; }
      BACKEND_PORT="$2"
      shift 2
      ;;
    --email)
      [ $# -ge 2 ] || { echo "ERROR: --email 缺少参数值" >&2; exit 1; }
      SSL_EMAIL="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: 未知参数: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if ! [[ "$BACKEND_PORT" =~ ^[0-9]+$ ]]; then
  echo "ERROR: BACKEND_PORT 必须是数字: $BACKEND_PORT" >&2
  exit 1
fi
if ! [[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]]; then
  echo "ERROR: 域名格式不合法: $DOMAIN" >&2
  exit 1
fi

echo "=== 宝塔 nginx 反代配置脚本 ==="
echo "域名: $DOMAIN  后端: 127.0.0.1:$BACKEND_PORT  应用: $APPLY"
echo ""

# 检查是否在宝塔环境
if [ ! -d "/www/server/panel" ]; then
  echo "错误：未检测到宝塔面板，请确保在宝塔服务器上运行此脚本" >&2
  exit 1
fi

NGINX_CONF="/www/server/panel/vhost/nginx/${DOMAIN}.conf"
CERT_DIR="/www/server/panel/vhost/cert/${DOMAIN}"
HAS_CERT=0
if [ -f "$CERT_DIR/fullchain.pem" ] && [ -f "$CERT_DIR/privkey.pem" ]; then
  HAS_CERT=1
fi

NGINX_BIN="${NGINX_BIN:-}"
if [ -z "$NGINX_BIN" ]; then
  if [ -x /www/server/nginx/sbin/nginx ]; then
    NGINX_BIN=/www/server/nginx/sbin/nginx
  elif command -v nginx >/dev/null 2>&1; then
    NGINX_BIN="$(command -v nginx)"
  fi
fi

if [ "$APPLY" -eq 1 ] && [ -z "$NGINX_BIN" ]; then
  echo "ERROR: 未找到 nginx 可执行文件，无法应用配置" >&2
  exit 1
fi

TMP_CONF="$(mktemp /tmp/${DOMAIN}.conf.XXXXXX)"

cat > "$TMP_CONF" <<'NGINX_EOF'
# __DOMAIN__ 反向代理配置
# 由 scripts/baota-nginx-proxy-setup.sh 自动生成
# CORS 交给 Express 处理：这里不添加/不回显任何 Access-Control-* 头

server {
    listen 80;
    listen [::]:80;
    server_name __DOMAIN__;

    # 全局请求体上限 1m；只有 /api/ 放宽（见下方 location）
    client_max_body_size 1m;

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name __DOMAIN__;

    ssl_certificate __CERT_DIR__/fullchain.pem;
    ssl_certificate_key __CERT_DIR__/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 安全响应头（HSTS 只在 HTTPS 上有意义）
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; img-src 'self' data: https:; media-src 'self' https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https:" always;

    access_log /www/wwwlogs/__DOMAIN__.log;
    error_log /www/wwwlogs/__DOMAIN__.error.log;

    # 上传接口：单独放宽到 210m（前端限制 200MB，留出 multipart 开销）
    location /api/ {
        client_max_body_size 210m;

        proxy_pass http://127.0.0.1:__BACKEND_PORT__;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        proxy_connect_timeout 60s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }

    # 其余路径保持 1m 上限
    location / {
        proxy_pass http://127.0.0.1:__BACKEND_PORT__;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 30s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
NGINX_EOF

if [ "$HAS_CERT" -eq 1 ]; then
  sed -i "s#__DOMAIN__#${DOMAIN}#g; s#__BACKEND_PORT__#${BACKEND_PORT}#g; s#__CERT_DIR__#${CERT_DIR}#g" "$TMP_CONF"
else
  # 证书还没申请：临时生成 HTTP 反代配置，避免 nginx -t 因缺证书失败
  cat > "$TMP_CONF" <<'HTTP_ONLY_EOF'
# __DOMAIN__ 反向代理（临时 HTTP 配置，尚未申请 SSL 证书）
# 证书就绪后请重新运行本脚本加 --yes，切换为 HTTP->HTTPS 301 + HTTPS 反代
# CORS 交给 Express 处理：这里不添加/不回显任何 Access-Control-* 头

server {
    listen 80;
    listen [::]:80;
    server_name __DOMAIN__;

    client_max_body_size 1m;

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    access_log /www/wwwlogs/__DOMAIN__.log;
    error_log /www/wwwlogs/__DOMAIN__.error.log;

    location /api/ {
        client_max_body_size 210m;
        proxy_pass http://127.0.0.1:__BACKEND_PORT__;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }

    location / {
        proxy_pass http://127.0.0.1:__BACKEND_PORT__;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 30s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
HTTP_ONLY_EOF
  sed -i "s#__DOMAIN__#${DOMAIN}#g; s#__BACKEND_PORT__#${BACKEND_PORT}#g" "$TMP_CONF"
  echo "WARNING: 未找到 $CERT_DIR 下的证书，已生成临时 HTTP 配置（无 301）。"
  echo "         请先在宝塔为 $DOMAIN 申请 Let's Encrypt 证书（邮箱 $SSL_EMAIL），再重跑本脚本 --yes。"
fi

echo "已生成 nginx 配置文件: $TMP_CONF"
echo ""

if [ "$APPLY" -eq 1 ]; then
  if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: --yes 应用配置需要 root 权限" >&2
    exit 1
  fi

  mkdir -p "$(dirname "$NGINX_CONF")"
  if [ -f "$NGINX_CONF" ]; then
    BAK="${NGINX_CONF}.bak-$(date +%Y%m%d%H%M%S)"
    cp -p "$NGINX_CONF" "$BAK"
    echo "已备份旧配置: $BAK"
  fi
  cp "$TMP_CONF" "$NGINX_CONF"
  echo "已写入: $NGINX_CONF"

  "$NGINX_BIN" -t
  "$NGINX_BIN" -s reload
  echo "nginx 配置已重载"
else
  echo "未指定 --yes，仅生成配置。应用方式："
  echo ""
  echo "  # 1. 备份原配置"
  echo "  cp \"$NGINX_CONF\" \"${NGINX_CONF}.bak\""
  echo ""
  echo "  # 2. 复制新配置"
  echo "  cp \"$TMP_CONF\" \"$NGINX_CONF\""
  echo ""
  echo "  # 3. 测试并重载"
  echo "  ${NGINX_BIN:-nginx} -t && ${NGINX_BIN:-nginx} -s reload"
  echo ""
fi

echo "=== 后续检查 ==="
echo "1. 后端 PM2 进程已在运行（进程名：wenyan-backend）"
echo "2. DNS 已将 $DOMAIN 解析到本服务器"
echo "3. 防火墙开放 80/443"
echo "4. 验证：curl https://$DOMAIN/api/health"
