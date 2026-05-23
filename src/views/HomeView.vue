<template>
  <div class="home">
    <PoetryMenu />
    <!-- 这里可以放一些欢迎语或默认内容，但主功能就是菜单 -->
    <div class="welcome">
      <h1>文言文预习平台</h1>
      <p>请从左侧菜单选择篇目开始学习</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import PoetryMenu from '@/views/PoetryMenu.vue'
</script>

<style scoped>
.home {
  display: flex;
}
.welcome {
  margin-left: 16.666%;  /* 固定的左侧菜单 */
  padding: 2rem;
}
</style>
