<template>
  <div class="poetry-menu">
    <!-- 菜单触发区：鼠标悬浮时显示下拉框 -->
    <div class="menu-trigger" @mouseenter="onMouseEnter" @mouseleave="onMouseLeave">
      📖 诗题选集
    </div>

    <!-- 下拉菜单列表，只有 showDropdown 为 true 时才显示 -->
    <ul
      class="dropdown"
      v-show="showDropdown"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
    >
      <li v-for="poem in poemList" :key="poem.wenId" @click="goToRules(poem.wenId)">
        {{ poem.title }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

// 响应式：控制下拉菜单显示/隐藏
const showDropdown = ref(false)
// 延时定时器
let hideTimer: number | null = null

function clearTimer() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

// 诗题列表数据（按 wenId 升序排列，顺序与 poemMap 一致）
const poemList = ref([
  { wenId: 'WEN_01', title: '陈涉世家' },
  { wenId: 'WEN_02', title: '马说' },
  { wenId: 'WEN_03', title: '岳阳楼记' },
  { wenId: 'WEN_04', title: '庄子与惠子' },
])

const router = useRouter()

/**
 * 跳转到规则介绍页
 * @param wenId - 课文ID，用于加载对应的视频
 */
function goToRules(wenId: string) {
  // 从 wenId 提取数字部分（如 WEN_01 -> 1）
  const poemId = wenId.replace(/\D/g, '')
  router.push({ name: 'rules', params: { id: poemId } })
}

function onMouseEnter() {
  clearTimer() // 取消即将发生的隐藏
  showDropdown.value = true
}

function onMouseLeave() {
  clearTimer() // 避免重复定时器
  hideTimer = setTimeout(() => {
    showDropdown.value = false
  }, 200) // 0.2秒后隐藏
}
</script>

<style scoped>
/* 菜单容器：固定在左侧，占屏幕宽度的 1/6 */
.poetry-menu {
  position: fixed;
  left: 0;
  top: 0;
  width: 16.666%; /* 六分之一 */
  height: 100vh;
  background-color: var(--color-placeholder);
  border-right: var(--border-width-hairline) solid var(--color-border);
  padding: var(--spacing-md);
  box-sizing: border-box;
}

/* 触发区样式 */
.menu-trigger {
  font-family: var(--font-family-serif);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
  padding: var(--spacing-xs) var(--spacing-sm);
  background-color: var(--color-bg-highlight);
  color: var(--color-text);
  cursor: default;
  border-radius: var(--radius-small);
  text-align: center;
}

/* 下拉菜单列表 */
.dropdown {
  list-style: none;
  margin: 0;
  padding: var(--spacing-xs) 0;
  background-color: var(--color-white);
  border: var(--border-width-hairline) solid var(--color-border);
  border-radius: var(--radius-small);
  box-shadow: var(--shadow-small);
  margin-top: var(--spacing-xs);
}

.dropdown li {
  padding: var(--spacing-xs) var(--spacing-md);
  cursor: pointer;
  color: var(--color-text);
  transition: background-color 0.2s ease;
}

.dropdown li:hover {
  background-color: var(--color-bg-highlight);
}
</style>
