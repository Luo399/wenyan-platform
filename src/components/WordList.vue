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
      <p>{{ error || '加载失败' }}</p>
      <button @click="retry" class="retry-btn">重试</button>
    </div>

    <!-- 空数据状态 -->
    <div v-else-if="!adaptedData" class="empty-state">
      <p>暂无数据</p>
    </div>

    <!-- 主内容 -->
    <div v-else class="content-wrapper">
      <!-- 文章标题区域 -->
      <div class="article-header">
        <h1 class="article-title">{{ adaptedData.basicInfo.title || '未知标题' }}</h1>
        <p class="article-meta">
          <span class="author"
            >{{ adaptedData.basicInfo.dynasty }} · {{ adaptedData.basicInfo.author }}</span
          >
        </p>
      </div>

      <!-- 文章内容（直接使用适配器预生成的 HTML） -->
      <div
        ref="contentRef"
        class="article-content"
        v-html="adaptedData.basicInfo.contentHtml"
      ></div>

      <!-- Tooltip -->
      <div
        v-if="showTooltip"
        class="tooltip"
        :style="{ left: tooltipPosition.x + 'px', top: tooltipPosition.y + 'px' }"
      >
        {{ currentAnnotation }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useDataLoader } from '@/composables/useDataLoader'
import {
  adaptWordList,
  type RawWordItem,
  type RawTextBasicInfo,
  type WordListAdapterResult,
} from '@/adapters/wordListAdapter'

// Tooltip 状态
const showTooltip = ref(false)
const currentAnnotation = ref('')
const tooltipPosition = ref({ x: 0, y: 0 })
const contentRef = ref<HTMLElement | null>(null)

interface Props {
  wenId: string
  wordListBaseUrl?: string
  basicInfoBaseUrl?: string
}

const props = withDefaults(defineProps<Props>(), {
  wordListBaseUrl: '/data/word_list/',
  basicInfoBaseUrl: '/data/text_basic_info/',
})

const wordListUrl = `${props.wordListBaseUrl}${props.wenId}.json`
const basicInfoUrl = `${props.basicInfoBaseUrl}${props.wenId}.json`

// 加载词汇列表
const {
  loading: wordListLoading,
  error: wordListError,
  data: wordListData,
  retry: retryWordList,
} = useDataLoader<RawWordItem[]>(() => wordListUrl, {
  timeout: 10000,
  retryCount: 1,
})

// 加载基础信息
const {
  loading: basicInfoLoading,
  error: basicInfoError,
  data: basicInfoData,
  retry: retryBasicInfo,
} = useDataLoader<RawTextBasicInfo>(() => basicInfoUrl, {
  timeout: 10000,
  retryCount: 1,
})

// 组合状态
const loading = computed(() => wordListLoading.value || basicInfoLoading.value)
const error = computed(() => wordListError.value || basicInfoError.value)

// 使用适配器处理数据（纯函数，无响应式副作用）
const adaptedData = computed<WordListAdapterResult | null>(() => {
  if (!wordListData.value || !basicInfoData.value) {
    return null
  }

  // 调用适配器进行数据转换
  return adaptWordList(basicInfoData.value, wordListData.value)
})

function retry() {
  retryWordList()
  retryBasicInfo()
}

// Tooltip 事件处理
function handleMouseMove(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.classList.contains('annotated-word')) {
    const def = target.getAttribute('data-def')
    if (def) {
      currentAnnotation.value = def

      // 计算Tooltip位置并确保在视口内
      const tooltipWidth = 200
      const tooltipHeight = 60
      let x = e.clientX + 10
      let y = e.clientY + 10

      // 边界检查
      if (x + tooltipWidth > window.innerWidth) {
        x = e.clientX - tooltipWidth - 10
      }
      if (y + tooltipHeight > window.innerHeight) {
        y = e.clientY - tooltipHeight - 10
      }

      tooltipPosition.value = { x, y }
      showTooltip.value = true
      return
    }
  }
  showTooltip.value = false
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
  padding: var(--spacing-md);
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--color-placeholder);
  border-top: 4px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.retry-btn {
  margin-top: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-primary);
  color: var(--color-white);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-button);
  font-family: var(--font-family-serif);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.retry-btn:hover {
  background-color: var(--color-primary-hover);
}

.article-header {
  margin-bottom: var(--spacing-md);
}

.article-title {
  font-size: var(--font-size-heading);
  font-weight: var(--font-weight-heavy);
  color: var(--color-primary);
  margin: 0;
}

.article-meta {
  color: var(--color-text-secondary);
  font-size: var(--font-size-small);
  margin: var(--spacing-xs) 0 0;
}

.article-content {
  font-size: var(--font-size-body-lg);
  line-height: 1.8;
  color: var(--color-text);
}

/* 注释词 - Figma 设计：朱红下划线 */
.article-content :deep(.annotated-word) {
  color: var(--color-primary) !important;
  text-decoration: underline !important;
  text-decoration-color: var(--color-primary) !important;
  cursor: help !important;
  font-weight: var(--font-weight-semibold) !important;
  background-color: rgba(133, 30, 14, 0.08) !important;
  padding: 0 2px;
  border-radius: 2px;
}

.tooltip {
  position: fixed;
  background: var(--color-primary);
  color: var(--color-white);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-small);
  font-family: var(--font-family-serif);
  font-size: var(--font-size-small);
  z-index: 1000;
  pointer-events: none;
  box-shadow: var(--shadow-small);
}
</style>
