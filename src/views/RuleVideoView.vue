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
const poemId = route.params.id as string

// 使用导航composable
const { goNext, goPrev } = useNavigation(props.navKey, poemId)

/**
 * 当前篇目信息
 * 视频路径：/video/{wenId}_rule_{videoKey}.mp4
 */
const currentPoem = computed(() => {
  const wenId = getWenId(poemId)
  const title = getPoemTitle(poemId)

  // 动态拼接视频路径
  // 视频文件位于 public/video/ 目录下，命名格式：WEN_xx_rule_{videoKey}.mp4
  const videoUrl = `/video/${wenId}_rule_${props.videoKey}.mp4`

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
