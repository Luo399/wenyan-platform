<!--
  MultiRoleReading.vue - 多角色朗读播放器组件

  功能说明：
  - 负责加载音频、控制播放/暂停、更新时间进度、高亮当前段落
  - 管理段落列表数据（从父组件传入或通过API拉取）
  - 提供全局播放/暂停按钮和进度条
  - 支持缓存机制、错误处理、请求取消

  使用方式：
  <MultiRoleReading
    :wenId="wenId"
    :autoLoad="true"
    @load-success="handleLoadSuccess"
    @load-error="handleLoadError"
  />

  Props:
  - wenId: 课文ID，用于拉取对应分段数据
  - autoLoad: 是否自动加载数据（默认true）
  - cacheEnabled: 是否启用缓存（默认true）
  - requestTimeout: 请求超时时间（默认10000ms）
  - audioBaseUrl: 音频基础URL（默认'/audio/'）
  - dataBaseUrl: 数据JSON基础URL（默认'/data/multi_role_reading/'）

  Events:
  - load-start: 开始加载数据
  - load-success: 加载成功
  - load-error: 加载失败
  - play: 开始播放
  - pause: 暂停播放
  - ended: 播放结束
  - segment-change: 当前段落变化

  JSON 数据格式（multi_role_reading）：
  {
    "text_id": "WEN_01",
    "audio_file": "WEN_01_multi_role.mp3",
    "segments": [
      {
        "sentence_index": 1,
        "time_range": "00:00-00:16",
        "role_name": "旁白📖",
        "dialogue": "陈胜者，阳城人也..."
      }
    ]
  }

  数据加载分层（遵循项目规则）：
  - 组件不得直接 fetch('/data/...')，必须走 useDataLoader 组合式函数
  - useDataLoader 内部封装：fetch、AbortController、超时、重试、模块级 LRU 缓存、Worker JSON 解析
  - 数据格式校验通过 transform 函数注入，校验失败抛错由 useDataLoader 统一捕获
-->

<template>
  <div class="multi-role-reading">
    <!-- 加载状态 -->
    <BaseLoader v-if="loading" loading-text="加载中..." />

    <!-- 超时状态 -->
    <BaseTimeout v-else-if="isTimeout" @retry="loadData" />

    <!-- 错误状态 -->
    <BaseError v-else-if="errorMessage" :error="errorMessage" @retry="loadData" />

    <!-- 空数据状态 -->
    <BaseEmpty v-else-if="!segments.length" empty-text="暂无段落数据" />

    <!-- 主内容 -->
    <div v-else class="player-content">
      <!-- 音频控制栏 -->
      <div class="audio-controls">
        <button class="main-play-btn" @click="togglePlay" :disabled="audioLoading">
          <i
            class="fas"
            :class="isPlaying ? 'fa-pause' : audioLoading ? 'fa-spinner fa-spin' : 'fa-play'"
          ></i>
        </button>

        <div class="progress-section">
          <span class="time">{{ formatTime(currentTime) }}</span>
          <input
            type="range"
            class="progress-bar"
            :value="currentTime"
            :max="duration"
            @input="handleSeek"
            :disabled="!duration"
          />
          <span class="time">{{ duration ? formatTime(duration) : '--:--' }}</span>
        </div>

        <button class="speed-btn" @click="toggleSpeed" :disabled="audioLoading">
          {{ playbackSpeed }}x
        </button>
      </div>

      <!-- 音频错误提示 -->
      <div v-if="audioError" class="audio-error">
        <i class="fas fa-exclamation-triangle"></i>
        <span>{{ audioError }}</span>
      </div>

      <!-- 段落列表 -->
      <div class="segments-list">
        <div v-for="(segment, index) in segments" :key="index">
          <MultiRoleReadingItem
            :segment="segment"
            :is-active="currentSegmentIndex === index"
            @play="() => playFromSegment(index)"
            @click="() => playFromSegment(index)"
          />
        </div>
      </div>
    </div>
  </div>

  <!-- 隐藏的音频元素 -->
  <audio
    ref="audioRef"
    @timeupdate="handleTimeUpdate"
    @ended="handleEnded"
    @loadedmetadata="handleLoadedMetadata"
    @loadeddata="handleLoadedData"
    @error="handleAudioError"
    preload="metadata"
  />
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue'
import MultiRoleReadingItem from './MultiRoleReadingItem.vue'
import BaseLoader from '@/components/common/BaseLoader.vue'
import BaseError from '@/components/common/BaseError.vue'
import BaseEmpty from '@/components/common/BaseEmpty.vue'
import BaseTimeout from '@/components/common/BaseTimeout.vue'
import { useDataLoader } from '@/composables/useDataLoader'
import { debugLog, debugError } from '@/utils/debug'
import { parseTimeRange, parseSecondsToTime } from '@/utils/timeUtils'

