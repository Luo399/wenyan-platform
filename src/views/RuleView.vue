<!--
  RuleView.vue - 规则介绍页面

  功能说明：
  - 根据篇目ID加载对应的视频
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
    <div class="bottom-bar">
      <button class="nav-btn back-btn" @click="handleBack">
        <i class="fas fa-arrow-left"></i>
        返回
      </button>
      <button class="nav-btn continue-btn" @click="handleContinue">
        继续
        <i class="fas fa-arrow-right"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import VideoPlayer from '@/components/VideoPlayer.vue'

const route = useRoute()
const router = useRouter()

// 篇目ID
const poemId = Number(route.params.id) || 1

// 篇目数据映射（预留视频URL）
const poemMap: Record<number, { title: string; videoUrl: string }> = {
  1: { title: '马说', videoUrl: '/videos/mashuo.mp4' },
  2: { title: '陈涉世家', videoUrl: '/videos/chenlie_shijia.mp4' },
  3: { title: '岳阳楼记', videoUrl: '/videos/yueyanglouji.mp4' },
  4: { title: '庄子与惠子', videoUrl: '/videos/zhuangzi_huizi.mp4' },
}

/**
 * 当前篇目信息
 */
const currentPoem = computed(() => {
  return poemMap[poemId] || { title: '未知篇目', videoUrl: '/videos/default.mp4' }
})

/**
 * 返回上一页
 */
function handleBack() {
  router.back()
}

/**
 * 继续到详情页
 */
function handleContinue() {
  router.push({ name: 'detail', params: { id: poemId } })
}
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

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 1rem 2rem;
  background: linear-gradient(to top, rgba(255, 255, 255, 1) 60%, rgba(255, 255, 255, 0));
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn {
  background-color: #e5e7eb;
  color: #374151;
}

.back-btn:hover {
  background-color: #d1d5db;
}

.continue-btn {
  background-color: #3b82f6;
  color: white;
}

.continue-btn:hover {
  background-color: #2563eb;
}
</style>
