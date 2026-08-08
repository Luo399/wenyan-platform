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
        ref="tooltipRef"
        class="tooltip"
        role="tooltip"
        aria-live="polite"
        :style="{ left: tooltipPosition.x + 'px', top: tooltipPosition.y + 'px' }"
      >
        {{ currentAnnotation }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useDataLoader } from '@/composables/useDataLoader'
import { getDataUrlWithVersion } from '@/utils/asset'
import { useAuthStore } from '@/stores/auth'
import { getSessionId } from '@/utils/tracking'
import { post } from '@/utils/api'
import {
  adaptWordList,
  type RawWordItem,
  type RawTextBasicInfo,
  type WordListAdapterResult,
} from '@/adapters/wordListAdapter'

// ============================================================
// 常量（R23：移除魔法数字）
// ============================================================
/** Tooltip 与 CSS 保持一致的估算尺寸（用于边界计算，像素） */
const TOOLTIP_ESTIMATED_WIDTH = 200 as const
const TOOLTIP_ESTIMATED_HEIGHT = 60 as const
/** Tooltip 与鼠标指针的间距（像素） */
const TOOLTIP_OFFSET = 10 as const
/** mousemove 节流间隔：16ms ~ 60fps（R22） */
const MOUSE_MOVE_THROTTLE_MS = 16 as const

// Tooltip 状态
const showTooltip = ref(false)
const currentAnnotation = ref('')
const tooltipPosition = ref({ x: 0, y: 0 })
const contentRef = ref<HTMLElement | null>(null)
// 真实 tooltip DOM 引用（用于 R23：必要时用 getBoundingClientRect 校正尺寸）
const tooltipRef = ref<HTMLElement | null>(null)

interface Props {
  wenId: string
  wordListBaseUrl?: string
  basicInfoBaseUrl?: string
}

const props = withDefaults(defineProps<Props>(), {
  wordListBaseUrl: '/data/word_list/',
  basicInfoBaseUrl: '/data/text_basic_info/',
})

// R107: 数据地址走版本戳 OSS 地址（外部显式传入自定义 baseUrl 时沿用，兼容旧用法）
const wordListUrl = (): string | Promise<string> =>
  props.wordListBaseUrl !== '/data/word_list/'
    ? `${props.wordListBaseUrl}${props.wenId}.json`
    : getDataUrlWithVersion('word_list', `${props.wenId}.json`)

const basicInfoUrl = (): string | Promise<string> =>
  props.basicInfoBaseUrl !== '/data/text_basic_info/'
    ? `${props.basicInfoBaseUrl}${props.wenId}.json`
    : getDataUrlWithVersion('text_basic_info', `${props.wenId}.json`)

// 加载词汇列表
const {
  loading: wordListLoading,
  error: wordListError,
  data: wordListData,
  retry: retryWordList,
} = useDataLoader<RawWordItem[]>(wordListUrl, {
  timeout: 10000,
  retryCount: 1,
})

// 加载基础信息
const {
  loading: basicInfoLoading,
  error: basicInfoError,
  data: basicInfoData,
  retry: retryBasicInfo,
} = useDataLoader<RawTextBasicInfo>(basicInfoUrl, {
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

/**
 * R22: 手写 throttle，避免引入 lodash-es
 * 保证在 trailing 最后一次事件后至少执行一次，避免鼠标停止移动时 tooltip 位置漂移
 */
function throttle<T extends (...args: any[]) => void>(fn: T, waitMs: number) {
  let lastInvokeTime = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastArgs: Parameters<T> | null = null

  function throttled(this: unknown, ...args: Parameters<T>) {
    const now = Date.now()
    const remaining = waitMs - (now - lastInvokeTime)
    lastArgs = args
    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      lastInvokeTime = now
      fn.apply(this, args)
    } else if (!timer) {
      timer = setTimeout(() => {
        lastInvokeTime = Date.now()
        timer = null
        if (lastArgs) fn.apply(this, lastArgs)
      }, remaining)
    }
  }

  // 先把 throttled 转成 unknown 再加 cancel 扩展；避免 TS 报"类型互斥无法直接转换"
  const throttledWithCancel = throttled as unknown as T & { cancel: () => void }
  throttledWithCancel.cancel = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    lastArgs = null
  }

  return throttledWithCancel
}

// ============================================================
// Tooltip 事件处理
// ============================================================

/** 已上报过 search_word 的 word 缓存，避免连续 hover 重复上报 */
const reportedWordSet = new Set<string>()

function handleMouseMove(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.classList.contains('annotated-word')) {
    const def = target.getAttribute('data-def')
    if (def) {
      currentAnnotation.value = def

      // 字词查询埋点：每个 word 每个 session 仅上报一次
      const word = target.textContent?.trim() || ''
      if (word && !reportedWordSet.has(word)) {
        reportedWordSet.add(word)
        try {
          let userId = ''
          try {
            const authStore = useAuthStore()
            if (authStore.isLoggedIn && authStore.user) {
              userId = authStore.user.studentId || authStore.user.id || ''
            }
          } catch {
            /* Pinia 未就绪 */
          }
          post('/api/track', {
            events: [
              {
                event_type: 'search_word',
                user_id: userId,
                session_id: getSessionId(),
                step_id: props.wenId,
                properties: { word, is_audio: false },
                page_url: window.location.pathname + window.location.search,
                timestamp: new Date().toISOString(),
              },
            ],
          }).catch(() => {
            /* 静默 */
          })
        } catch {
          /* 静默 */
        }
      }

      // R23：优先用真实 DOM 尺寸，fallback 到常量估算
      const rect = tooltipRef.value?.getBoundingClientRect()
      const tooltipWidth = rect?.width ?? TOOLTIP_ESTIMATED_WIDTH
      const tooltipHeight = rect?.height ?? TOOLTIP_ESTIMATED_HEIGHT

      let x = e.clientX + TOOLTIP_OFFSET
      let y = e.clientY + TOOLTIP_OFFSET

      // 边界检查：保证不超出视口
      if (x + tooltipWidth > window.innerWidth) {
        x = e.clientX - tooltipWidth - TOOLTIP_OFFSET
      }
      if (y + tooltipHeight > window.innerHeight) {
        y = e.clientY - tooltipHeight - TOOLTIP_OFFSET
      }
      // 左/上边界也兜底
      if (x < 0) x = 0
      if (y < 0) y = 0

      tooltipPosition.value = { x, y }
      showTooltip.value = true
      return
    }
  }
  showTooltip.value = false
}

// R22：包装为节流版本
const throttledMouseMove = throttle(handleMouseMove, MOUSE_MOVE_THROTTLE_MS)

// 生命周期钩子：监听 mousemove + resize 时用真实尺寸重新计算
onMounted(async () => {
  const contentEl = contentRef.value
  if (contentEl) {
    contentEl.addEventListener('mousemove', throttledMouseMove)
  }
  // 等 tooltip DOM 渲染后，下一帧再检测真实尺寸，避免首次移动时 fallback 到估算值
  await nextTick()
})

onUnmounted(() => {
  const contentEl = contentRef.value
  if (contentEl) {
    contentEl.removeEventListener('mousemove', throttledMouseMove)
  }
  throttledMouseMove.cancel()
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