// 段落数据类型定义
export interface MultiRoleSegment {
  sentence_index: number
  time_range: string
  role_name: string
  dialogue: string
}

// 课文数据类型
export interface MultiRoleData {
  text_id: string
  audio_file: string
  segments: MultiRoleSegment[]
}

// Props 类型定义
interface Props {
  wenId: string
  autoLoad?: boolean
  cacheEnabled?: boolean
  requestTimeout?: number
  audioBaseUrl?: string
  dataBaseUrl?: string
}

const props = withDefaults(defineProps<Props>(), {
  autoLoad: true,
  cacheEnabled: true,
  requestTimeout: 10000,
  audioBaseUrl: '/audio/',
  dataBaseUrl: '/data/multi_role_reading/',
})

// Events
const emit = defineEmits<{
  (e: 'load-start'): void
  (e: 'load-success', data: MultiRoleData): void
  (e: 'load-error', error: string): void
  (e: 'play'): void
  (e: 'pause'): void
  (e: 'ended'): void
  (e: 'segment-change', index: number): void
}>()

// 音频相关状态（与数据加载无关，由本组件直接管理）
const audioLoading = ref(false)
const audioError = ref<string | null>(null)
const audioRef = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const playbackSpeed = ref(1)

// 错误展示消息（由 onLoadError 回调写入，保留 404 友好提示等业务语义）
const errorMessage = ref<string | null>(null)

// 数据 URL（wenId 为空时返回空串，useDataLoader 会触发 "请提供有效的URL" 错误）
const dataUrl = computed(() => (props.wenId ? `${props.dataBaseUrl}${props.wenId}.json` : ''))

// 使用 useDataLoader 加载数据（替代直接 fetch，遵循项目分层规则）
// 内部封装：fetch、AbortController、超时、指数退避重试、模块级 LRU 缓存、Worker JSON 解析
const {
  loading,
  isTimeout,
  data: multiRoleData,
  retry,
} = useDataLoader<MultiRoleData>(() => dataUrl.value, {
  autoLoad: props.autoLoad,
  timeout: props.requestTimeout,
  retryCount: 1,
  cacheEnabled: props.cacheEnabled,
  cacheTTL: 5 * 60 * 1000,
  // transform 同时承担数据格式校验职责：校验失败抛错，由 useDataLoader 统一进入错误分支
  transform: (raw) => {
    if (!validateMultiRoleData(raw)) {
      throw new Error('数据格式错误')
    }
    return raw as MultiRoleData
  },
  onLoadSuccess: (data) => {
    errorMessage.value = null
    debugLog(`数据加载成功，段落数量: ${data.segments?.length || 0}`)
    emit('load-success', data)
    setupAudio()
  },
  onLoadError: (err) => {
    const msg = formatErrorMessage(err)
    errorMessage.value = msg
    debugError(`加载失败: ${msg}`)
    emit('load-error', msg)
  },
})

// loading 由 false 变 true 时发射 load-start 事件（覆盖 autoLoad / 手动 load / wenId 变化三种场景）
watch(
  loading,
  (isLoading) => {
    if (isLoading) {
      emit('load-start')
    }
  },
  { immediate: true },
)

// 计算属性
const segments = computed(() => multiRoleData.value?.segments || [])

