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
          <span class="author">{{ adaptedData.basicInfo.dynasty }} · {{ adaptedData.basicInfo.author }}</span>
        </p>
      </div>

      <!-- 文章内容（直接使用适配器预生成的 HTML） -->
      <div ref="contentRef" class="article-content" v-html="adaptedData.basicInfo.contentHtml"></div>

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
  type WordListAdapterResult 
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
      tooltipPosition.value = { x: e.clientX + 10, y: e.clientY + 10 }
      showTooltip.value = true
      return
    }
  }
  showTooltip.value = false
}

// 生命周期钩子
onMounted(() => {
  document.addEventListener('mousemove', handleMouseMove)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove)
})
</script>

<style scoped>
.word-list-container {
  padding: 1rem;
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
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
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.article-header {
  margin-bottom: 1rem;
}

.article-title {
  font-size: 1.5rem;
  margin: 0;
}

.article-meta {
  color: #666;
  margin: 0.5rem 0 0;
}

.article-content {
  line-height: 1.8;
}

.article-content :deep(.annotated-word) {
  color: #3498db !important;
  text-decoration: underline !important;
  text-decoration-color: #3498db !important;
  cursor: help !important;
  font-weight: normal !important;
  background-color: rgba(52, 152, 219, 0.1) !important;
  padding: 0 2px;
  border-radius: 2px;
}

.tooltip {
  position: fixed;
  background: #333;
  color: white;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  font-size: 0.9rem;
  z-index: 1000;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}
</style>
