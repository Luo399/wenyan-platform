<template>
  <div class="poetry-menu">
    <!-- 目录标题 -->
    <div class="menu-header">
      <span class="menu-title">诗题选集</span>
    </div>

    <!-- 诗文列表 -->
    <ul class="poem-list" ref="listEl">
      <li
        v-for="poem in poemList"
        :key="poem.wenId"
        class="poem-item"
        @click="handleSelect(poem.wenId)"
        @keydown.enter.prevent="handleSelect(poem.wenId)"
        @keydown.space.prevent="handleSelect(poem.wenId)"
        tabindex="0"
        role="link"
      >
        <span class="poem-link">{{ poem.title }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { getAllPoems, type PoemEntry } from '@/utils/wenUtils'
import { useNavigation } from '@/composables/useNavigation'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

// 诗题列表数据：从 wenUtils 统一读取，按 wenId 升序
const poemList: PoemEntry[] = getAllPoems()

const { goTo } = useNavigation()
const authStore = useAuthStore()
const router = useRouter()

/**
 * 跳转到规则介绍页
 * @param wenId - 课文ID，用于加载对应的视频
 */
function goToRules(wenId: string) {
  const targetPoem = poemList.find((p) => p.wenId === wenId)
  const poemId = targetPoem?.poemId ?? wenId.replace(/\D/g, '')
  goTo('rules', poemId)
}

/** 获取 poemId 的辅助函数 */
function getPoemIdFromWenId(wenId: string): string {
  const targetPoem = poemList.find((p) => p.wenId === wenId)
  return targetPoem?.poemId ?? wenId.replace(/\D/g, '')
}

/** 点击或键盘选择某项：跳转到规则页 */
function handleSelect(wenId: string) {
  if (!authStore.isLoggedIn) {
    // 未登录：跳转到学生登录页，携带 redirect 参数指向目标规则页
    const poemId = getPoemIdFromWenId(wenId)
    router.push(`/student-login?redirect=/rules/${poemId}`)
    return
  }
  goToRules(wenId)
}
</script>

<style scoped>
/* 菜单容器：固定在左侧，占屏幕宽度的 1/6 */
.poetry-menu {
  position: fixed;
  left: 0;
  top: 0;
  width: var(--sidebar-width);
  height: 100vh;
  background-color: var(--color-white);
  border-right: var(--border-width-hairline) solid var(--color-border);
  display: flex;
  flex-direction: column;
  z-index: 10;
}

/* 目录标题 */
.menu-header {
  padding: var(--spacing-lg) var(--spacing-md) var(--spacing-sm);
  border-bottom: var(--border-width-hairline) solid var(--color-border);
  flex-shrink: 0;
}

.menu-title {
  font-family: var(--font-family-serif);
  font-size: var(--font-size-subheading);
  font-weight: var(--font-weight-heavy);
  color: var(--color-primary);
  display: block;
  text-align: center;
  letter-spacing: 0.1em;
}

/* 诗文列表 */
.poem-list {
  list-style: none;
  margin: 0;
  padding: var(--spacing-sm) 0;
  flex: 1;
  overflow-y: auto;
  /* 滚动条样式 */
  scrollbar-width: thin;
  scrollbar-color: var(--color-placeholder) transparent;
}

.poem-list::-webkit-scrollbar {
  width: 4px;
}

.poem-list::-webkit-scrollbar-thumb {
  background-color: var(--color-placeholder);
  border-radius: 2px;
}

/* 每项诗文 */
.poem-item {
  padding: var(--spacing-xs) var(--spacing-md);
  cursor: pointer;
  transition: background-color 0.2s ease;
  outline: none;
  border-bottom: var(--border-width-hairline) solid rgba(0, 0, 0, 0.05);
}

.poem-item:last-child {
  border-bottom: none;
}

.poem-item:hover,
.poem-item:focus-visible {
  background-color: var(--color-bg-highlight);
}

.poem-item:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

/* 链接样式 - 与 HomeView 的 login-link 保持一致 */
.poem-link {
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
  line-height: 1.6;
  display: block;
  transition: color 0.2s ease;
}

.poem-item:hover .poem-link {
  color: var(--color-primary-hover);
}
</style>
