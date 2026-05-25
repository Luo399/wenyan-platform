<!--
  RuleView2.vue - 规则介绍页面（视频2）

  功能说明：
  - 展示视频播放器
  - 显示规则介绍标题
  - 左下角返回按钮，右下角继续按钮
  - 根据课文ID动态拼接视频路径（/video/{wenId}_rule_2.mp4）
-->
<template>
  <div class="rule-view">
    <!-- 顶部标题 -->
    <h1 class="page-title">规则介绍（二） - {{ currentPoem.title }}</h1>

    <!-- 视频播放器 - 平铺整个宽度 -->
    <div class="video-section">
      <VideoPlayer :src="currentPoem.videoUrl" />
    </div>

    <!-- 底部导航按钮 -->
    <BackContinue back-text="返回" continue-text="继续" @back="goPrev" @continue="goNext" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import VideoPlayer from '@/components/VideoPlayer.vue'
import BackContinue from '@/components/BackContinue.vue'
import { useNavigation } from '@/composables/useNavigation'
import { getWenId, getPoemTitle } from '@/utils/wenUtils'

const route = useRoute()

// 篇目ID（路由参数）
const poemId = route.params.id as string

// 使用导航composable
const { goNext, goPrev } = useNavigation('rule2', poemId)

/**
 * 当前篇目信息
 * 视频路径：/video/{wenId}_rule_2.mp4
 */
const currentPoem = computed(() => {
  const wenId = getWenId(poemId)
  const title = getPoemTitle(poemId)

  // 动态拼接视频路径
  // 视频文件位于 public/video/ 目录下，命名格式：WEN_xx_rule_2.mp4
  const videoUrl = `/video/${wenId}_rule_2.mp4`

  return {
    title,
    videoUrl,
  }
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
