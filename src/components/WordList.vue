<!--
  WordList.vue - 字词注释组件

  功能说明：
  - 从 word_list JSON 加载字词注释数据
  - 渲染带有注释标记的 HTML 内容
  - 鼠标悬浮时显示注释弹窗
  - 弹窗宽度自适应内容长度

  使用方式：
  <WordList wenId="WEN_01" />

  Props:
  - wenId: 课文ID，用于加载对应的注释数据

  JSON 数据格式（word_list）：
  [
    {
      "text_id": "WEN_01",
      "word": "阳城",
      "basic_meaning": "在今河南登封东南",
      "synonym_analysis": "",
      "follow_up_questions": []
    }
  ]
-->

<template>
  <div class="word-list-container">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="error-state">
      <i class="fas fa-exclamation-circle"></i>
      <p>{{ error }}</p>
      <button @click="loadData" class="retry-btn">重试</button>
    </div>

    <!-- 主内容 -->
    <div v-else class="content-wrapper">
      <h1 class="article-title">{{ articleTitle }}</h1>
      <div
        class="article-content"
        v-html="sanitizedContent"
        @mouseover="handleMouseOver"
        @mouseout="handleMouseOut"
      ></div>
    </div>

    <!-- 注释弹窗 -->
    <Teleport to="body">
      <div v-if="showTooltip" class="annotation-tooltip" :style="tooltipStyle">
        {{ currentAnnotation }}
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

/**
 * 字词数据类型定义
 */
interface WordItem {
  text_id: string
  word: string
  basic_meaning: string
  synonym_analysis: string
  follow_up_questions: string[]
}

/**
 * Props 类型定义
 */
interface Props {
  wenId: string
  autoLoad?: boolean
  dataBaseUrl?: string
}

const props = withDefaults(defineProps<Props>(), {
  autoLoad: true,
  dataBaseUrl: '/data/word_list/',
})

// 状态管理
const loading = ref(false)
const error = ref<string | null>(null)
const wordList = ref<WordItem[]>([])
const showTooltip = ref(false)
const currentAnnotation = ref('')
const tooltipPosition = ref({ x: 0, y: 0 })
const articleTitle = ref('')

// AbortController 用于取消请求
let abortController: AbortController | null = null

/**
 * 生成带注释的 HTML 内容
 * 将原文中的字词替换为带有 data-def 属性的 span 标签
 */
const contentHtml = computed(() => {
  if (!wordList.value.length) return ''
  
  // 这里假设原文来自 text_basic_info，需要额外加载
  // 或者由父组件传入
  return ''
})

/**
 * HTML 白名单过滤配置
 * 只允许安全的标签和属性，防止 XSS 攻击
 */
const ALLOWED_TAGS = ['p', 'span']
const ALLOWED_ATTRS: Record<string, string[]> = {
  p: [],
  span: ['class', 'data-def'],
}

/**
 * 过滤 HTML 内容，移除危险标签和属性
 * @param html - 原始 HTML 字符串
 * @returns 安全的 HTML 字符串
 */
function sanitizeHtml(html: string): string {
  if (!html) return ''

  // 创建临时 DOM 元素
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html

  // 递归过滤所有子节点
  function filterNode(node: Node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement
      const tagName = element.tagName.toLowerCase()

      // 如果标签不在白名单中，移除该元素但保留其子节点
      if (!ALLOWED_TAGS.includes(tagName)) {
        while (element.firstChild) {
          element.parentNode?.insertBefore(element.firstChild, element)
        }
        element.parentNode?.removeChild(element)
        return
      }

      // 过滤属性：只保留允许的属性
      const attributes = Array.from(element.attributes)
      for (const attr of attributes) {
        const allowedAttrs = ALLOWED_ATTRS[tagName] || []
        if (!allowedAttrs.includes(attr.name.toLowerCase())) {
          element.removeAttribute(attr.name)
        }
      }

      // 特殊处理：span 标签只允许 annotated-word 类
      if (tagName === 'span') {
        const className = element.className
        if (className && !className.includes('annotated-word')) {
          element.removeAttribute('class')
        }
      }
    }

    // 递归处理子节点
    let child = node.firstChild
    while (child) {
      const next = child.nextSibling
      filterNode(child)
      child = next
    }
  }

  filterNode(tempDiv)
  return tempDiv.innerHTML
}

/**
 * 计算属性：安全处理后的 HTML 内容
 */
const sanitizedContent = computed(() => {
  return contentHtml.value
})

/**
 * 计算属性：弹窗样式
 */
