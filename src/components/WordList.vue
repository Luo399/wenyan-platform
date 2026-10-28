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
      <!--
        监听器必须由模板绑定，不能放在 onMounted 里手动 addEventListener：
        这个 div 在 v-else 分支内，组件挂载时两份 JSON 还在加载、正文节点并不存在，
        contentRef 恒为 null，原来的 `if (contentEl)` 会静默跳过绑定，且没有任何 watch 补绑，
        结果 mousemove 处理器永不执行 —— tooltip 不出现，同一个处理器里的 search_word
        埋点也从未上报。Vue 在元素创建时才绑 @mousemove，卸载时自动解绑，竞态从根上消失。
      -->
      <div
        class="article-content"
        v-html="adaptedData.basicInfo.contentHtml"
        @mousemove="onMouseMove"
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
        <!-- 追问区（本轮不做 UI）：数据已预留到 span[data-follow-up]，
             上线时在此读取 dataset.followUp 渲染列表，见 handleMouseMove 内注释 -->
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, nextTick } from 'vue'
import { useDataLoader } from '@/composables/useDataLoader'
import { getDataUrlWithVersion } from '@/utils/asset'
import { useAuthStore } from '@/stores/auth'
import { getSessionId } from '@/utils/tracking'
import { post } from '@/utils/api'
import { computeTooltipPosition } from '@/utils/tooltipPosition'
import {
  adaptWordList,
  type RawWordItem,
  type RawTextBasicInfo,
  type WordListAdapterResult,
} from '@/adapters/wordListAdapter'

// ============================================================
// 常量（R23：移除魔法数字）
// ============================================================
/** Tooltip 与 CSS 保持一致的估算尺寸（首次显示时的边界计算，像素，宽度对齐 CSS max-width） */
const TOOLTIP_ESTIMATED_WIDTH = 320 as const
const TOOLTIP_ESTIMATED_HEIGHT = 60 as const
/** mousemove 节流间隔：16ms ~ 60fps（R22） */
const MOUSE_MOVE_THROTTLE_MS = 16 as const

// Tooltip 状态
const showTooltip = ref(false)
const currentAnnotation = ref('')
const tooltipPosition = ref({ x: 0, y: 0 })
// 真实 tooltip DOM 引用（用于 R23：必要时用 getBoundingClientRect 校正尺寸）
const tooltipRef = ref<HTMLElement | null>(null)
// 最近一次鼠标位置：浮层渲染出真实尺寸后要拿它重新校正一次坐标
const lastMouse = { x: 0, y: 0 }

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
function throttle<T extends (...args: never[]) => void>(fn: T, waitMs: number) {
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

/** 浮层实测尺寸；尚未渲染（首次显示）时回退到常量估算 */
function measureTooltipSize(): { width: number; height: number } {
  const rect = tooltipRef.value?.getBoundingClientRect()
  return {
    width: rect?.width ?? TOOLTIP_ESTIMATED_WIDTH,
    height: rect?.height ?? TOOLTIP_ESTIMATED_HEIGHT,
  }
}

/**
 * R23：首帧用估算尺寸定位，渲染出真实尺寸后再校正一次。
 * 页面上实际渲染出来的最长注释是 WEN_01「发闾左適戍渔阳」那条 84 字，
 * 第一次悬停时它不会再冲出视口下沿。
 */
async function correctWithRealSize() {
  await nextTick()
  if (!showTooltip.value) return
  const rect = tooltipRef.value?.getBoundingClientRect()
  if (!rect) return
  const fixed = computeTooltipPosition(lastMouse.x, lastMouse.y, {
    width: rect.width,
    height: rect.height,
  })
  if (fixed.x !== tooltipPosition.value.x || fixed.y !== tooltipPosition.value.y) {
    tooltipPosition.value = fixed
  }
}

/**
 * 在事件派发同步阶段抓到的指针快照。
 *
 * 不能把 MouseEvent 本身交给节流器：throttle 的 trailing 调用发生在派发结束之后，
 * 那时 `e.target` 已被 DOM 置为 null（规范行为），读它会抛
 * `Cannot read properties of null (reading 'classList')`，浮层既不更新也不收起。
 */
interface PointerProbe {
  x: number
  y: number
  isWord: boolean
  word: string
  def: string | null
}

function probeFromEvent(e: MouseEvent): PointerProbe {
  const target = e.target as HTMLElement | null
  const isWord = !!target && target.classList.contains('annotated-word')
  return {
    x: e.clientX,
    y: e.clientY,
    isWord,
    word: isWord ? target!.textContent?.trim() || '' : '',
    def: isWord ? target!.getAttribute('data-def') : null,
  }
}

function handleMouseMove(probe: PointerProbe) {
  if (probe.isWord && probe.def) {
    // 追问区接入点（本轮不做 UI）：word_list 的 follow_up_questions 由适配器在 span 上
    // 输出 data-follow-up（仅非空时写入）。追问 UI 上线时在此多抓一个
    // target.dataset.followUp 字段并 JSON.parse，渲染到 tooltip 模板的预留位置。
    currentAnnotation.value = probe.def
    lastMouse.x = probe.x
    lastMouse.y = probe.y
    // 首次显示时 tooltip 还不存在，只能靠估算尺寸；已显示则实测尺寸已可用
    const wasVisible = showTooltip.value

    // 字词查询埋点：每个 word 每个 session 仅上报一次
    const word = probe.word
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

    tooltipPosition.value = computeTooltipPosition(probe.x, probe.y, measureTooltipSize())
    showTooltip.value = true
    if (!wasVisible) void correctWithRealSize()
    return
  }
  showTooltip.value = false
}

// R22：包装为节流版本（入参是纯数据快照，trailing 延迟执行也安全）
const throttledMouseMove = throttle(handleMouseMove, MOUSE_MOVE_THROTTLE_MS)

/** 模板绑定的入口：先同步抓快照，再交给节流器 */
function onMouseMove(e: MouseEvent) {
  throttledMouseMove(probeFromEvent(e))
}

// 监听器已由模板 @mousemove 绑定（Vue 负责创建时绑定 / 卸载时解绑），
// 这里只需要清掉节流器里还没落地的 trailing 定时器。
onUnmounted(() => {
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
  /* 悬浮出的是自定义浮层（不是系统帮助提示），用 pointer 与站内其他可点元素一致；
     原先的 help 在 Windows 上渲染成右下角问号，学生会误以为那是帮助标记 */
  cursor: pointer !important;
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
  /* 长注释限宽换行：position: fixed 只设 left 时按「视口宽 - left」做收缩适配，
     84 字的注释（WEN_01「发闾左適戍渔阳」）会摊成接近整屏宽的色块压住正文 */
  max-width: min(320px, calc(100vw - 16px));
  white-space: normal;
  overflow-wrap: break-word;
  text-align: left;
  line-height: 1.7;
}
</style>