// 当前段落索引
const currentSegmentIndex = computed(() => {
  const time = currentTime.value
  const segs = segments.value

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]
    if (seg) {
      const { start, end } = parseTimeRange(seg.time_range)
      if (time >= start && time < end) {
        return i
      }
    }
  }

  // 当前时间超出最后一个片段：返回最后一个片段索引
  if (segs.length > 0) {
    const lastSeg = segs[segs.length - 1]
    if (lastSeg) {
      const { start } = parseTimeRange(lastSeg.time_range)
      if (time >= start) {
        return segs.length - 1
      }
    }
  }

  return -1
})

/**
 * 格式化时间显示（统一走 parseSecondsToTime）
 */
function formatTime(seconds: number): string {
  return parseSecondsToTime(seconds)
}

/**
 * （parseTime/parseTimeRange 已删除，统一使用 timeUtils）：
 *  - parseTime(timeStr) → parseTimeToSeconds(timeStr)（from timeUtils）
 *  - parseTimeRange(timeRange) → parseTimeRange(timeRange)（from timeUtils，返回 {start, end}）
 */

/**
 * 格式化错误消息（保留原 404 友好提示与"请提供课文ID"语义）
 * useDataLoader 内部错误消息（如 "HTTP 404"、"请提供有效的URL"）映射为面向用户的中文提示
 */
function formatErrorMessage(err: string): string {
  if (err === '请提供有效的URL') {
    return '请提供课文ID'
  }
  if (err.includes('404') || err.includes('HTTP 404')) {
    return '【404正在加班加点中】'
  }
  return err
}

/**
 * 加载课文数据（暴露给父组件，委托给 useDataLoader.retry）
 * 使用 retry 而非 load 是为了在手动重试时重置内部重试计数器，确保错误恢复后仍可享受指数退避重试
 */
function loadData() {
  retry()
}

/**
 * 验证多角色朗读数据格式
 */
function validateMultiRoleData(data: unknown): data is MultiRoleData {
  if (!data || typeof data !== 'object') return false
  const d = data as MultiRoleData
  if (!d.text_id || !d.audio_file || !Array.isArray(d.segments)) {
    return false
  }
  for (const seg of d.segments) {
    if (
      typeof seg.sentence_index !== 'number' ||
      !seg.time_range ||
      !seg.role_name ||
      !seg.dialogue
    ) {
      return false
    }
  }
  return true
}

/**
 * 设置音频源（不立即加载，等待播放时再加载）
 */
function setupAudio() {
  if (!multiRoleData.value || !audioRef.value) return
  // 音频文件路径：基础URL + 文件名
  audioRef.value.src = `${props.audioBaseUrl}${multiRoleData.value.audio_file}`
  // 不调用 load()，让浏览器按需加载
}

/**
 * 音频数据加载完成处理
 */
function handleLoadedData() {
  audioLoading.value = false
}

/**
 * 音频加载错误处理
 */
function handleAudioError(event: Event) {
  audioLoading.value = false
  audioError.value = '音频加载失败，请检查网络或重试'
  debugError('音频加载错误:', event)
}

/**
 * 音频时间更新处理
 */
function handleTimeUpdate() {
  if (audioRef.value) {
    currentTime.value = audioRef.value.currentTime
    duration.value = audioRef.value.duration || 0
  }
}

/**
 * 音频播放结束处理
 */
function handleEnded() {
  isPlaying.value = false
  emit('ended')
}

/**
 * 音频加载完成处理
 */
function handleLoadedMetadata() {
  if (audioRef.value) {
    duration.value = audioRef.value.duration || 0
  }
}

/**
 * 播放/暂停切换
 */
function togglePlay() {
  if (!audioRef.value) return
  if (isPlaying.value) {
    audioRef.value.pause()
    isPlaying.value = false
    emit('pause')
  } else {
    // 开始播放前显示加载状态
    if (duration.value === 0) {
      audioLoading.value = true
    }
    audioRef.value.play().catch((err) => {
      audioLoading.value = false
      debugError('播放失败:', err)
    })
    isPlaying.value = true
    emit('play')
  }
}

/**
 * 从指定段落开始播放
 */
function playFromSegment(index: number) {
  if (!audioRef.value || index < 0 || index >= segments.value.length) return
  const segment = segments.value[index]
  if (!segment) return

  const { start } = parseTimeRange(segment.time_range)
  audioRef.value.currentTime = start

  if (!isPlaying.value) {
    audioRef.value.play().catch((err) => {
      debugError('播放失败:', err)
    })
    isPlaying.value = true
  }
}

