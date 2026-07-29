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
/* 404 容器：居中铺满 */
.not-found-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-placeholder);
}

.not-found-content {
  text-align: center;
  padding: var(--spacing-xl);
}

.icon {
  width: 80px;
  height: 80px;
  margin: 0 auto var(--spacing-md);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-placeholder);
  border-radius: 50%;
  font-size: var(--font-size-heading);
  color: var(--color-text-secondary);
}

h1 {
  font-family: var(--font-family-serif);
  font-size: var(--font-size-display);
  font-weight: var(--font-weight-heavy);
  margin: 0 0 var(--spacing-xs);
  color: var(--color-text);
}

.message {
  font-family: var(--font-family-serif);
  font-size: var(--font-size-subheading);
  font-weight: var(--font-weight-semibold);
  margin: 0 0 var(--spacing-xs);
  color: var(--color-text);
}

.description {
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  margin: 0 0 var(--spacing-lg);
  color: var(--color-text-secondary);
}

/* 返回按钮：朱红底 + 橄榄绿边框 + 50px 圆角 */
.back-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-lg);
  background-color: var(--color-primary);
  color: var(--color-white);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-button);
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.back-btn:hover {
  background-color: var(--color-primary-hover);
}
</style>
