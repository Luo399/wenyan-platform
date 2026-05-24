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
  </div>
</template>

<script setup lang="ts">
import PoetryMenu from '@/components/PoetryMenu.vue'
import StudentLogin from '@/components/StudentLogin.vue'
import { useStudentStore } from '@/stores/student'
import { storeToRefs } from 'pinia'

const studentStore = useStudentStore()
const { isLoggedIn } = storeToRefs(studentStore)
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
</style>
