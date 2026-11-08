#!/usr/bin/env bash
#
# upload-data-oss.sh —— 极简 OSS 数据上传（ossutil CLI）
#
# 用法（msys64 / Git Bash / Linux 都可跑）：
#   ./scripts/upload-data-oss.sh test --region oss-cn-guangzhou
#   ./scripts/upload-data-oss.sh prod --region oss-cn-zhongwei --yes
#   ./scripts/upload-data-oss.sh test data --region oss-cn-guangzhou
#   ./scripts/upload-data-oss.sh test all --region oss-cn-guangzhou --dry
#
# 参数：
#   test|prod             必填，目标环境（prod 必须额外加 --yes）
#   all|data|images|video|audio   可选，默认 all
#   --region <region>     必填（或用环境变量 OSS_REGION），不设默认值
#   --endpoint <endpoint> 可选，默认 <region>.aliyuncs.com
#   --dry                 预览模式（不上传）
#   --yes                 确认对生产桶执行上传
#
# 凭证（二选一，禁止把 AK/SK 放到命令行参数里）：
#   a) 环境变量 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET
#   b) ossutil 配置文件（默认 ~/.ossutilconfig，可用 OSSUTIL_CONFIG_FILE 覆盖）
#
# ossutil 自动下载固定版本 1.7.18；如提供 OSSUTIL_SHA256 会强制校验，
# 校验不通过立即退出；未提供时退化为「版本号校验」，同样失败即退出。

set -euo pipefail

OSSUTIL_VERSION="1.7.18"
OSSUTIL_BASE_URL="https://gosspublic.alicdn.com/ossutil/${OSSUTIL_VERSION}/ossutil64"

usage() {
  cat <<'USAGE'
用法: upload-data-oss.sh {test|prod} [all|data|images|video|audio] --region <region> [选项]

  test|prod                    目标环境（prod 必须加 --yes）
  all|data|images|video|audio  上传范围，默认 all

选项:
  --region <region>     桶所在 region，如 oss-cn-zhongwei（必填）
  --endpoint <endpoint> 自定义 endpoint，默认 <region>.aliyuncs.com
  --dry                 预览模式，不上传
  --yes                 生产环境上传确认
  -h, --help            显示帮助

凭证:
  OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET 环境变量，
  或 ossutil 配置文件（OSSUTIL_CONFIG_FILE，默认 ~/.ossutilconfig）
USAGE
}

ENV_ARG=""
ONLY="all"
DRY=0
YES=0
REGION="${OSS_REGION:-}"
ENDPOINT="${OSS_ENDPOINT:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    test|prod)
      ENV_ARG="$1"
      shift
      ;;
    all|data|images|video|audio)
      ONLY="$1"
      shift
      ;;
    --region)
      [[ $# -ge 2 ]] || { echo "ERROR: --region 缺少参数值" >&2; exit 1; }
      REGION="$2"
      shift 2
      ;;
    --region=*)
      REGION="${1#*=}"
      shift
      ;;
    --endpoint)
      [[ $# -ge 2 ]] || { echo "ERROR: --endpoint 缺少参数值" >&2; exit 1; }
      ENDPOINT="$2"
      shift 2
      ;;
    --endpoint=*)
      ENDPOINT="${1#*=}"
      shift
      ;;
    --dry|--dry-run)
      DRY=1
      shift
      ;;
    --yes|-y)
      YES=1
      shift
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

if [[ -z "$ENV_ARG" ]]; then
  usage
  exit 1
fi

if [[ -z "$REGION" ]]; then
  echo "ERROR: 必须通过 --region 或环境变量 OSS_REGION 指定桶所在 region（例如 oss-cn-zhongwei）。" >&2
  echo "       脚本不再提供默认 region：默认值曾与生产桶不一致，导致上传失败/绕路。" >&2
  exit 1
fi

