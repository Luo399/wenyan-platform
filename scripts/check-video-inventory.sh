#!/bin/bash
# ============================================================
# 素材可用性实测脚本
# 逐文件 HEAD 探测生产 CDN，输出 src/config/poemAssets.ts 里那几张表。
#
# 为什么用 HEAD 而不是列目录：
#   classic-chinese 桶没开匿名 ListObjects（请求会被 AccessDenied 挡掉），
#   而前端本来就是按文件名直连 OSS 取资源，HEAD 探到的就是浏览器实际会撞到的结果。
#
# 用法：
#   bash scripts/check-video-inventory.sh                 # 探生产
#   bash scripts/check-video-inventory.sh https://test.classicalab.cn
# ============================================================

set -e

BASE="${1:-https://www.classicalab.cn}"
# 只探前 N 篇可以用 POEM_COUNT=5 bash scripts/check-video-inventory.sh 快速自检
POEM_COUNT="${POEM_COUNT:-37}"
VIDEO_KEYS="bg 1 2 3"

# 单个文件是否存在（HTTP 200 才算在）
exists() {
  local code
  code=$(curl -o /dev/null -s -w '%{http_code}' -I -L --max-time 20 --retry 2 "$1")
  [ "$code" = "200" ]
}

missing_rule=()   # rule 视频整篇缺（4 个文件任一缺失即计入）
missing_files=()  # 具体缺的文件
have_cards=()     # culture_cards JSON 已存在的编号
have_basic=()     # text_basic_info JSON 已存在的编号

echo "探测基址: $BASE"
echo

for i in $(seq 1 "$POEM_COUNT"); do
  nn=$(printf '%02d' "$i")

  incomplete=""
  for k in $VIDEO_KEYS; do
    f="WEN_${nn}_rule_${k}.mp4"
    if ! exists "$BASE/video/$f"; then
      incomplete="$incomplete $f"
    fi
  done
  if [ -n "$incomplete" ]; then
    missing_rule+=("$i")
    for f in $incomplete; do missing_files+=("$f"); done
  fi

  exists "$BASE/data/culture_cards/WEN_${nn}.json" && have_cards+=("$i")
  exists "$BASE/data/text_basic_info/WEN_${nn}.json" && have_basic+=("$i")

  printf '  WEN_%s  rule:%s  cards:%s  basic:%s\n' \
    "$nn" \
    "$([ -z "$incomplete" ] && echo OK || echo MISS)" \
    "$([[ " ${have_cards[*]-} " == *" $i "* ]] && echo OK || echo -)" \
    "$([[ " ${have_basic[*]-} " == *" $i "* ]] && echo OK || echo -)"
done

join_quoted() {
  local out=""
  local v
  for v in "$@"; do out="$out'$v', "; done
  echo "${out%, }"
}

echo
echo "==== 汇总 ===="
echo "rule 视频未齐的编号 (${#missing_rule[@]}): ${missing_rule[*]-无}"
echo "缺失文件 (${#missing_files[@]}):"
printf '  %s\n' "${missing_files[@]-}"
echo "culture_cards JSON 已有 (${#have_cards[@]}): ${have_cards[*]-无}"
echo "text_basic_info JSON 已有 (${#have_basic[@]}): ${have_basic[*]-无}"

echo
echo "==== 可直接粘贴进 src/config/poemAssets.ts ===="
echo "export const RULE_VIDEO_MISSING_POEM_IDS: readonly string[] = [$(join_quoted ${missing_rule[@]-})]"
echo "export const CULTURE_CARD_DATA_POEM_IDS: readonly string[] = [$(join_quoted ${have_cards[@]-})]"
