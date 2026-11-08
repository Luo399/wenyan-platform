#!/bin/bash
# ============================================================
# 素材 ↔ 课文 ↔ 页面「对应性」核查
#
# 和已有三个脚本的分工（别搞混）：
#   check-video-inventory.sh    只答「rule 视频 / 两个 JSON 在不在」
#   check-card-references.sh    只答「线上 culture_cards JSON 引用的东西取不取到」
#   check-data-references.sh    只答「本地待发的 JSON 引用的东西取不取到」
#   本脚本                      答「每一篇的每一个页面，挂的素材是不是这一篇的」
#
# 三件事一起查，缺一件都会有漏网的「对不上」：
#   1) 覆盖：37 个编号 × 8 类页面，数据 JSON / 素材是否到位
#   2) 引用完整性：页面 JSON 引用的素材按前端拼接规则逐个 HEAD
#   3) 归属（关键，前三个脚本都不查）：
#      - 引用素材名里的 WEN_xx 是否等于本篇编号 —— 等于就是在给别的课文挂素材
#      - JSON 内部 text_id 是否等于文件名编号
#      - culture_cards 每张卡有没有 text_id（缺了前端拼出 .../undefined/xxx.png）
#      - 线上 title 与代码里 poemMap 的篇名是否一致
#      - OSS 上已交付的卡片视频，有没有被任何 JSON 引用（孤儿素材）
#
# 页面与数据目录的对应关系取自源码，不是猜的：
#   rules/rule1..3  RuleVideoView.vue      → /video/{wenId}_rule_{bg|1|2|3}.mp4
#   课文详情         DetailView.vue         → /data/text_basic_info/{wenId}.json
#   第一关·字词      WordList.vue           → /data/word_list/{wenId}.json（回落 text_basic_info）
#   第一关·朗读      MultiRoleReading.vue   → /data/multi_role_reading/{wenId}.json + /audio/{audio_file}
#   第一关·测验      Level1Quiz.vue         → /data/level1_quiz/{wenId}.json
#   第二关           StepView + pageRegistry → /data/pages_level2_dialog_quiz/{wenId}.json
#   第三关           StepView + pageRegistry → /data/pages_level3_adaptive_quiz/{wenId}.json
#   第三关·文化卡片  CultureCards.vue       → /data/culture_cards/{wenId}.json
#
# 用法：
#   bash scripts/check-asset-correspondence.sh
#   bash scripts/check-asset-correspondence.sh https://test.classicalab.cn
#   POEM_COUNT=5 bash scripts/check-asset-correspondence.sh      # 快速自检
#   FETCH_TITLES=1 bash scripts/check-asset-correspondence.sh    # 顺带把每篇标题图下到 /tmp/article-titles/
#
# 退出码：0=归属类问题为 0；1=有串台/坏引用/text_id 不一致（覆盖缺口不算失败）
# ============================================================

set -e

BASE="${1:-https://www.classicalab.cn}"
POEM_COUNT="${POEM_COUNT:-37}"
WEN_UTILS="${WEN_UTILS:-src/utils/wenUtils.ts}"
CARD_DIR="${CARD_DIR:-card_video_upload_only}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
URLS="$TMP/urls.txt"
CODES="$TMP/codes.tsv"
JSONS="$TMP/json"
mkdir -p "$JSONS"
: >"$URLS"

# 前端真正会去取的目录（目录名 = getDataUrl/dir 或 pageRegistry.dataDir）
DIRS="text_basic_info word_list multi_role_reading level1_quiz pages_level2_dialog_quiz pages_level3_adaptive_quiz culture_cards"

# ------------------------------------------------------------
# 第 1 轮探测：把「编号 × 页面」的 URL 全部列出来再并发 HEAD
# 桶没开匿名 ListObjects，只能按文件名探（同 check-video-inventory.sh 的口径）
# ------------------------------------------------------------
for i in $(seq 1 "$POEM_COUNT"); do
  nn=$(printf '%02d' "$i")
  for k in bg 1 2 3; do printf '%s\n' "$BASE/video/WEN_${nn}_rule_${k}.mp4" >>"$URLS"; done
  for d in $DIRS; do printf '%s\n' "$BASE/data/$d/WEN_${nn}.json" >>"$URLS"; done
  # 规范名音频：命名规范表（.trae/skills/naming-convention/SKILL.md）里约定的两个主音频。
  # MultiRoleReading 是 `${audioBaseUrl}${audio_file}` 原样拼，所以没有 JSON 时这两条探到也算「交了没挂」。
  printf '%s\n' "$BASE/audio/WEN_${nn}_multi_role.mp3" "$BASE/audio/WEN_${nn}_read_full.mp3" >>"$URLS"
