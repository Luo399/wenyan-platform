<template>
  <div id="app">
    <!-- 右上角显示学号 -->
    <div class="top-bar">
      <StudentDisplay />
    </div>

    <router-view />
  </div>
</template>

<script setup lang="ts">
import StudentDisplay from '@/components/StudentDisplay.vue'
</script>

<style>
/* 全局重置和 body 样式已由 design-tokens.css 统一管理 */
#app {
  min-height: 100vh;
  position: relative;
}

.top-bar {
  position: fixed;
  top: 0;
  right: 0;
  padding: var(--spacing-md);
  z-index: 100;
}
</style>