/**
 * 进度条拖动处理
 */
function handleSeek(event: Event) {
  const target = event.target as HTMLInputElement
  const time = parseFloat(target.value)
  if (audioRef.value) {
    audioRef.value.currentTime = time
    currentTime.value = time
  }
}

/**
 * 切换播放速度
 */
function toggleSpeed() {
  const speeds: number[] = [0.5, 0.75, 1, 1.25, 1.5, 2]
  const currentValue = playbackSpeed.value ?? 1
  const currentIndex = speeds.indexOf(currentValue)
  const nextIndex = (currentIndex >= 0 ? currentIndex : speeds.indexOf(1)) + 1
  const nextSpeed = speeds[nextIndex % speeds.length] ?? 1
  playbackSpeed.value = nextSpeed
  if (audioRef.value) {
    audioRef.value.playbackRate = playbackSpeed.value
  }
}

/**
 * 监听当前段落变化
 */
watch(currentSegmentIndex, (newIndex) => {
  if (newIndex >= 0) {
    emit('segment-change', newIndex)
  }
})

// 生命周期
// 注：数据加载的 onMounted 和 wenId watch 已由 useDataLoader 内部 autoLoad + watch(urlGetter) 接管
// 这里仅保留音频资源的清理
onUnmounted(() => {
  // useDataLoader 内部已通过自己的 onUnmounted 取消 AbortController
  if (audioRef.value) {
    audioRef.value.pause()
    audioRef.value.src = ''
  }
})

// 暴露方法给父组件
defineExpose({
  loadData,
  play: () => audioRef.value?.play(),
  pause: () => audioRef.value?.pause(),
  seek: (time: number) => {
    if (audioRef.value) {
      audioRef.value.currentTime = time
    }
  },
  getCurrentSegment: () => {
    const idx = currentSegmentIndex.value
    return segments.value[idx] || null
  },
})
</script>

<style scoped>
.multi-role-reading {
  max-width: 800px;
  margin: 0 auto;
  padding: var(--spacing-md);
  /* 使用设计 token 衬线字体 */
  font-family: var(--font-family-serif);
}

/* 播放器内容 */
.player-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

/* 音频错误提示 */
.audio-error {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  /* 半透明米色高亮背景 */
  background-color: var(--color-bg-highlight);
  border-radius: var(--radius-small);
  /* 暖棕色强调文字 */
  color: var(--color-accent);
  font-size: var(--font-size-small);
}

.audio-error i {
  font-size: 1rem;
}

/* 音频控制栏 */
.audio-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  /* 半透明米色高亮背景 */
  background-color: var(--color-bg-highlight);
  border-radius: var(--radius-small);
}

/* 主播放按钮（圆形图标按钮） */
.main-play-btn {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  /* 朱红主色底 */
  background-color: var(--color-primary);
  color: var(--color-white);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  transition: background-color 0.2s;
}

.main-play-btn:hover {
  /* 暗红悬浮态 */
  background-color: var(--color-primary-hover);
}

.progress-section {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.time {
  font-size: var(--font-size-small);
  /* 灰色次要文字 */
  color: var(--color-text-secondary);
  min-width: 3.5rem;
}

.progress-bar {
  flex: 1;
  height: 0.5rem;
  cursor: pointer;
  /* 朱红主色进度条 */
  accent-color: var(--color-primary);
}

/* 倍速按钮（文字按钮：朱红底 + 橄榄绿边框 + 药丸圆角） */
.speed-btn {
  padding: var(--spacing-xs) var(--spacing-md);
  background-color: var(--color-primary);
  border: var(--border-width-thin) solid var(--color-border);
  border-radius: var(--radius-button);
  cursor: pointer;
  font-size: var(--font-size-small);
  color: var(--color-white);
  transition: background-color 0.2s;
}

.speed-btn:hover {
  background-color: var(--color-primary-hover);
}

/* 段落列表 */
.segments-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  max-height: 400px;
  overflow-y: auto;
}
</style>