done

# 已交付的卡片视频（OSS 是控制台拖拽上传的，object 名 = 本地文件名，所以本地待传目录就是线上名单）
if [ -d "$CARD_DIR" ]; then
  for f in "$CARD_DIR"/*.mp4; do
    [ -e "$f" ] || continue
    printf '%s\n' "$BASE/video/$(basename "$f")" >>"$URLS"
  done
fi

probe_batch() {
  # 并发探一批 URL，输出「code<TAB>url」
  xargs -P 8 -n 1 -a "$1" bash -c '
    c=$(curl -o /dev/null -s -w "%{http_code}" -I -L --max-time 25 --retry 2 "$0")
    printf "%s\t%s\n" "$c" "$0"
  ' >"$2"
}
probe_batch "$URLS" "$CODES"

declare -A CODE
while IFS=$'\t' read -r c u; do
  CODE["$u"]="$c"
done <"$CODES"

has() { [ "${CODE["$1"]:-}" = "200" ]; }

# ------------------------------------------------------------
# 第 2 轮：把存在的线上 JSON 拉下来，逐字段解析引用
# ------------------------------------------------------------
for i in $(seq 1 "$POEM_COUNT"); do
  nn=$(printf '%02d' "$i")
  for d in $DIRS; do
    u="$BASE/data/$d/WEN_${nn}.json"
    has "$u" && curl -s --max-time 25 "$u" -o "$JSONS/${d}__WEN_${nn}.json"
  done
done

values_of() {
  # $1=文件 $2=字段名 → 该字段的所有非空值
  [ -f "$1" ] || return 0
  grep -o "\"$2\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" "$1" \
    | sed 's/.*:[[:space:]]*"//; s/"$//' | sort -u
}

# 引用素材名自带的编号前缀（素材一律 WEN_nn_ 开头）
tid_of() { printf '%s' "$1" | grep -o 'WEN_[0-9][0-9]' | head -1; }

# WEN_04 / 04 → 4：poemMap 的 key 是不补零的数字
nn_key() { local v="${1#WEN_}"; printf '%s' "${v##0}"; }

# 第 3 轮：引用 URL 列表（先收集，再并发探）
REF_URLS="$TMP/refurls.txt"
: >"$REF_URLS"

# 每条待查引用：文件|字段|值|本篇编号|候选URL...
REFS="$TMP/refs.txt"
: >"$REFS"

add_ref() {
  printf '%s|%s|%s|%s\n' "$1" "$2" "$3" "$4" >>"$REFS"
  shift 4
  for u in "$@"; do printf '%s\n' "$u" >>"$REF_URLS"; done
}

for jf in "$JSONS"/*.json; do
  [ -e "$jf" ] || continue
  base_name=$(basename "$jf" .json)
  d=${base_name%__*}
  file_nn=${base_name#*__}          # WEN_01
  nn=${file_nn#WEN_}

  if [ "$d" = "culture_cards" ]; then
    for field in image_file background_image poster_file; do
      for v in $(values_of "$jf" "$field"); do
        [ -z "$v" ] && continue
        [ "$v" = "文字" ] && continue
        case "$v" in
          *.mp4|*.MP4|*.webm|*.WEBM|*.ogg|*.OGG) add_ref "$d" "$field" "$v" "$nn" "$BASE/video/$v" ;;
          *) add_ref "$d" "$field" "$v" "$nn" \
               "$BASE/images/culture_cards/$file_nn/$v" \
               "$BASE/images/culture_cards/$v" ;;
        esac
      done
    done
  fi

  for v in $(values_of "$jf" "icon_dialog"); do
    [ -z "$v" ] && continue
    tid=$(tid_of "$v")
    add_ref "$d" "icon_dialog" "$v" "$nn" \
      "$BASE/images/screens/${tid:-$file_nn}/dialogue/$v" "$BASE/images/$v"
  done

  for field in audio_file bgm; do
    for v in $(values_of "$jf" "$field"); do
      [ -z "$v" ] && continue
      tid=$(tid_of "$v")
      case "$v" in
        *.mp3|*.wav|*.ogg) add_ref "$d" "$field" "$v" "$nn" "$BASE/audio/$v" ;;
        *) add_ref "$d" "$field" "$v" "$nn" "$BASE/audio/$v.mp3" "$BASE/audio/$v" ;;
      esac
      [ -n "$tid" ] && [ "$tid" != "$file_nn" ] && printf '%s|%s|%s|%s\n' "$d" "字段归属" "$v" "$nn" >>"$TMP/crossrefs.txt"
    done
  done

  # illustration 等其余带扩展名的素材名（目前没有组件拼它，仍查出来备用）
  for v in $(grep -o '"[^"]*\.\(png\|jpg\|jpeg\|webp\)"' "$jf" | sed 's/^"//; s/"$//' | sort -u); do
    case "$v" in WEN_*) : ;; *) continue ;; esac
    tid=$(tid_of "$v")
    add_ref "$d" "图片" "$v" "$nn" \
      "$BASE/images/screens/${tid:-$file_nn}/$v" \
      "$BASE/images/culture_cards/${tid:-$file_nn}/$v" \
      "$BASE/images/$v"
    [ -n "$tid" ] && [ "$tid" != "$file_nn" ] && printf '%s|%s|%s|%s\n' "$d" "图片归属" "$v" "$nn" >>"$TMP/crossrefs.txt"
  done

  # JSON 内部 text_id 是否等于文件名编号
  inner=$(values_of "$jf" "text_id" | head -1)
  if [ -n "$inner" ] && [ "$inner" != "$file_nn" ]; then
    printf '%s|%s|%s|%s\n' "$d" "text_id" "$inner" "$nn" >>"$TMP/textid.txt"
  fi

  # culture_cards：每张卡都要有 text_id（CultureCards.vue 用 card.text_id 拼图片路径）
  if [ "$d" = "culture_cards" ]; then
    cards=$(grep -o '"card_id"' "$jf" | wc -l)
    tids=$(grep -o '"text_id"' "$jf" | wc -l)
    if [ "$tids" -lt $((cards + 1)) ]; then
      printf '%s|%s\n' "$file_nn" "共 $cards 张卡，带 text_id 的只有 $((tids - 1)) 张（顶层占 1 个）" >>"$TMP/cardtid.txt"
    fi
  fi

  # 篇名一致性（只对 text_basic_info）
  if [ "$d" = "text_basic_info" ]; then
    t=$(values_of "$jf" "title" | head -1)
    printf '%s|%s\n' "$nn" "$t" >>"$TMP/online_titles.txt"
  fi

  # 卡片视频归属：引用名里的 WEN 前缀 vs 本篇
  for v in $(values_of "$jf" "image_file"); do
    tid=$(tid_of "$v")
    [ -n "$tid" ] && [ "$tid" != "$file_nn" ] && printf '%s|%s|%s|%s\n' "$d" "image_file归属" "$v" "$nn" >>"$TMP/crossrefs.txt"
  done
done

probe_batch "$REF_URLS" "$TMP/refcodes.tsv"
declare -A RC
while IFS=$'\t' read -r c u; do RC["$u"]="$c"; done <"$TMP/refcodes.tsv"

# ------------------------------------------------------------
# 代码里的 poemMap 篇名（判据：src/utils/wenUtils.ts）
# ------------------------------------------------------------
declare -A MAP_TITLE
while read -r k t; do
  MAP_TITLE["$k"]="$t"
done < <(sed -n "s/^[[:space:]]*'\([0-9]\{1,2\}\)': { title: '\(.*\)' },.*/\1 \2/p" "$WEN_UTILS" | awk '{id=$1; $1=""; sub(/^ /,""); print id, $0}')

