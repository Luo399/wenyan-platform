<!--
  RuleView1.vue - 规则介绍页面（视频1）

  功能说明：
  - 展示视频播放器
  - 显示规则介绍标题
  - 左下角返回按钮，右下角继续按钮
  - 根据课文ID动态拼接视频路径（/video/{wenId}_rule_1.mp4）
  - 自动播放视频并循环播放
-->
<template>
  <div class="rule-view">
    <h1 class="page-title">规则介绍（一） - {{ currentPoem.title }}</h1>
    <div class="video-section">
      <VideoPlayer
        :src="currentPoem.videoUrl"
        :auto-play="true"
        :require-complete="true"
        @complete="onVideoComplete"
      />
    </div>
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

const route = useRoute()
const router = useRouter()
const poemId = route.params.id as string
const { goNext, goPrev } = useNavigation('rule1', poemId)

function onVideoComplete() {
  // 视频播放完成
}

function handleGoNext() {
  goNext(router)
}

function handleGoPrev() {
  goPrev(router)
}

const currentPoem = computed(() => {
  const wenId = getWenId(poemId)
  const title = getPoemTitle(poemId)
  const videoUrl = `/video/${wenId}_rule_1.mp4`

  return { title, videoUrl }
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
