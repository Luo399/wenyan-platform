<template>
  <div class="poetry-menu">
    <!--
      R41: 菜单触发按钮改 button（可聚焦、可键盘激活）
      aria-haspopup=true + aria-expanded 说明当前有下拉菜单
    -->
    <button
      type="button"
      class="menu-trigger"
      aria-haspopup="menu"
      :aria-expanded="showDropdown"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
      @click="toggleDropdown"
      @keydown.enter.prevent="toggleDropdown"
      @keydown.space.prevent="toggleDropdown"
      @keydown.arrow-down.prevent="focusFirstItem"
      @keydown.esc="closeDropdown"
    >
      📖 诗题选集
    </button>

    <!--
      下拉菜单使用 role=menu，支持 ESC 关闭、方向键导航
      外层 tabindex=-1 仅用于编程式 focus，不参与正常 Tab 顺序
    -->
    <ul
      ref="menuEl"
      class="dropdown"
      v-show="showDropdown"
      role="menu"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
      @keydown.esc="closeDropdown"
    >
      <li
        v-for="(poem, index) in poemList"
        :key="poem.wenId"
        :ref="(el) => setItemRef(el as HTMLElement | null, index)"
        role="menuitem"
        tabindex="-1"
        class="menu-item"
        @click="handleSelect(poem.wenId, index)"
        @keydown.enter.prevent="handleSelect(poem.wenId, index)"
        @keydown.space.prevent="handleSelect(poem.wenId, index)"
        @keydown.arrow-down.prevent="focusItem(index + 1)"
        @keydown.arrow-up.prevent="focusItem(index - 1)"
        @keydown.home.prevent="focusFirstItem"
        @keydown.end.prevent="focusLastItem"
        @keydown.tab="onTabAway"
      >
        {{ poem.title }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { getAllPoems, type PoemEntry } from '@/utils/wenUtils'

// 响应式：控制下拉菜单显示/隐藏
const showDropdown = ref(false)
// 延时定时器：鼠标离开后延时隐藏（200ms）
let hideTimer: ReturnType<typeof setTimeout> | null = null
// DOM 引用：menu 容器与所有 menuitem，用于键盘方向键导航
const menuEl = ref<HTMLUListElement | null>(null)
const itemRefs: (HTMLElement | null)[] = []

function setItemRef(el: HTMLElement | null, index: number) {
  itemRefs[index] = el
}

function clearTimer() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

// 诗题列表数据：从 wenUtils 统一读取，按 wenId 升序
// 静态数据，无需 ref 包裹
const poemList: PoemEntry[] = getAllPoems()

const router = useRouter()

/**
 * 跳转到规则介绍页
 * @param wenId - 课文ID，用于加载对应的视频
 */
function goToRules(wenId: string) {
  // 从 poemList 查找匹配的 poemId，避免正则提取
  const targetPoem = poemList.find((p) => p.wenId === wenId)
  const poemId = targetPoem?.poemId ?? wenId.replace(/\D/g, '')
  router.push({ name: 'rules', params: { id: poemId } })
}

function closeDropdown() {
  showDropdown.value = false
  clearTimer()
}

/** 打开下拉，随后 focus 第一个 menuitem（R41：键盘可用性） */
async function openDropdown() {
  clearTimer()
  if (showDropdown.value) return
  showDropdown.value = true
  await nextTick()
  focusFirstItem()
}

function toggleDropdown() {
  if (showDropdown.value) {
    closeDropdown()
  } else {
    openDropdown()
  }
}

function focusItem(index: number) {
  const len = itemRefs.length
  if (len === 0) return
  const clamped = ((index % len) + len) % len
  const el = itemRefs[clamped]
  if (el) el.focus({ preventScroll: false })
}

function focusFirstItem() {
  focusItem(0)
}
function focusLastItem() {
  focusItem(poemList.length - 1)
}

/** Tab 离开菜单时自动关闭（符合"焦点离开 → 关闭"直觉） */
function onTabAway() {
  closeDropdown()
}

/** 点击或键盘选择某项：关闭菜单并跳转 */
function handleSelect(wenId: string, _index: number) {
  goToRules(wenId)
  closeDropdown()
}

function onMouseEnter() {
  clearTimer()
  showDropdown.value = true
}

function onMouseLeave() {
  clearTimer()
  hideTimer = setTimeout(() => {
    showDropdown.value = false
    hideTimer = null
  }, 200)
}

onBeforeUnmount(() => {
  clearTimer()
})
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
  /* 保持视觉上与原来的 div 一致；button 默认的 border/outline 通过重置消除 */
  border: none;
  outline: none;
  width: 100%;
  font-family: var(--font-family-serif);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
  padding: var(--spacing-xs) var(--spacing-sm);
  background-color: var(--color-bg-highlight);
  color: var(--color-text);
  cursor: pointer;
  border-radius: var(--radius-small);
  text-align: center;
}

.menu-trigger:focus-visible {
  /* 键盘 focus 时显式加轮廓，符合 a11y 焦点可见性要求 */
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
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

.dropdown .menu-item {
  padding: var(--spacing-xs) var(--spacing-md);
  cursor: pointer;
  color: var(--color-text);
  transition: background-color 0.2s ease;
  /* menuitem 是 li+tabindex=-1，focus 时显式高亮，确保键盘用户知道当前焦点 */
  outline: none;
}

.dropdown .menu-item:hover,
.dropdown .menu-item:focus {
  background-color: var(--color-bg-highlight);
}
</style>