# ------------------------------------------------------------
# 输出 1：覆盖矩阵
# ------------------------------------------------------------
echo "基址: $BASE     篇目数: $POEM_COUNT     实测时间: $(date '+%Y-%m-%d %H:%M')"
echo
printf '%-8s %-6s %-7s %-6s %-6s %-6s %-6s %-6s %-6s %-8s %-8s %s\n' \
  编号 rule视频 原文 字词 朗读 L1测 二关 三关 卡片 分角色音频 整篇音频 就绪页面
echo "-------------------------------------------------------------------------------------------"
declare -A READY_PAGE_COUNT
for i in $(seq 1 "$POEM_COUNT"); do
  nn=$(printf '%02d' "$i")
  rule_ok=0
  for k in bg 1 2 3; do has "$BASE/video/WEN_${nn}_rule_${k}.mp4" && rule_ok=$((rule_ok + 1)); done
  printf '%-8s %-6s ' "WEN_$nn" "$( [ "$rule_ok" = 4 ] && echo 齐 || echo "$rule_ok/4" )"
  n_ready=0
  for d in text_basic_info word_list multi_role_reading level1_quiz pages_level2_dialog_quiz pages_level3_adaptive_quiz culture_cards; do
    if has "$BASE/data/$d/WEN_${nn}.json"; then printf '%-6s' 有; n_ready=$((n_ready + 1)); else printf '%-6s' -; fi
  done
  has "$BASE/audio/WEN_${nn}_multi_role.mp3" && printf '%-10s' 有 || printf '%-10s' -
  has "$BASE/audio/WEN_${nn}_read_full.mp3" && printf '%-8s' 有 || printf '%-8s' -
  printf '%s\n' "$n_ready"
  READY_PAGE_COUNT["$i"]=$n_ready
