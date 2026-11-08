#!/bin/bash
# ============================================================
# 文化卡片引用完整性检查
#
# 为什么单独一个脚本：
#   check-video-inventory.sh 回答「某个编号的素材在不在」，
#   这个脚本回答「数据 JSON 里写下的每一个文件名，前端照着拼出来的 URL 到底能不能取到」。
#   两者查的是不同的坑：前者是漏传，后者是**名字写错/大小写不一致/多 Extension**，
#   而后者只会以「学生看到破图 / 视频加载失败」的形式在线上暴露。
#
# 判据与前端完全对齐（src/components/CultureCards.vue）：
#   视频 → {base}/video/{image_file}
#   图片 → {base}/images/culture_cards/{text_id}/{image_file}
#   背景 → {base}/images/culture_cards/{text_id}/{background_image}
#
# 用法：
#   bash scripts/check-card-references.sh
#   bash scripts/check-card-references.sh https://test.classicalab.cn
# ============================================================

set -euo pipefail

BASE="${1:-https://www.classicalab.cn}"
POEM_COUNT="${POEM_COUNT:-37}"

if ! [[ "$POEM_COUNT" =~ ^[0-9]+$ ]] || [ "$POEM_COUNT" -lt 1 ]; then
  echo "ERROR: POEM_COUNT 必须是正整数: $POEM_COUNT" >&2
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: 需要 curl" >&2
  exit 1
fi

broken=()     # 引用了但取不到
suspect=()    # 取不到，但换个扩展名/大小写能取到 → 命名错位
checked=0

probe() {
  curl -o /dev/null -s -w '%{http_code}' -I -L --max-time 20 --retry 2 "$1" || true
}

# 前端把 mp4 归到 /video/，其余图片归到 /images/culture_cards/{text_id}/
resolve_dir() {
  case "$1" in
    *.mp4|*.MP4|*.webm|*.WEBM|*.ogg|*.OGG) echo "video" ;;
    *) echo "images/culture_cards/$2" ;;
  esac
}

for i in $(seq 1 "$POEM_COUNT"); do
  nn=$(printf '%02d' "$i")
  json_url="$BASE/data/culture_cards/WEN_${nn}.json"
  [ "$(probe "$json_url")" = "200" ] || continue

  tmp=$(mktemp)
  curl -s -L --max-time 30 "$json_url" -o "$tmp"

  # text_id 在每张卡片里都带，按 image_file / background_image 逐个取
  for field in image_file background_image poster_file; do
    refs=$( { grep -o "\"$field\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" "$tmp" \
      | sed 's/.*:[[:space:]]*"//; s/"$//' | sort -u; } || true)
    for ref in $refs; do
      # "文字" 是数据里表示「这张卡只有文字」的占位值，不是文件名
      [ "$ref" = "文字" ] && continue
      dir=$(resolve_dir "$ref" "WEN_${nn}")
      url="$BASE/$dir/$ref"
      code=$(probe "$url")
      checked=$((checked + 1))
      if [ "$code" != "200" ]; then
        # 命名错位自查：同名多写一层扩展名（历史上拖拽上传出过 .mp4.mp4）
        alt=""
        case "$ref" in
          *.mp4)
            [ "$(probe "$BASE/video/${ref}.mp4")" = "200" ] && alt="${ref}.mp4"
            ;;
          *.png)
            [ "$(probe "$BASE/images/culture_cards/WEN_${nn}/${ref}.png")" = "200" ] && alt="${ref}.png"
            ;;
        esac
        if [ -n "$alt" ]; then
          suspect+=("WEN_${nn} $field: 引用 \"$ref\" 取不到($code)，但 OSS 上有 \"$alt\" —— 名字差一层扩展名")
        else
          broken+=("WEN_${nn} $field: $url -> $code")
        fi
      fi
    done
  done
  rm -f "$tmp"
done

echo "基址: $BASE"
echo "共检查引用 $checked 个"
echo
echo "==== 取不到的引用 (${#broken[@]}) ===="
if [ ${#broken[@]} -eq 0 ]; then echo "  无"; else printf '  %s\n' "${broken[@]}"; fi
echo
echo "==== 疑似命名错位 (${#suspect[@]}) ===="
if [ ${#suspect[@]} -eq 0 ]; then echo "  无"; else printf '  %s\n' "${suspect[@]}"; fi

# ---------------------------------------------------------------
# 本地待传文件的命名自检
# 素材是从本地拖进 OSS 控制台上传的，object 名 = 本地文件名，
# 所以名字写错在这一步就会带上去，等 JSON 引用它时才发现已经晚了。
# ---------------------------------------------------------------
echo
echo "==== 本地待传文件命名自检 ===="
local_bad=0
for d in card_video_upload_only public/video public/images; do
  [ -d "$d" ] || continue
  while IFS= read -r f; do
    name=$(basename "$f")
    reason=""
    case "$name" in
      *.mp4.mp4|*.png.png|*.jpg.jpg|*.jpeg.jpeg|*.mp3.mp3) reason="多了一层扩展名" ;;
      *" "*) reason="文件名含空格" ;;
      *[^a-zA-Z0-9_.-]*) reason="文件名含非 ASCII 或特殊字符" ;;
    esac
    # 大小写混排（例：WEN_03_card_Linzexv.mp4）——同一批素材里其余都是小写
    if [ -z "$reason" ] && printf '%s' "$name" | grep -q '[a-z0-9]_[A-Z]'; then
      reason="疑似大小写混排，与数据 JSON 的写法容易对不上"
    fi
    if [ -n "$reason" ]; then
      echo "  $f —— $reason"
      local_bad=$((local_bad + 1))
    fi
  done < <(find "$d" -maxdepth 2 -type f 2>/dev/null)
done
[ "$local_bad" -eq 0 ] && echo "  无异常命名"

[ ${#broken[@]} -eq 0 ] && [ ${#suspect[@]} -eq 0 ] && [ "$local_bad" -eq 0 ]
