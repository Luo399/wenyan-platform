<!--
  RuleView.vue - 规则介绍页面（背景视频）

  功能说明：
  - 展示视频播放器
  - 显示规则介绍标题
  - 左下角返回按钮，右下角继续按钮
  - 根据课文ID动态拼接视频路径（/video/{wenId}_rule_bg.mp4）
  - 自动播放视频并检测播放完成
-->
<template>
  <div class="rule-view">
    <!-- 顶部标题 -->
    <h1 class="page-title">规则介绍 - {{ currentTitle }}</h1>

    <!-- 视频播放器 - 平铺整个宽度 -->
    <div class="video-section">
      <VideoPlayer
        :src="videoUrl"
        :auto-play="true"
        :require-complete="true"
        @complete="onVideoComplete"
      />
    </div>

    <!-- 底部导航按钮 -->
    <BackContinue
      back-text="返回"
      continue-text="继续"
      @back="handleGoPrev"
      @continue="handleGoNext"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import VideoPlayer from '@/components/VideoPlayer.vue'
import BackContinue from '@/components/BackContinue.vue'
import { useNavigation } from '@/composables/useNavigation'
import { getWenId, getPoemTitle } from '@/utils/wenUtils'
import { getAssetUrl } from '@/utils/asset'

const route = useRoute()
const router = useRouter()

// 篇目ID（路由参数）
const poemId = route.params.id as string

// 使用导航composable（新版，需要传入router）
const { goNext, goPrev } = useNavigation('rules', poemId)

/**
 * 处理视频播放完成
 */
function onVideoComplete() {
  // 视频播放完成，可添加后续逻辑
}

/**
 * 导航函数包装
 */
function handleGoNext() {
  goNext(router)
}

function handleGoPrev() {
  goPrev(router)
}

/**
 * 当前篇目标题
 */
const currentTitle = computed(() => getPoemTitle(poemId))

/**
 * 视频路径
 * 使用独立 computed 避免对象创建导致的响应式问题
 */
const videoUrl = computed(() => {
  const wenId = getWenId(poemId)
  // 视频文件位于 public/video/ 目录下，命名格式：WEN_xx_rule_bg.mp4
  return getAssetUrl(`video/${wenId}_rule_bg.mp4`)
})
</script>

<style scoped>
.rule-view {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 2rem;
  padding-bottom: 5rem;
}

.page-title {
  font-size: 1.5rem;
  color: #374151;
  margin-bottom: 1.5rem;
  text-align: center;
}

.video-section {
  flex: 1;
  max-width: 100%;
}
</style>