done

# ------------------------------------------------------------
# 输出 2：引用完整性（取不到的引用）
# ------------------------------------------------------------
echo
echo "==== 一、页面 JSON 引用的素材：取不到的 ===="
bad_ref=0
while IFS='|' read -r d field v nn; do
  urls_line=""
  ok=0
  case "$field" in
    image_file|background_image|poster_file)
      case "$v" in
        *.mp4|*.MP4|*.webm|*.WEBM|*.ogg|*.OGG) cand=("$BASE/video/$v") ;;
        *) cand=("$BASE/images/culture_cards/WEN_${nn}/$v" "$BASE/images/$v") ;;
      esac ;;
    icon_dialog) cand=("$BASE/images/screens/WEN_${nn}/dialogue/$v" "$BASE/images/$v") ;;
    audio_file|bgm)
      case "$v" in
        *.mp3|*.wav|*.ogg) cand=("$BASE/audio/$v") ;;
        *) cand=("$BASE/audio/$v.mp3" "$BASE/audio/$v") ;;
      esac ;;
    *) cand=("$BASE/images/screens/WEN_${nn}/$v" "$BASE/images/culture_cards/WEN_${nn}/$v" "$BASE/images/$v") ;;
  esac
  for u in "${cand[@]}"; do [ "${RC[$u]:-}" = "200" ] && ok=1; done
  if [ "$ok" = 0 ]; then
    bad_ref=$((bad_ref + 1))
    printf '  [%s] WEN_%s %s -> "%s"  %s\n' "$d" "$nn" "$field" "$v" "$(printf '%s ' "${cand[@]}")"
  fi
done <"$REFS"
[ "$bad_ref" = 0 ] && echo "  无（引用到的素材都能取到）"
echo "  取到的引用: $(( $(wc -l <"$REFS") - bad_ref )) / $(wc -l <"$REFS")"

# ------------------------------------------------------------
# 输出 3：归属核查（这才是「对不对得上」）
# ------------------------------------------------------------
echo
echo "==== 二、素材归属：编号串台 / text_id 不一致 ===="
issue=0
if [ -s "$TMP/crossrefs.txt" ]; then
  sort -u "$TMP/crossrefs.txt" | while IFS='|' read -r d field v nn; do
    printf '  [串台] %s/WEN_%s.json 的 %s 引用的是 %s —— 素材编号与本篇不一致\n' "$d" "$nn" "$field" "$(tid_of "$v")"
  done
  issue=$((issue + 1))
