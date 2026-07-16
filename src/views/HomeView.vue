<template>
  <div class="home">
    <PoetryMenu />

    <div class="main-content">
      <h1>文言文预习平台</h1>
      <p>请从左侧菜单选择篇目开始学习</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import PoetryMenu from '@/components/PoetryMenu.vue'
</script>

<style scoped>
.home {
  display: flex;
}

.main-content {
  margin-left: 16.666%;
  padding: 2rem;
  flex: 1;
}

.main-content h1 {
  margin-bottom: 0.5rem;
}

.main-content p {
  color: #6b7280;
  margin-bottom: 2rem;
}
</style>
