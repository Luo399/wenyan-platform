<!--
  WordList.vue - 字词注释组件

  功能说明：
  - 从 word_list JSON 加载字词注释数据
  - 从 text_basic_info JSON 加载课文标题和原文
  - 渲染带有注释标记的 HTML 内容
  - 鼠标悬浮时显示注释弹窗
  - 弹窗宽度自适应内容长度

  使用方式：
  <WordList wenId="WEN_01" />

  Props:
  - wenId: 课文ID，用于加载对应的注释数据

  JSON 数据格式：
  word_list: [
    {
      "text_id": "WEN_01",
      "word": "阳城",
      "basic_meaning": "在今河南登封东南",
      "synonym_analysis": "",
      "follow_up_questions": []
    }
  ]

  text_basic_info: {
    "text_id": "WEN_01",
    "title": "陈涉世家",
    "original_text": "陈胜者，阳城人也..."
  }
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
        ref="contentRef"
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

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
 * 课文基础信息类型定义
 */
interface TextBasicInfo {
  text_id: string
  title: string
  author: string
  dynasty: string
  original_text: string
  illustration: string
  bgm: string
}

/**
 * Props 类型定义
 */
interface Props {
  wenId: string
  autoLoad?: boolean
  wordListBaseUrl?: string
  basicInfoBaseUrl?: string
}

const props = withDefaults(defineProps<Props>(), {
  autoLoad: true,
  wordListBaseUrl: '/data/word_list/',
  basicInfoBaseUrl: '/data/text_basic_info/',
})

// 状态管理
const loading = ref(false)
const error = ref<string | null>(null)
const wordList = ref<WordItem[]>([])
const basicInfo = ref<TextBasicInfo | null>(null)
const showTooltip = ref(false)
const currentAnnotation = ref('')
const tooltipPosition = ref({ x: 0, y: 0 })
const contentRef = ref<HTMLElement | null>(null)

// AbortController 用于取消请求
let abortController: AbortController | null = null

/**
 * 获取文章标题
 */
const articleTitle = computed(() => {
  return basicInfo.value?.title || '未知标题'
})

/**
 * 生成带注释的 HTML 内容
 * 将原文中的字词替换为带有 data-def 属性的 span 标签
 */
const contentHtml = computed(() => {
  if (!basicInfo.value?.original_text || !wordList.value.length) {
    return '<p>暂无内容</p>'
  }

  let content = basicInfo.value.original_text

  // 创建字词映射表，按字词长度降序排列，优先匹配长词
  const sortedWords = [...wordList.value].sort((a, b) => b.word.length - a.word.length)

  // 替换所有字词为带注释的 span 标签
  for (const item of sortedWords) {
    if (!item.word || !item.basic_meaning) continue

    // 使用正则表达式全局替换
    // 转义特殊字符
    const escapedWord = item.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escapedWord, 'g')

    // 创建带注释的 span 标签
    const replacement = `<span class="annotated-word" data-def="${escapeHtml(item.basic_meaning)}">${item.word}</span>`

    content = content.replace(regex, replacement)
  }

  // 将换行符转换为段落标签
  content = content.replace(/\n\n/g, '</p><p>')
  content = content.replace(/\n/g, '<br>')
  content = `<p>${content}</p>`

  return content
})

/**
 * HTML 转义函数
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * HTML 白名单过滤配置
 * 只允许安全的标签和属性，防止 XSS 攻击
 */
const ALLOWED_TAGS = ['p', 'span', 'br']
const ALLOWED_ATTRS: Record<string, string[]> = {
  p: [],
  span: ['class', 'data-def'],
  br: [],
}

/**
 * 过滤 HTML 内容，移除危险标签和属性
 */
function sanitizeHtml(html: string): string {
  if (!html) return ''

  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html

  function filterNode(node: Node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement
      const tagName = element.tagName.toLowerCase()

      if (!ALLOWED_TAGS.includes(tagName)) {
        while (element.firstChild) {
          element.parentNode?.insertBefore(element.firstChild, element)
        }
        element.parentNode?.removeChild(element)
        return
      }

      const attributes = Array.from(element.attributes)
      for (const attr of attributes) {
        const allowedAttrs = ALLOWED_ATTRS[tagName] || []
        if (!allowedAttrs.includes(attr.name.toLowerCase())) {
          element.removeAttribute(attr.name)
        }
      }

      if (tagName === 'span') {
        const className = element.className
        if (className && !className.includes('annotated-word')) {
          element.removeAttribute('class')
        }
      }
    }

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

// 生命周期钩子 - 将 mousemove 监听范围缩小到 article-content 容器
onMounted(() => {
  const contentEl = contentRef.value
  if (contentEl) {
    contentEl.addEventListener('mousemove', handleMouseMove)
  }
})

onUnmounted(() => {
  const contentEl = contentRef.value
  if (contentEl) {
    contentEl.removeEventListener('mousemove', handleMouseMove)
  }
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