fi
if [ -s "$TMP/textid.txt" ]; then
  sort -u "$TMP/textid.txt" | while IFS='|' read -r d field inner nn; do
    printf '  [text_id] %s/WEN_%s.json 内部 text_id=%s\n' "$d" "$nn" "$inner"
  done
  issue=$((issue + 1))
fi
if [ -s "$TMP/cardtid.txt" ]; then
  while IFS='|' read -r nn msg; do
    printf '  [卡片缺 text_id] culture_cards/%s：%s（前端拼出 images/culture_cards/undefined/xxx）\n' "$nn" "$msg"
  done <"$TMP/cardtid.txt"
  issue=$((issue + 1))
fi
[ "$issue" = 0 ] && echo "  无"

echo
echo "==== 三、篇名一致性：线上原文 JSON 的 title vs 代码 poemMap ===="
title_bad=0
if [ -s "$TMP/online_titles.txt" ]; then
  while IFS='|' read -r nn t; do
    m=${MAP_TITLE["$(nn_key "$nn")"]:-（poemMap 无此编号）}
    if [ "$m" = "$t" ]; then
      printf '  WEN_%s  一致：%s\n' "$nn" "$t"
    elif printf '%s' "$t" | grep -qF "$m" || printf '%s' "$m" | grep -qF "$t"; then
      printf '  WEN_%s  简称差异（可用）：线上「%s」 / poemMap「%s」\n' "$nn" "$t" "$m"
    else
      printf '  WEN_%s  ⚠ 不一致：线上「%s」 / poemMap「%s」\n' "$nn" "$t" "$m"
      title_bad=$((title_bad + 1))
    fi
  done <"$TMP/online_titles.txt"
else
  echo "  线上没有任何 text_basic_info JSON，无从比对"
fi

