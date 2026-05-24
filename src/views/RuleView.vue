<!--
  RuleView.vue - 规则介绍页面

  功能说明：
  - 展示视频播放器
  - 显示规则介绍标题
  - 左下角返回按钮，右下角继续按钮
-->
<template>
  <div class="rule-view">
    <!-- 顶部标题 -->
    <h1 class="page-title">规则介绍 - {{ currentPoem.title }}</h1>

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

const route = useRoute()

// 篇目ID
const poemId = route.params.id as string

// 使用导航composable
const { goNext, goPrev } = useNavigation('rules', poemId)

// 篇目数据映射（预留视频URL）
const poemMap: Record<string, { title: string; videoUrl: string }> = {
  '1': { title: '马说', videoUrl: '/videos/mashuo.mp4' },
  '2': { title: '陈涉世家', videoUrl: '/videos/chenlie_shijia.mp4' },
  '3': { title: '岳阳楼记', videoUrl: '/videos/yueyanglouji.mp4' },
  '4': { title: '庄子与惠子', videoUrl: '/videos/zhuangzi_huizi.mp4' },
}

/**
 * 当前篇目信息
 */
const currentPoem = computed(() => {
  return poemMap[poemId] || { title: '未知篇目', videoUrl: '/videos/default.mp4' }
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
