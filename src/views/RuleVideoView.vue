<!--
  RuleVideoView.vue - 规则介绍页面（统一组件）

  合并自 RuleView/RuleView1/RuleView2/RuleView3 四个文件。
  通过 props 参数化差异点：
  - videoKey: 视频后缀，'bg' | '1' | '2' | '3'
  - navKey: 导航 key，'rules' | 'rule1' | 'rule2' | 'rule3'
  - titlePrefix: 标题前缀，如 '规则介绍' / '规则介绍（一）'

  路由配置中 4 条路由指向本组件，通过 props 传入不同参数。
-->
<template>
  <div class="rule-view">
    <!-- 顶部标题 -->
    <h1 class="page-title">{{ titlePrefix }} - {{ currentPoem.title }}</h1>

    <!-- 视频播放器 - 平铺整个宽度 -->
    <!-- 素材未就绪（OSS 上该编号还没有 rule 视频）时不渲染播放器，
         否则 VideoPlayer 只会报「视频加载失败」，学生会以为是网络问题 -->
    <div class="video-section" v-if="assetReady">
      <VideoPlayer
        fill
        :src="currentPoem.videoUrl"
        @play="trackInteraction('视频', '播放', 0)"
        @pause="trackInteraction('视频', '暂停', 0)"
        @ended="trackInteraction('视频', '完成', 0)"
      />
    </div>
    <div class="video-section not-ready" v-else>
      <div class="not-ready-box">
        <i class="fas fa-hourglass-half not-ready-icon" aria-hidden="true"></i>
        <p class="not-ready-text">{{ notReadyText }}</p>
      </div>
    </div>

    <!-- 底部导航按钮 -->
    <BackContinue
      back-text="返回"
      continue-text="继续"
      :show-continue="assetReady"
      @back="handleGoPrev"
      @continue="goNext()"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import VideoPlayer from '@/components/VideoPlayer.vue'
import BackContinue from '@/components/BackContinue.vue'
import { useNavigation } from '@/composables/useNavigation'
import { useTracking } from '@/composables/useTracking'
import { markNextEnterFromBackButton } from '@/utils/tracking'
import { getWenId, getPoemTitle } from '@/utils/wenUtils'
import { getAssetUrl } from '@/utils/asset'
import { ASSET_NOT_READY_TEXT, hasRuleVideo } from '@/config/poemAssets'

/**
 * 预加载后续步骤的懒加载组件 chunk + stepone 的数据 JSON。
 * RuleVideoView 只有 VideoPlayer，极轻量，用户进入后有充足时间让浏览器
 * 在后台加载后续 StepView / DetailView 的 JS。
 *
 * 数据预取：
 *   WordList 会拉 text_basic_info + word_list 两个 JSON
 *   MultiRoleReading 会拉 multi_role_reading 一个 JSON
 *   用与后续组件完全相同的 URL（含版本戳）fetch，让浏览器 disk cache 命中
 */
import { getDataUrlWithVersion } from '@/utils/asset'

const _preloadStarted = new Set<string>()
async function preloadUpstream(navKey: string, poemId: string) {
  // 按「页面 + 篇目」去重：只按 navKey 去重的话，换一篇课文再进同一页就不会预取了
  const dedupeKey = `${navKey}:${poemId}`
  if (_preloadStarted.has(dedupeKey)) return
  _preloadStarted.add(dedupeKey)

  // 1. 预加载组件 chunk
  //    必须挂 catch：chunk 加载失败（弱网、CDN 抖动、旧浏览器命中坏缓存）时
  //    会变成未捕获的 Promise rejection，部分浏览器会在控制台报红并干扰后续导航
  import('@/views/StepView.vue').catch(() => { /* 预取失败不影响主流程 */ })
  import('@/views/DetailView.vue').catch(() => { /* 预取失败不影响主流程 */ })

  // 2. 静默预取 stepone 数据（3 个 JSON），利用视频播放时间填 HTTP cache
  try {
    const wenId = getWenId(poemId)
    const urls = await Promise.all([
      getDataUrlWithVersion('text_basic_info', `${wenId}.json`),
      getDataUrlWithVersion('word_list', `${wenId}.json`),
      getDataUrlWithVersion('multi_role_reading', `${wenId}.json`),
    ])
    // 用 no-cache 预取（触发服务器返回但仍填 disk cache）
    urls.forEach((url) => {
      fetch(url, { cache: 'force-cache' }).catch(() => { /* 静默忽略 */ })
    })
  } catch {
    // 网络失败静默忽略，不影响主流程
  }
}

