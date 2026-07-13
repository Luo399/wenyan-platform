<template>
  <div class="home">
    <PoetryMenu />

    <div class="main-content">
      <h1>文言文预习平台</h1>
      <p>请从左侧菜单选择篇目开始学习</p>

      <!-- 未登录时显示学号输入卡片 -->
      <div v-if="!isLoggedIn" class="login-card">
        <StudentLogin />
      </div>
    </div>

    <!-- 教师登录按钮 -->
    <router-link to="/answer-query" class="teacher-login-btn"> 教师登录 </router-link>
  </div>
</template>

<script setup lang="ts">
import PoetryMenu from '@/components/PoetryMenu.vue'
import StudentLogin from '@/components/StudentLogin.vue'
import { useAuthStore } from '@/stores/auth'
import { computed } from 'vue'

const authStore = useAuthStore()
const isLoggedIn = computed(() => authStore.isLoggedIn)
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

/* 学号输入卡片样式 */
.login-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  max-width: 400px;
}

/* 教师登录按钮 */
.teacher-login-btn {
  position: fixed;
  right: 2rem;
  bottom: 2rem;
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 500;
  text-decoration: none;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
  transition: all 0.2s ease;
  cursor: pointer;
}

.teacher-login-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(79, 70, 229, 0.5);
}

.teacher-login-btn:active {
  transform: translateY(0);
}
</style>
