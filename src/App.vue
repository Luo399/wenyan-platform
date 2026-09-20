<template>
  <div id="app">
    <!-- 右上角显示学号 -->
    <div class="top-bar">
      <StudentDisplay />
    </div>

    <router-view />

    <!-- 底部备案号 -->
    <footer class="icp-footer">
      <a
        href="https://beian.miit.gov.cn"
        target="_blank"
        rel="noopener noreferrer"
        class="icp-link"
      >
        粤ICP备2026074888号-1
      </a>
    </footer>
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

/* 底部备案号 */
.icp-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  text-align: center;
  padding: 8px 16px;
  font-size: 12px;
  z-index: 99;
  pointer-events: none;
}

.icp-link {
  color: #999;
  text-decoration: none;
  pointer-events: auto;
  transition: color 0.2s ease;
}

.icp-link:hover {
  color: #666;
}
</style>
