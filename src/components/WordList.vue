<template>
  <div class="word-list-container">
    <!-- 加载状态 -->
    <BaseLoader v-if="wordListLoading || basicInfoLoading" />

    <!-- 超时状态 -->
    <BaseTimeout v-else-if="wordListTimeout || basicInfoTimeout" @retry="retry" />

    <!-- 错误状态 -->
    <BaseError v-else-if="wordListError || basicInfoError" :error="wordListError || basicInfoError || '加载失败'" @retry="retry" />

    <!-- 空数据状态 -->
    <BaseEmpty v-else-if="!wordListData?.length || !basicInfoData" />

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
import { ref, computed } from 'vue'
import { useDataLoader } from '@/composables/useDataLoader'
import BaseLoader from './common/BaseLoader.vue'
import BaseError from './common/BaseError.vue'
import BaseEmpty from './common/BaseEmpty.vue'
import BaseTimeout from './common/BaseTimeout.vue'

interface WordItem {
  text_id: string
  word: string
  basic_meaning: string
  synonym_analysis: string
  follow_up_questions: string[]
}

interface TextBasicInfo {
  text_id: string
  title: string
  author: string
  dynasty: string
  original_text: string
  illustration: string
  bgm: string
}

interface Props {
  wenId: string
  wordListBaseUrl?: string
  basicInfoBaseUrl?: string
}

const props = withDefaults(defineProps<Props>(), {
  wordListBaseUrl: '/data/word_list/',
  basicInfoBaseUrl: '/data/text_basic_info/',
})

const showTooltip = ref(false)
const currentAnnotation = ref('')
const tooltipPosition = ref({ x: 0, y: 0 })

const wordListUrl = computed(() => `${props.wordListBaseUrl}${props.wenId}.json`)
const basicInfoUrl = computed(() => `${props.basicInfoBaseUrl}${props.wenId}.json`)

const {
  loading: wordListLoading,
  error: wordListError,
  isTimeout: wordListTimeout,
  data: wordListData,
  retry: retryWordList
} = useDataLoader<WordItem[]>(wordListUrl, {
  timeout: 10000,
  retryCount: 1
})

const {
  loading: basicInfoLoading,
  error: basicInfoError,
  isTimeout: basicInfoTimeout,
  data: basicInfoData,
  retry: retryBasicInfo
} = useDataLoader<TextBasicInfo>(basicInfoUrl, {
  timeout: 10000,
  retryCount: 1
})

function retry() {
  retryWordList()
  retryBasicInfo()
}

const articleTitle = computed(() => {
  return basicInfoData.value?.title || '未知标题'
})

const contentHtml = computed(() => {
  if (!basicInfoData.value?.original_text || !wordListData.value?.length) {
    return '<p>暂无内容</p>'
  }

  let content = basicInfoData.value.original_text
  const sortedWords = [...(wordListData.value || [])].sort((a, b) => b.word.length - a.word.length)

  for (const item of sortedWords) {
    if (!item.word || !item.basic_meaning) continue
    const escapedWord = item.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escapedWord, 'g')
    const replacement = `<span class="annotated-word" data-def="${escapeHtml(item.basic_meaning)}">${item.word}</span>`
    content = content.replace(regex, replacement)
  }

  content = content.replace(/\n\n/g, '</p><p>')
  content = content.replace(/\n/g, '<br>')
  content = `<p>${content}</p>`

  return content
})

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

const ALLOWED_TAGS = ['p', 'span', 'br']
const ALLOWED_ATTRS: Record<string, string[]> = {
  p: [],
  span: ['class', 'data-def'],
  br: [],
}

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

const sanitizedContent = computed(() => {
  return sanitizeHtml(contentHtml.value)
})

const tooltipStyle = computed(() => ({
  left: `${tooltipPosition.value.x}px`,
  top: `${tooltipPosition.value.y}px`,
}))

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

function handleMouseMove(event: MouseEvent) {
  if (showTooltip.value) {
    updateTooltipPosition(event)
  }
}

if (typeof window !== 'undefined') {
  document.addEventListener('mousemove', handleMouseMove)
}
</script>

<style scoped>
.word-list-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 1.5rem;
}

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