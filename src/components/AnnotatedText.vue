<!--
  AnnotatedText.vue - 注释文本组件

  功能说明：
  - 从 JSON 加载课文内容和注释数据
  - 渲染带有注释标记的 HTML 内容
  - 鼠标悬浮时显示注释弹窗
  - 弹窗宽度自适应内容长度

  使用方式：
  <AnnotatedText wenId="WEN_01" />

  Props:
  - wenId: 课文ID，用于加载对应的注释数据

  JSON 数据格式：
  {
    "title": "陈涉世家（节选）",
    "content": "<p>陈胜者，<span class=\"annotated-word\" data-def=\"注释内容\">阳城</span>人也...</p>"
  }

  注意：JSON 文件路径待确定，当前使用占位路径
-->

<template>
  <div class="annotated-text-container">
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
      <h1 class="article-title">{{ articleData?.title }}</h1>
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
 * 课文数据类型定义
 */
interface ArticleData {
  title: string
  content: string
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
  dataBaseUrl: '/data/annotated/',
})

// 状态管理
const loading = ref(false)
const error = ref<string | null>(null)
const articleData = ref<ArticleData | null>(null)
const showTooltip = ref(false)
const currentAnnotation = ref('')
const tooltipPosition = ref({ x: 0, y: 0 })

// AbortController 用于取消请求
let abortController: AbortController | null = null

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
 * 使用白名单机制过滤危险标签和属性，防止 XSS 攻击
 */
const sanitizedContent = computed(() => {
  return sanitizeHtml(articleData.value?.content || '')
})

/**
 * 计算属性：弹窗样式
 */
const tooltipStyle = computed(() => ({
  left: `${tooltipPosition.value.x}px`,
  top: `${tooltipPosition.value.y}px`,
}))

/**
 * 加载课文数据
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
    // TODO: 替换为实际的 API 路径
    // 当前使用占位路径：${dataBaseUrl}${wenId}.json
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

    const data: ArticleData = await response.json()

    // 数据格式验证
    if (!data.title || !data.content) {
      throw new Error('数据格式错误：缺少 title 或 content 字段')
    }

    articleData.value = data
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return
    }
    const errorMsg = err instanceof Error ? err.message : '加载失败'
    error.value = errorMsg
  } finally {
    loading.value = false
  }
}

/**
 * 鼠标悬浮处理
 * 检测是否悬浮在带有 data-def 属性的元素上
 */
function handleMouseOver(event: MouseEvent) {
  const target = event.target as HTMLElement

  // 检查是否是注释词语
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

  // 检查是否真正离开了注释词语
  if (target.classList.contains('annotated-word')) {
    // 如果移动到弹窗本身，保持显示
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

  // 获取窗口尺寸，防止弹窗超出屏幕
  const windowWidth = window.innerWidth
  const windowHeight = window.innerHeight

  // 预估弹窗最大宽度
  const tooltipMaxWidth = 300
  const tooltipPadding = 20

  tooltipPosition.value = {
    x: Math.min(x, windowWidth - tooltipMaxWidth - tooltipPadding),
    y: Math.min(y, windowHeight - tooltipPadding),
  }
}

/**
 * 全局鼠标移动事件（用于更新弹窗位置）
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
  // 添加全局鼠标移动监听
  document.addEventListener('mousemove', handleMouseMove)
})

onUnmounted(() => {
  // 清理资源
  if (abortController) {
    abortController.abort()
  }
  document.removeEventListener('mousemove', handleMouseMove)
})
</script>

<style scoped>
.annotated-text-container {
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

<!-- 全局弹窗样式（不使用 scoped） -->
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
