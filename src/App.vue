<template>
  <div id="app">
    <!-- 右上角显示学号 -->
    <div class="top-bar">
      <StudentDisplay />
    </div>

    <!--
      R140: 按 route.name 给路由组件加 key。
      rules/rule1/rule2/rule3 共用 RuleVideoView、stepone/steptwo/stepthree 共用 StepView，
      vue-router 的 RouterView 不设 key，同组件跨路由时实例被复用，
      setup / onMounted 不会重跑，导致导航参数与埋点 step_enter 停在第一次进入的页面。
      加 key 后每条路由都是干净实例；同一路由内只换 :id 时仍然复用，
      由各自的 computed 响应参数变化（不会把正在播的视频打断）。
    -->
    <router-view :key="route.name ?? route.path" />

    <!-- 底部备案号 + 构建号（发布新鲜度阶段 1，见 src/utils/buildStamp.ts） -->
    <footer class="icp-footer">
      <a
        href="https://beian.miit.gov.cn"
        target="_blank"
        rel="noopener noreferrer"
        class="icp-link"
      >
        粤ICP备2026074888号-1
      </a>
      <BuildStamp />
    </footer>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import StudentDisplay from '@/components/StudentDisplay.vue'
import BuildStamp from '@/components/common/BuildStamp.vue'

// R140: 供 router-view 的 key 使用（见上方注释）
const route = useRoute()
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