# 兼容误传完整 endpoint 的情况
REGION="${REGION#http://}"
REGION="${REGION#https://}"
REGION="${REGION%%.aliyuncs.com*}"
if [[ ! "$REGION" =~ ^oss-[a-z0-9-]+$ ]]; then
  echo "ERROR: region 格式不合法: $REGION（示例: oss-cn-zhongwei）" >&2
  exit 1
fi

ENDPOINT="${ENDPOINT:-${REGION}.aliyuncs.com}"
ENDPOINT="${ENDPOINT#http://}"
ENDPOINT="${ENDPOINT#https://}"

case "$ENV_ARG" in
  test) BUCKET="${OSS_BUCKET_TEST:-wenyan-test-online}" ;;
  prod) BUCKET="${OSS_BUCKET_PROD:-classic-chinese}" ;;
esac

if [[ "$ENV_ARG" == "prod" && "$YES" -ne 1 ]]; then
  echo "ERROR: 生产桶上传必须显式加 --yes（当前为误触保护）。" >&2
  echo "       确认要覆盖生产数据后重新执行：$0 prod ... --yes" >&2
  exit 1
fi

# ===== 扫描文件 =====
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC="$ROOT/public"

ALL_SUBDIRS=(data images video audio)
if [[ "$ONLY" == "all" ]]; then
  TARGETS=("${ALL_SUBDIRS[@]}")
else
  TARGETS=("$ONLY")
fi

echo "========================================"
echo "OSS 数据上传 --env $ENV_ARG"
echo "========================================"
echo "Bucket:   $BUCKET ($ENDPOINT)"
echo "目录:     ${TARGETS[*]}"
echo "模式:     $([[ "$DRY" -eq 1 ]] && echo 'DRY-RUN 预览（不上传）' || echo '实际上传')"
echo "========================================"

COUNT=0
for sub in "${TARGETS[@]}"; do
  LOCAL="$PUBLIC/$sub"
  if [[ ! -d "$LOCAL" ]]; then
    echo "WARN: 跳过不存在的目录: public/$sub"
    continue
  fi

  FILES="$(find "$LOCAL" -type f | wc -l | tr -d ' ')"
  if [[ "$FILES" -eq 0 ]]; then
    echo "public/$sub/  (空)"
    continue
  fi
  echo "public/$sub/  ($FILES 个文件)"
  COUNT=$((COUNT + FILES))
done

if [[ "$COUNT" -eq 0 ]]; then
  echo "没有可上传的文件，退出。"
  exit 0
fi

if [[ "$DRY" -eq 1 ]]; then
  echo ""
  echo "DRY-RUN 完成：共 $COUNT 个文件将上传到 oss://$BUCKET/"
  echo "   去掉 --dry 执行实际上传。"
  exit 0
fi

# ===== 以下为实际运行才需要的校验 =====

AK="${OSS_ACCESS_KEY_ID:-}"
SK="${OSS_ACCESS_KEY_SECRET:-}"
CONFIG_FILE="${OSSUTIL_CONFIG_FILE:-$HOME/.ossutilconfig}"
AUTH_MODE=""
if [[ -n "$AK" && -n "$SK" ]]; then
  AUTH_MODE="env"
elif [[ -f "$CONFIG_FILE" ]]; then
  AUTH_MODE="config"
else
  echo "ERROR: 缺少 OSS 凭证。" >&2
  echo "  二选一：" >&2
  echo "  a) export OSS_ACCESS_KEY_ID=... OSS_ACCESS_KEY_SECRET=..." >&2
  echo "  b) 配置 ossutil 配置文件（默认 ~/.ossutilconfig，可用 OSSUTIL_CONFIG_FILE 指定）" >&2
  echo "  不要把 AK/SK 写在命令行参数里（ps / 审计日志可见）。" >&2
  exit 1
fi

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    return 1
  fi
}