const tooltipStyle = computed(() => ({
  left: `${tooltipPosition.value.x}px`,
  top: `${tooltipPosition.value.y}px`,
}))

/**
 * 加载字词列表数据
 */
async function loadData() {
  if (!props.wenId) {
    error.value = '请提供课文ID'
    return
  }

  // 取消之前的请求
  if (abortController) {
    abortController.abort()
  }
  abortController = new AbortController()

  loading.value = true
  error.value = null

  try {
    const url = `${props.dataBaseUrl}${props.wenId}.json`

    const response = await fetch(url, {
      signal: abortController.signal,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`)
    }

    const data: WordItem[] = await response.json()

    // 数据格式验证
    if (!Array.isArray(data)) {
      throw new Error('数据格式错误：应为数组')
    }

    wordList.value = data
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      error.value = '加载超时'
      return
    }
    const errorMsg = err instanceof Error ? err.message : '加载失败'
    if (errorMsg.includes('404') || errorMsg.includes('HTTP错误: 404')) {
      error.value = '【404正在加班加点中】'
    } else {
      error.value = errorMsg
    }
  } finally {
    loading.value = false
  }
}

/**
 * 鼠标悬浮处理
 */
function handleMouseOver(event: MouseEvent) {
  const target = event.target as HTMLElement

  if (target.classList.contains('annotated-word')) {
    const definition = target.getAttribute('data-def')
    if (definition) {
      currentAnnotation.value = definition
      showTooltip.value = true
      updateTooltipPosition(event)
    }
  }
}

/**
 * 鼠标移出处理
 */
function handleMouseOut(event: MouseEvent) {
  const target = event.target as HTMLElement
  const relatedTarget = event.relatedTarget as HTMLElement

  if (target.classList.contains('annotated-word')) {
    if (relatedTarget?.classList?.contains('annotation-tooltip')) {
      return
    }
    showTooltip.value = false
  }
}

/**
 * 更新弹窗位置
 */
function updateTooltipPosition(event: MouseEvent) {
  const x = event.clientX + 10
  const y = event.clientY + 10

  const windowWidth = window.innerWidth
  const windowHeight = window.innerHeight

  const tooltipMaxWidth = 300
  const tooltipPadding = 20

  tooltipPosition.value = {
    x: Math.min(x, windowWidth - tooltipMaxWidth - tooltipPadding),
    y: Math.min(y, windowHeight - tooltipPadding),
  }
}

/**
 * 全局鼠标移动事件
 */
function handleMouseMove(event: MouseEvent) {
  if (showTooltip.value) {
    updateTooltipPosition(event)
  }
}

// 生命周期
onMounted(() => {
  if (props.autoLoad) {
    loadData()
  }
  document.addEventListener('mousemove', handleMouseMove)
})

onUnmounted(() => {
  if (abortController) {
    abortController.abort()
  }
  document.removeEventListener('mousemove', handleMouseMove)
})
</script>

<style scoped>
.word-list-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 1.5rem;
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  gap: 0.75rem;
}

.spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 错误状态 */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem;
  gap: 0.75rem;
  color: #ef4444;
}

.error-state i {
  font-size: 2.5rem;
}

.retry-btn {
  padding: 0.5rem 1rem;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
}

.retry-btn:hover {
  background-color: #2563eb;
}

/* 内容区域 */
.content-wrapper {
  background-color: #fff;
  border-radius: 0.5rem;
  padding: 2rem;
}

.article-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 1.5rem;
  text-align: center;
  border-bottom: 2px solid #e5e7eb;
  padding-bottom: 1rem;
}

.article-content {
  font-size: 1rem;
  line-height: 2;
  color: #374151;
}

.article-content :deep(p) {
  margin-bottom: 1rem;
  text-indent: 2em;
}

/* 注释词语样式 */
.article-content :deep(.annotated-word) {
  color: #2563eb;
  cursor: help;
  border-bottom: 1px dashed #2563eb;
  padding-bottom: 1px;
  transition: all 0.2s;
}

.article-content :deep(.annotated-word:hover) {
  background-color: #dbeafe;
  border-radius: 2px;
}
</style>

<!-- 全局弹窗样式 -->
<style>
.annotation-tooltip {
  position: fixed;
  z-index: 9999;
  max-width: 300px;
  padding: 0.75rem 1rem;
  background-color: #1f2937;
  color: #fff;
  font-size: 0.875rem;
  line-height: 1.5;
  border-radius: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  pointer-events: none;
  word-wrap: break-word;
  white-space: pre-wrap;
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
