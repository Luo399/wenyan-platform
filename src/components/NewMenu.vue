<template>
  <div class="new-menu" :style="bgStyle">
    <!-- 标题图（Figma: article_list_title.png，顶部居中） -->
    <div class="menu-head">
      <img class="menu-title-img" :src="titleUrl" alt="课文选集" />
    </div>

    <!-- 卡片滚动区（Figma: card_scroll.png 容器 + poem_titles.png 横排诗题） -->
    <div
      class="poem-cards"
      :class="{ 'is-expanded': isExpanded }"
      ref="cardsEl"
      role="list"
      aria-label="课文列表"
    >
      <button
        v-for="poem in visiblePoems"
        :key="poem.wenId"
        type="button"
        class="poem-chip"
        :class="{ 'is-active': poem.wenId === activeWenId }"
        :ref="(el) => setChipRef(el, poem.wenId)"
        @click="handleSelect(poem.wenId)"
        role="listitem"
      >
        {{ poem.title }}
      </button>

      <!-- 查看更多 / 收起（Figma: btn_text_more.png 样式：朱红重字 + 5px 下划线） -->
      <button
        v-if="poemList.length > VISIBLE_LIMIT"
        type="button"
        class="more-btn"
        @click="toggleExpand"
      >
        <span class="more-text">{{ isExpanded ? '收起 ↑' : '查看更多→' }}</span>
        <span class="more-line" aria-hidden="true"></span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAllPoems, getWenId, type PoemEntry } from '@/utils/wenUtils'
import { useNavigation } from '@/composables/useNavigation'
import { useAuthStore } from '@/stores/auth'
import { getAssetUrl } from '@/utils/asset'

// ==== 设计稿资源（Figma 通用组件文件 → OSS images/general/） ====
const BG_URL = getAssetUrl('images', 'general/article_list_bg.png')
const TITLE_URL = getAssetUrl('images', 'general/article_list_title.png')

/** 诗题列表数据：37 篇，与旧 PoetryMenu 完全同源（wenUtils） */
const poemList: PoemEntry[] = getAllPoems()

/** 卡片区默认最多显示的诗题数量（超出部分由「查看更多」展开） */
const VISIBLE_LIMIT = 16

const { goTo } = useNavigation()
const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

// 展开/收起状态
const isExpanded = ref(false)
// 卡片滚动容器（用于滚动定位）
const cardsEl = ref<HTMLElement | null>(null)
// 每个诗题 chip 的 DOM 引用（用于高亮项的滚动定位）
const chipEls: Record<string, HTMLElement | null> = {}

// ==== 当前课文高亮 + 滚动定位 ====
// 优先使用调用方传入的 activePoemId；未传时尝试从路由（query.poem 或 params.id）解析
const activePoemId = ref<string>('')
const activeWenId = computed(() => {
  if (!activePoemId.value) return ''
  return getWenId(activePoemId.value)
})

/** 收集诗题 chip 的 DOM 引用 */
function setChipRef(el: unknown, wenId: string) {
  if (el) chipEls[wenId] = el as HTMLElement
}

/**
 * 同步路由/参数中的当前课文，并滚动高亮项到可视区。
 * 从其他页面返回时，对应诗题自动定位到卡片区中央。
 */
function syncActivePoem() {
  const fromQuery = String(route.query.poem || '')
  const fromParam = String(route.params.id || '')
  activePoemId.value = fromQuery || fromParam
}

watch(
  () => [route.query.poem, route.params.id],
  () => {
    syncActivePoem()
    scrollToActive()
  },
)

onMounted(() => {
  syncActivePoem()
  // 等首帧渲染完成后再定位，确保 chip 已挂载
  requestAnimationFrame(scrollToActive)
})

