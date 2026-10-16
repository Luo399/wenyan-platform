<template>
  <div class="new-home">
    <!-- 新选篇面板（逻辑完全迁移自 PoetryMenu，视觉对齐 Figma article_list 系列） -->
    <NewMenu />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import NewMenu from '@/components/NewMenu.vue'
import { track } from '@/utils/tracking'

// 首页埋点
const enterTime = Date.now()
onMounted(() => {
  track('step_enter', 'home', {})
})
onUnmounted(() => {
  const duration = Date.now() - enterTime
  track('step_exit', 'home', { duration })
})
</script>

<style scoped>
.new-home {
  min-height: 100vh;
}
</style>