# ------------------------------------------------------------
# 输出 4：孤儿素材（已交付但没页面挂载）
# ------------------------------------------------------------
echo
echo "==== 四、已交付但没被任何页面引用的卡片视频（孤儿） ===="
referenced_all=$(awk -F'|' '$2=="image_file"||$2=="poster_file"||$2=="background_image"{print $3}' "$REFS" | sort -u)
orphan=0
if [ -d "$CARD_DIR" ]; then
  for f in "$CARD_DIR"/*.mp4; do
    [ -e "$f" ] || continue
    name=$(basename "$f")
    vnn=$(tid_of "$name"); vnn=${vnn:-未知}
    on_oss=$( [ "${CODE["$BASE/video/$name"]:-}" = "200" ] && echo 线上有 || echo "线上${CODE["$BASE/video/$name"]:-?}" )
    if ! printf '%s' "$referenced_all" | grep -qxF "$name"; then
      orphan=$((orphan + 1))
      key=$(nn_key "$vnn")
      printf '  %-34s %s  自称编号 WEN_%s（poemMap: %s）\n' "$name" "$on_oss" "${vnn#WEN_}" "${MAP_TITLE[$key]:-?}"
    fi
  done
fi
[ "$orphan" = 0 ] && echo "  无"
[ "$orphan" != 0 ] && echo "  小计 $orphan 个"

echo
echo "==== 五、素材已交付、但对应页面 JSON 还没产出（前端永远取不到） ===="
audio_no_json=""
for i in $(seq 1 "$POEM_COUNT"); do
  nn=$(printf '%02d' "$i")
  if has "$BASE/audio/WEN_${nn}_multi_role.mp3" && ! has "$BASE/data/multi_role_reading/WEN_${nn}.json"; then
    audio_no_json="$audio_no_json $i"
  fi
done
if [ -n "$audio_no_json" ]; then
  echo "  分角色朗读音频已上传、却没有 multi_role_reading JSON 的编号:$audio_no_json"
  echo "  （第一关「分角色朗读」的播放地址是 \${audioBaseUrl}\${audio_file}，audio_file 只能来自那个 JSON，所以这批音频现在听不到）"
else
  echo "  无"
fi

echo
echo "==== 六、设计侧（Figma 导出）页面图覆盖 + 标题图 ===="
# 为什么查这个：内容组的 data JSON 只有 01–04，但美术侧是按页面把图传到
# images/screens/{wenId}/{页面}/ 下的。两边用的是不是同一套编号，只能从设计侧的
# 「篇名标题图」article_title_WEN_nn_kk.png 反查——图上渲染的就是这一号实际对应哪篇。
DTMP="$TMP/design"
mkdir -p "$DTMP"
for i in $(seq -w 1 "$POEM_COUNT"); do
  for s in "video:video_placeholder_01.png" "explanation:bg_explanation_.png" "dialogue:card_bamboo_07.png" \
           "quiz:option_d_01.png" "summary:bg_summary.png"; do
    printf '%s\n' "$BASE/images/screens/WEN_$i/${s%%:*}/${s#*:}" >>"$DTMP/urls.txt"
  done
  for k in 01 02 03 04 05 06 07 08; do
    printf '%s\n' "$BASE/images/screens/WEN_$i/video/article_title_WEN_${i}_$k.png" >>"$DTMP/urls.txt"
  done
done
probe_batch "$DTMP/urls.txt" "$DTMP/codes.tsv"
declare -A DC
while IFS=$'\t' read -r c u; do DC["$u"]="$c"; done <"$DTMP/codes.tsv"

[ "${FETCH_TITLES:-0}" = "1" ] && mkdir -p /tmp/article-titles && rm -f /tmp/article-titles/*.png
printf '%-8s %-6s %-6s %-6s %-6s %-6s %s\n' 编号 规则页 逐句页 对话页 测验页 总结页 标题图（读它才知道这一号实际是哪篇）
echo "--------------------------------------------------------------------------"
design_n=0
for i in $(seq -w 1 "$POEM_COUNT"); do
  line=$(printf '%-8s' "WEN_$i")
  any=0
  for s in "video:video_placeholder_01.png" "explanation:bg_explanation_.png" "dialogue:card_bamboo_07.png" \
           "quiz:option_d_01.png" "summary:bg_summary.png"; do
    u="$BASE/images/screens/WEN_$i/${s%%:*}/${s#*:}"
    if [ "${DC[$u]:-}" = "200" ]; then line="$line$(printf '%-6s' 有)"; any=1; else line="$line$(printf '%-6s' -)"; fi
  done
  [ "$any" = 1 ] && design_n=$((design_n + 1))
  title=""
  for k in 08 07 06 05 04 03 02 01; do
    u="$BASE/images/screens/WEN_$i/video/article_title_WEN_${i}_$k.png"
    if [ "${DC[$u]:-}" = "200" ]; then title="$u"; break; fi
  done
  if [ -n "$title" ]; then
    echo "$line article_title_WEN_${i}_$(basename "$title" .png | sed 's/.*_//').png"
    [ "${FETCH_TITLES:-0}" = "1" ] && curl -s --max-time 30 "$title" -o "/tmp/article-titles/WEN_$i.png"
  else
    echo "$line （无标题图）"
  fi
done
[ "${FETCH_TITLES:-0}" = "1" ] && echo "  标题图已下到 /tmp/article-titles/，逐张打开核对「编号 ↔ 篇名」"

echo
echo "==== 结论 ===="
rule_full=0
for i in $(seq 1 "$POEM_COUNT"); do
  t=0
  for k in bg 1 2 3; do has "$BASE/video/WEN_$(printf '%02d' "$i")_rule_${k}.mp4" && t=$((t + 1)); done
  [ "$t" = 4 ] && rule_full=$((rule_full + 1))
done
json_lessons=$(awk -F'|' '{print $1}' "$TMP/online_titles.txt" 2>/dev/null | sort -u | wc -l)
echo "  取数总数: $(wc -l <"$URLS") 个 URL，另有引用 $(wc -l <"$REF_URLS") 个"
echo "  rule 视频 4 段齐的编号: $rule_full / $POEM_COUNT"
echo "  有线上原文 JSON 的编号: $json_lessons / $POEM_COUNT（只有这些篇目的第二三关才可能有数据）"
echo "  设计侧有页面图的编号: $design_n / $POEM_COUNT（这一号到底是哪篇，看第六节标题图）"
echo "  取不到的引用: $bad_ref   归属类告警: $issue   篇名不一致: $title_bad   孤儿卡片视频: $orphan"
[ "$bad_ref" = 0 ] && [ "$issue" = 0 ] && [ "$title_bad" = 0 ] || exit 1
exit 0
