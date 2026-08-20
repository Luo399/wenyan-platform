<template>
  <div class="poetry-menu" :style="rootStyle">
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
import { computed, onMounted, ref } from 'vue'
import { getAllPoems, type PoemEntry } from '@/utils/wenUtils'
import { useNavigation } from '@/composables/useNavigation'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { getStyleUrl } from '@/utils/asset'

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

// ==== 远端样式（styles/Navigation.json，美术在 Figma 编辑后经插件同步） ====
/**
 * 远端样式的默认状态对象，形如：
 *   { backgroundColor, textColor, fontFamily, fontSize, fontWeight,
 *     paddingTop/Right/Bottom/Left, itemSpacing }
 * 读取失败时保持 null，组件回退到本地设计 token。
 */
const remoteDefaultStyle = ref<Record<string, any> | null>(null)

/** 把远端样式归一化为根节点内联样式对象 */
const rootStyle = computed<Record<string, string>>(() => {
  const s = remoteDefaultStyle.value
  if (!s) return {}
  const style: Record<string, string> = {}
  if (s.backgroundColor) style.backgroundColor = String(s.backgroundColor)
  if (s.textColor) style.color = String(s.textColor)
  if (s.fontFamily) style.fontFamily = String(s.fontFamily)
  if (s.fontSize) style.fontSize = `${Number(s.fontSize)}px`
  if (s.fontWeight) style.fontWeight = String(s.fontWeight)
  if (s.cornerRadius !== undefined) style.borderRadius = `${Number(s.cornerRadius)}px`
  if (s.paddingTop !== undefined || s.paddingBottom !== undefined) {
    style.paddingTop = s.paddingTop !== undefined ? `${Number(s.paddingTop)}px` : '0px'
    style.paddingBottom = s.paddingBottom !== undefined ? `${Number(s.paddingBottom)}px` : '0px'
    style.paddingLeft = s.paddingLeft !== undefined ? `${Number(s.paddingLeft)}px` : '0px'
    style.paddingRight = s.paddingRight !== undefined ? `${Number(s.paddingRight)}px` : '0px'
  }
  if (s.itemSpacing !== undefined) style.rowGap = `${Number(s.itemSpacing)}px`
  return style
})

/** 挂载后尝试加载 Navigation 组件的默认状态样式 */
onMounted(async () => {
  try {
    const response = await fetch(getStyleUrl('Navigation'), {
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) return
    const data = await response.json()
    // 兼容不同大小写的状态名：优先取小写 default/active/hover
    const states = data?.states || {}
    remoteDefaultStyle.value = states.default || states.Default || null
  } catch {
    // 加载失败不阻塞，使用本地设计 token 默认样式
  }
})
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