// Props: 参数化 4 个原文件的差异点
interface Props {
  /** 视频后缀 key：'bg' | '1' | '2' | '3' */
  videoKey: 'bg' | '1' | '2' | '3'
  /** 导航 key，对应 useNavigation 的步骤名：'rules' | 'rule1' | 'rule2' | 'rule3' */
  navKey: 'rules' | 'rule1' | 'rule2' | 'rule3'
  /** 标题前缀，如 '规则介绍' / '规则介绍（一）' */
  titlePrefix: string
}

const props = withDefaults(defineProps<Props>(), {
  videoKey: 'bg',
  navKey: 'rules',
  titlePrefix: '规则介绍',
})

const route = useRoute()

// 篇目ID（路由参数）
// R140: 必须是 computed。router-view 按 route.name 加 key，
// rules → rule1 会换实例，但 /rules/1 → /rules/2 是同路由换参数、实例复用，
// 写成 `route.params.id as string` 的话视频源和标题都停在第一篇。
const poemId = computed(() => String(route.params.id ?? ''))

// 使用导航composable（实时读当前路由，不再传快照值）
const { goNext, goPrev } = useNavigation()

// 使用埋点composable（navKey 用作 step_id）
const { trackInteraction } = useTracking(props.navKey, poemId.value)

// 包装 goPrev 以标记后退按钮
function handleGoPrev() {
  markNextEnterFromBackButton()
  goPrev()
}

/** 该编号的 rule 视频在 OSS 上是否真的存在 */
const assetReady = computed(() => hasRuleVideo(poemId.value))

/** 未就绪文案 */
const notReadyText = ASSET_NOT_READY_TEXT

/**
 * 当前篇目信息
 * 视频路径：/video/{wenId}_rule_{videoKey}.mp4
 * 使用 getAssetUrl 确保 OSS 环境正确加载
 */
const currentPoem = computed(() => {
  const wenId = getWenId(poemId.value)
  const title = getPoemTitle(poemId.value)

  // 动态拼接视频文件名，通过 getAssetUrl 获取完整 URL
  const videoFileName = `${wenId}_rule_${props.videoKey}.mp4`
  const videoUrl = getAssetUrl('video', videoFileName)

  return {
    title,
    videoUrl,
  }
})

// 页面挂载后静默预加载后续步骤的 chunk + 数据
onMounted(() => {
  if (!assetReady.value) return
  preloadUpstream(props.navKey, poemId.value)
})
</script>

<style scoped>
.rule-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: var(--spacing-xl);
  /* 底部为 fixed 的 BackContinue(约 64px) 留空间，防止溢出滚动 */
  padding-bottom: calc(var(--spacing-xl) + 64px);
  box-sizing: border-box;
  overflow: hidden;
}

.page-title {
  font-family: var(--font-family-serif);
  /* Figma 设计：规则标题使用 70px 字号（--font-size-subheading），SemiBold，居中 */
  font-size: var(--font-size-subheading);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  margin-bottom: var(--spacing-lg);
  text-align: center;
  flex-shrink: 0;
}

.video-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  /* 视频拉伸填满剩余空间，适配电脑端屏幕，避免出现上下滚动条 */
  align-items: stretch;
  justify-content: center;
}

/* 素材未就绪的降级占位：居中一段说明文字，不给黑色空视频框 */
.video-section.not-ready {
  align-items: center;
}

.not-ready-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  color: var(--color-text-secondary, #666);
  text-align: center;
  padding: var(--spacing-xl);
}

.not-ready-icon {
  font-size: 3rem;
  opacity: 0.6;
}

.not-ready-text {
  font-family: var(--font-family-serif);
  font-size: var(--font-size-body);
  margin: 0;
}
</style>
