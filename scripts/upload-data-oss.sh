#!/usr/bin/env bash
#
# upload-data-oss.sh —— 极简 OSS 数据上传（ossutil CLI）
#
# 用法（msys64 / Git Bash 都可跑）：
#   ./scripts/upload-data-oss.sh test             # 全量上传测试桶
#   ./scripts/upload-data-oss.sh prod             # 全量上传生产桶
#   ./scripts/upload-data-oss.sh test data        # 只传 data/
#   ./scripts/upload-data-oss.sh prod images      # 只传 images/
#   ./scripts/upload-data-oss.sh test all --dry   # 预览模式（不上传）
#
# 配置：
#   1. 本脚本从 `~/.wenyan-oss-credentials` 读 AK/SK（格式见下），
#      这个文件只在你自己机器上，绝不进 git
#   2. 或者设环境变量 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET / OSS_ENDPOINT
#
# 证书：脚本走 OSS API（AK/SK 直连），不经浏览器 HTTPS 证书，不受影响。

set -euo pipefail

# ===== 目标目录映射 =====
ENV_ARG="${1:-}"
ONLY="${2:-all}"
DRY="${3:-}"

case "$ENV_ARG" in
  test)
    BUCKET="wenyan-test-online"
    ;;
  prod)
    BUCKET="classic-chinese"
    ;;
  *)
    echo "用法: $0 {test|prod} [all|data|images|video|audio] [--dry]"
    echo ""
    echo "  环境: test / prod"
    echo "  只传: all / data / images / video / audio"
    echo "  预览: --dry"
    exit 1
    ;;
esac

REGION="${OSS_REGION:-oss-cn-guangzhou}"
# endpoint 格式：oss-cn-guangzhou.aliyuncs.com
ENDPOINT="${OSS_ENDPOINT:-${REGION}.aliyuncs.com}"

# ===== 加载凭证（实际运行才校验）=====
DRY_RUN=0
[[ "$DRY" == "--dry" ]] && DRY_RUN=1

CREDS_FILE="$HOME/.wenyan-oss-credentials"
if [[ -f "$CREDS_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CREDS_FILE"
fi
AK="${OSS_ACCESS_KEY_ID:-}"
SK="${OSS_ACCESS_KEY_SECRET:-}"

# ===== 扫描文件 =====
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC="$ROOT/public"

ALL_SUBDIRS="data images video audio"
[[ "$ONLY" == "all" ]] && TARGETS="$ALL_SUBDIRS" || TARGETS="$ONLY"

echo "========================================"
echo "OSS 数据上传 --env $ENV_ARG"
echo "========================================"
echo "Bucket:   $BUCKET ($ENDPOINT)"
echo "目录:     $TARGETS"
echo "模式:     $DRY_RUN==1 && echo 'DRY-RUN 预览（不上传）' || echo '实际上传'"
echo "========================================"

COUNT=0
FAIL=0

for sub in $TARGETS; do
  LOCAL="$PUBLIC/$sub"
  if [[ ! -d "$LOCAL" ]]; then
    echo "⚠️  跳过不存在的目录: public/$sub"
    continue
  fi

  FILES="$(find "$LOCAL" -type f | wc -l | tr -d ' ')"
  if [[ "$FILES" -eq 0 ]]; then
    echo "📂 public/$sub/  (空)"
    continue
  fi
  echo "📂 public/$sub/  ($FILES 个文件)"
  COUNT=$((COUNT + FILES))
done

if [[ "$COUNT" -eq 0 ]]; then
  echo "⚠️  没有可上传的文件，退出。"
  exit 0
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo ""
  echo "✅ DRY-RUN 完成：共 $COUNT 个文件将上传到 oss://$BUCKET/"
  echo "   去掉 --dry 执行实际上传。"
  exit 0
fi

# ===== 以下为实际运行才需要的校验 =====

# 检查凭证
if [[ -z "$AK" || -z "$SK" ]]; then
  echo "❌ 缺少 OSS AK/SK"
  echo ""
  echo "两种方式二选一："
  echo "  a) 写文件 $CREDS_FILE，内容："
  echo "     export OSS_ACCESS_KEY_ID=LTAIxxx"
  echo "     export OSS_ACCESS_KEY_SECRET=yyy"
  echo ""
  echo "  b) 先 export OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET 再跑脚本"
  exit 1
fi

# 检查 ossutil 是否可用，没有就下载
if ! command -v ossutil64 >/dev/null 2>&1 && ! command -v ossutil >/dev/null 2>&1; then
  echo "📥 ossutil 未安装，下载中..."
  OS_NAME="$(uname -s)"
  case "$OS_NAME" in
    MINGW*|MSYS*|CYGWIN*)
      mkdir -p /usr/local/bin
      curl -fsSL -o /usr/local/bin/ossutil64 https://gosspublic.alicdn.com/ossutil/1.7.18/ossutil64
      chmod +x /usr/local/bin/ossutil64
      ;;
    Linux*)
      mkdir -p /usr/local/bin
      curl -fsSL -o /usr/local/bin/ossutil https://gosspublic.alicdn.com/ossutil/1.7.18/ossutil64
      chmod +x /usr/local/bin/ossutil
      ;;
    *)
      echo "❌ 无法自动下载 ossutil，请手动安装："
      echo "   https://help.aliyun.com/document_detail/120075.html"
      exit 1
      ;;
  esac
fi

OSSUTIL="$(command -v ossutil64 2>/dev/null || command -v ossutil 2>/dev/null)"

echo ""
COUNT=0
FAIL=0

for sub in $TARGETS; do
  LOCAL="$PUBLIC/$sub"
  [[ ! -d "$LOCAL" ]] && continue
  FILES="$(find "$LOCAL" -type f | wc -l | tr -d ' ')"
  [[ "$FILES" -eq 0 ]] && continue

  echo "📂 上传 public/$sub/ ($FILES 个文件)..."
  if "$OSSUTIL" cp -r "$LOCAL" "oss://$BUCKET/$sub/" \
      -i "$AK" -k "$SK" -e "$ENDPOINT" \
      --acl public-read --force \
      >/dev/null 2>&1; then
    COUNT=$((COUNT + FILES))
    echo "   ✅ 成功"
  else
    FAIL=$((FAIL + 1))
    echo "   ❌ 失败：public/$sub/"
  fi
done

echo "========================================"
echo "✅ 上传完成：成功 $COUNT | 目录失败 $FAIL"
echo "   目标 URL: https://${ENV_ARG}.classicalab.cn"
echo "========================================"
