<template>
  <div class="home" :style="{ backgroundImage: `url(${bgUrl})` }">
    <PoetryMenu />

    <div class="main-content">
      <h1>文言文预习平台</h1>
      <p>请从左侧菜单选择篇目开始学习</p>

      <!-- 未登录时显示学号输入卡片 -->
      <div v-if="!isLoggedIn" class="login-card">
        <StudentLogin />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import PoetryMenu from '@/components/PoetryMenu.vue'
import StudentLogin from '@/components/StudentLogin.vue'
import { useStudentStore } from '@/stores/student'
import { storeToRefs } from 'pinia'
import { getAssetUrl } from '@/utils/asset'
import { track } from '@/utils/tracking'

const studentStore = useStudentStore()
const { isLoggedIn } = storeToRefs(studentStore)

// 首页埋点
onMounted(() => {
  track('step_enter', 'home', {})
})

// 登录页背景图（Figma 设计稿）
const bgUrl = getAssetUrl('images', 'WEN_01_bg_login.png')
</script>

<style scoped>
.home {
  display: flex;
  min-height: 100vh;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-attachment: fixed;
}

.main-content {
  margin-left: var(--sidebar-width); /* 与 PoetryMenu 宽度同步 */
  padding: var(--spacing-2xl);
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.main-content h1 {
  font-size: var(--font-size-display);
  font-weight: var(--font-weight-heavy);
  color: var(--color-primary);
  margin-bottom: var(--spacing-sm);
  text-shadow: 0 2px 8px rgba(255, 255, 255, 0.6);
}

.main-content p {
  color: var(--color-text);
  font-size: var(--font-size-body);
  margin-bottom: var(--spacing-xl);
  text-shadow: 0 1px 4px rgba(255, 255, 255, 0.6);
}

/* 学号输入卡片 - Figma 设计：圆角 30px + 阴影 */
.login-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  max-width: 500px;
  width: 100%;
}
</style>
