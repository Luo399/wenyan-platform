#!/bin/bash
# ============================================================
# 数据引用的发版前自检（读本地 public/data，探线上素材）
#
# 和 check-card-references.sh 的分工：
#   check-card-references.sh  查线上「现在」的数据 JSON（部署后回归用）
#   本脚本                    查本地即将发出去的 JSON（部署**前**用）
#
# 为什么要它：这次清理坏引用时发现，只查线上 JSON 会在改完之后仍然报旧的错，
# 而改完本地就想确认「发出去不会再有 404」。
#
# 覆盖的是前端真正会拼成 URL 的字段（判据取自组件源码）：
#   culture_cards            image_file/poster_file/background_image
#                            → 视频 {base}/video/，图片 {base}/images/culture_cards/{text_id}/
#   level2_dialog / *_quiz   icon_dialog → {base}/images/screens/{wenId}/dialogue/{name}
#                            探测失败时组件回退 {base}/images/{name}，两处都无才算坏
#   各 audio_file / bgm      → {base}/audio/{name}（数据里常不写扩展名，代码补 .mp3）
#   其余带扩展名的值          → video / images / images/culture_cards/{text_id} 都试一遍
#
# 扫描范围是 public/data 下所有 JSON（不止 WEN_nn.json）：聚合文件如
# level1_multi_role_reading.json、level2_dialog_quiz.json 同样会被传到 OSS，
# 里面的 audio_file 也会拼成 URL，名字写错就是留一份坏数据在那儿。
# 编号从素材名自身的 WEN_nn_ 前缀取，一篇装多个编号的聚合文件也能定位对目录。
#
# 用法：
#   bash scripts/check-data-references.sh
#   bash scripts/check-data-references.sh https://test.classicalab.cn
# ============================================================

set -euo pipefail

BASE="${1:-https://www.classicalab.cn}"
DATA_DIR="${DATA_DIR:-public/data}"

if [ ! -d "$DATA_DIR" ]; then
  echo "ERROR: 数据目录不存在: $DATA_DIR（可用 DATA_DIR=... 覆盖）" >&2
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: 需要 curl" >&2
  exit 1
fi

probe() {
  curl -o /dev/null -s -w '%{http_code}' -I -L --max-time 20 --retry 2 "$1" || true
}

refs=()      # "路径|说明"
ok_count=0
bad_count=0
scanned=0

# 逐个「取值 → 候选 URL」探测：任一候选 200 即通过
check_ref() {
  local label="$1"; shift
  local urls=("$@")
  for u in "${urls[@]}"; do
    if [ "$(probe "$u")" = "200" ]; then
      ok_count=$((ok_count + 1))
      return 0
    fi
  done
  bad_count=$((bad_count + 1))
  refs+=("$label —— ${urls[*]}")
  return 0
}

# 编号取自「文件名」或「值本身」：素材名一律以 WEN_nn_ 开头，所以聚合 JSON
# （level1_multi_role_reading.json 这类一篇装多个编号的）也能定位到正确目录。
tid_of() {
  local v="$1"
  { printf '%s' "$v" | grep -o 'WEN_[0-9][0-9]' | sed -n '1p'; } || true
}

# 扫 public/data 下**全部** JSON：前端只按 {dir}/WEN_nn.json 取数据，
# 但聚合 JSON 同样会随 public/** 传到 OSS，名字写错等于留一份坏数据在那儿骗后来人。
# 例外：WEN_01_未转义.json 这类没有任何代码路径会去取的副本。
for json in $(find "$DATA_DIR" -name '*.json' -type f \
               | grep -v '_未转义\.json$' | sort); do
  dir=$(basename "$(dirname "$json")")
  file_tid=$(basename "$json" .json)
  scanned=$((scanned + 1))
  covered=" "   # 上面几个专用字段已查过的值，通用扫描不再重复报

  # --- 文化卡片 ---
  if [ "$dir" = "culture_cards" ]; then
    for field in image_file background_image poster_file; do
      for v in $(grep -o "\"$field\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" "$json" \
                 | sed 's/.*:[[:space:]]*"//; s/"$//' | sort -u); do
        covered="$covered$v "
        [ -z "$v" ] && continue
        [ "$v" = "文字" ] && continue
        tid=$(tid_of "$v"); tid=${tid:-$file_tid}
        case "$v" in
          *.mp4|*.MP4|*.webm|*.WEBM|*.ogg|*.OGG) url="$BASE/video/$v" ;;
          *) url="$BASE/images/culture_cards/$tid/$v" ;;
        esac
        check_ref "$json [$field] \"$v\"" "$url"
      done
    done
  fi

  # --- 对话头像 ---
  for v in $(grep -o '"icon_dialog"[[:space:]]*:[[:space:]]*"[^"]*"' "$json" \
             | sed 's/.*:[[:space:]]*"//; s/"$//' | sort -u); do
    covered="$covered$v "
    [ -z "$v" ] && continue
    tid=$(tid_of "$v"); tid=${tid:-$file_tid}
    check_ref "$json [icon_dialog] \"$v\"" \
      "$BASE/images/screens/$tid/dialogue/$v" "$BASE/images/$v"
  done

  # --- 音频（数据里常省略扩展名，代码补 .mp3）---
  for v in $(grep -o '"\(audio_file\|bgm\)"[[:space:]]*:[[:space:]]*"[^"]*"' "$json" \
             | sed 's/.*:[[:space:]]*"//; s/"$//' | sort -u); do
    [ -z "$v" ] && continue
    case "$v" in
      *.mp3|*.wav|*.ogg) cand=("$BASE/audio/$v") ;;
      *) cand=("$BASE/audio/$v.mp3" "$BASE/audio/$v") ;;
    esac
    check_ref "$json [audio] \"$v\"" "${cand[@]}"
  done

  # --- 其他带素材扩展名、又不由上面字段覆盖的值（含 illustration 这类目前不请求的）---
  for v in $(grep -o '"[^"]*\.\(png\|jpg\|jpeg\|webp\)"' "$json" \
             | sed 's/^"//; s/"$//' | sort -u); do
    case "$v" in WEN_*) : ;; *) continue ;; esac
    case "$covered" in *" $v "*) continue ;; esac
    tid=$(tid_of "$v")
    check_ref "$json [图片] \"$v\"" \
      "$BASE/images/$v" "$BASE/images/culture_cards/$tid/$v" \
      "$BASE/images/screens/$tid/dialogue/$v"
  done
done

echo "基址: $BASE"
echo "本地数据目录: $DATA_DIR（扫了 $scanned 个 JSON）"
echo "取到的引用: $ok_count   取不到的引用: $bad_count"
echo
if [ "$bad_count" -eq 0 ]; then
  echo "✅ 发出去的 JSON 里，所有引用都能取到"
else
  echo "==== 取不到的引用 ===="
  printf '  %s\n' "${refs[@]}"
fi

[ "$bad_count" -eq 0 ]