download_ossutil() {
  local target="$1"
  local tmp
  tmp="$(mktemp)"

  echo "下载 ossutil ${OSSUTIL_VERSION} ..."
  curl -fsSL -o "$tmp" "$OSSUTIL_BASE_URL"

  if [[ -n "${OSSUTIL_SHA256:-}" ]]; then
    local actual
    if ! actual="$(sha256_of "$tmp")"; then
      rm -f "$tmp"
      echo "ERROR: 设置了 OSSUTIL_SHA256，但系统缺少 sha256sum/shasum，无法校验" >&2
      exit 1
    fi
    if [[ "$actual" != "$OSSUTIL_SHA256" ]]; then
      rm -f "$tmp"
      echo "ERROR: ossutil SHA256 校验失败（期望 $OSSUTIL_SHA256，实际 $actual）" >&2
      exit 1
    fi
    echo "SHA256 校验通过"
  else
    echo "WARN: 未提供 OSSUTIL_SHA256，退化为固定版本号校验；建议设置该变量做完整性校验"
  fi

  chmod +x "$tmp"
  local version_out
  version_out="$("$tmp" --version 2>&1 || true)"
  if ! printf '%s' "$version_out" | grep -q "$OSSUTIL_VERSION"; then
    rm -f "$tmp"
    echo "ERROR: 下载的 ossutil 版本不是 $OSSUTIL_VERSION，已终止" >&2
    exit 1
  fi

  mkdir -p "$(dirname "$target")"
  mv -f "$tmp" "$target"
  chmod +x "$target"
}

# 检查 ossutil 是否可用，没有就下载固定版本
OSSUTIL="$(command -v ossutil64 2>/dev/null || command -v ossutil 2>/dev/null || true)"
if [[ -z "$OSSUTIL" ]]; then
  INSTALL_DIR="${OSSUTIL_INSTALL_DIR:-/usr/local/bin}"
  if ! mkdir -p "$INSTALL_DIR" 2>/dev/null; then
    INSTALL_DIR="$HOME/.local/bin"
    mkdir -p "$INSTALL_DIR"
  fi

  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*)
      OSSUTIL="$INSTALL_DIR/ossutil64"
      ;;
    Linux*|Darwin*)
      OSSUTIL="$INSTALL_DIR/ossutil"
      ;;
    *)
      echo "ERROR: 无法自动安装 ossutil，请手动安装：" >&2
      echo "   https://help.aliyun.com/document_detail/120075.html" >&2
      exit 1
      ;;
  esac
  download_ossutil "$OSSUTIL"
fi

echo ""
COUNT=0
FAIL=0

for sub in "${TARGETS[@]}"; do
  LOCAL="$PUBLIC/$sub"
  [[ ! -d "$LOCAL" ]] && continue
  FILES="$(find "$LOCAL" -type f | wc -l | tr -d ' ')"
  [[ "$FILES" -eq 0 ]] && continue

  echo "上传 public/$sub/ ($FILES 个文件)..."
  # 凭证只通过环境变量或 ossutil 配置文件提供，绝不放到 -i/-k 命令行参数
  upload_cmd=("$OSSUTIL" cp -r "$LOCAL" "oss://$BUCKET/$sub/" --force --acl public-read -e "$ENDPOINT")
  if [[ "$AUTH_MODE" == "config" ]]; then
    upload_cmd+=(--config-file "$CONFIG_FILE")
  fi
  if "${upload_cmd[@]}" >/dev/null 2>&1; then
    COUNT=$((COUNT + FILES))
    echo "   成功"
  else
    FAIL=$((FAIL + 1))
    echo "   失败：public/$sub/"
  fi
done

echo "========================================"
echo "上传完成：成功 $COUNT | 目录失败 $FAIL"
if [[ "$ENV_ARG" == "prod" ]]; then
  echo "   目标 URL: https://www.classicalab.cn"
else
  echo "   目标 URL: https://test.classicalab.cn"
fi
echo "========================================"

[[ "$FAIL" -eq 0 ]]