/** 将当前高亮诗题滚动到卡片区中央 */
function scrollToActive() {
  const cardEl = cardsEl.value
  const chipEl = activeWenId.value ? chipEls[activeWenId.value] : null
  if (!cardEl || !chipEl) return
  chipEl.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

// ==== 可见诗题（展开/收起） ====
const visiblePoems = computed<PoemEntry[]>(() => {
  if (isExpanded.value) return poemList
  return poemList.slice(0, VISIBLE_LIMIT)
})

function toggleExpand() {
  isExpanded.value = !isExpanded.value
  // 展开后把「查看更多」按钮滚到可视区，避免按钮被折叠内容顶出视野
  if (isExpanded.value) {
    requestAnimationFrame(() => scrollToActive())
  }
}

// ==== 跳转逻辑（从旧 PoetryMenu 原样移植） ====
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
  goTo('rules', getPoemIdFromWenId(wenId))
}

// 背景样式：设计稿背景图铺满整个面板
const bgStyle = computed(() => ({
  backgroundImage: `url(${BG_URL})`,
}))
const titleUrl = TITLE_URL
</script>

<style scoped>
/* 全屏文章列表面板：固定铺满视口，背景为 Figma article_list_bg.png */
.new-menu {
  position: fixed;
  inset: 0;
  z-index: 10;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
}

/* 顶部标题区 */
.menu-head {
  flex-shrink: 0;
  padding: var(--spacing-lg) 0 var(--spacing-md);
}

/* 标题图（Figma: article_list_title.png） */
.menu-title-img {
  width: clamp(280px, 30vw, 560px);
  height: auto;
  display: block;
}

/* 卡片滚动区（Figma: card_scroll.png 容器） */
.poem-cards {
  width: min(82%, 1400px);
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-xl) var(--spacing-xl) var(--spacing-2xl);
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: var(--spacing-md) var(--spacing-lg);
  /* 卡片容器背景：半透明米面，保留设计稿纵深感 */
  background-color: rgba(255, 255, 255, 0.72);
  border: var(--border-width-hairline) solid rgba(0, 0, 0, 0.08);
  border-radius: var(--radius-card);
  backdrop-filter: blur(6px);
  scrollbar-width: thin;
  scrollbar-color: var(--color-placeholder) transparent;
}

.poem-cards::-webkit-scrollbar {
  width: 4px;
}

.poem-cards::-webkit-scrollbar-thumb {
  background-color: var(--color-placeholder);
  border-radius: 2px;
}

/* 诗题项（Figma poem_titles.png：思源宋 Heavy 900，横向排列，多行换行） */
.poem-chip {
  border: none;
  background: none;
  padding: var(--spacing-xs) var(--spacing-md);
  cursor: pointer;
  font-family: var(--font-family-serif);
  font-weight: 900;
  font-size: clamp(1rem, 1.8vw, 1.75rem);
  color: var(--color-text);
  /* 预留下划线空间，避免高亮/聚焦时高度跳动 */
  border-bottom: 3px solid transparent;
  border-radius: var(--radius-small);
  line-height: 1.6;
  transition:
    color 0.2s ease,
    background-color 0.2s ease,
    border-color 0.2s ease;
}

.poem-chip:hover {
  color: var(--color-primary-hover);
  background-color: var(--color-bg-highlight);
}

.poem-chip:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* 当前课文：朱红文字 + 朱红下划线（对齐 btn_text_more 的 5px 朱红划线风格） */
.poem-chip.is-active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

/* 查看更多 / 收起按钮（Figma btn_text_more.png：朱红重字 + 5px 下划线） */
.more-btn {
  border: none;
  background: none;
  padding: var(--spacing-sm) var(--spacing-md);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.more-text {
  font-family: var(--font-family-serif);
  font-weight: 900;
  font-size: clamp(1rem, 1.6vw, 1.5rem);
  color: var(--color-primary);
}

.more-line {
  width: 120%;
  height: 5px;
  background-color: var(--color-primary);
}

.more-btn:hover .more-text {
  color: var(--color-primary-hover);
}
</style>
