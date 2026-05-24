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
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

#app {
  min-height: 100vh;
}

.top-bar {
  position: fixed;
  top: 0;
  right: 0;
  padding: 1rem;
  z-index: 100;
}
</style>
