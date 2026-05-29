<template>
  <div class="not-found-container">
    <div class="not-found-content">
      <div class="icon">
        <i class="fas fa-search"></i>
      </div>
      <h1>404</h1>
      <p class="message">页面未找到</p>
      <p class="description">您访问的页面不存在或已被移动</p>
      <button class="back-btn" @click="goBack">
        <i class="fas fa-arrow-left"></i>
        返回首页
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function goBack() {
  router.push('/')
}
</script>

<style scoped>
.not-found-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f7fa;
}

.not-found-content {
  text-align: center;
  padding: 2rem;
}

.icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #e5e7eb;
  border-radius: 50%;
  font-size: 2rem;
  color: #6b7280;
}

h1 {
  font-size: 4rem;
  margin: 0 0 0.5rem;
  color: #374151;
}

.message {
  font-size: 1.25rem;
  margin: 0 0 0.5rem;
  color: #374151;
}

.description {
  font-size: 0.875rem;
  margin: 0 0 1.5rem;
  color: #6b7280;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.back-btn:hover {
  background-color: #2563eb;
}
</style>
