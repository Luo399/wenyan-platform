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
-->

<template>
  <div class="multi-role-reading">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- JSON数据错误 -->
    <ErrorDisplay
      v-else-if="error"
      :error="error"
      :source="sourceName"
      resource-type="json"
      :resource-path="dataUrl"
      @retry="loadData"
    />

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
      <ErrorDisplay
        v-if="audioError"
        :error="audioError"
        :source="sourceName"
        resource-type="mp3"
        :resource-path="audioUrl"
        :show-retry="true"
        @retry="retryAudio"
      />

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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import MultiRoleReadingItem from './MultiRoleReadingItem.vue'
import ErrorDisplay from './ErrorDisplay.vue'

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

// 状态管理
const loading = ref(false)
const audioLoading = ref(false)
const error = ref<string | null>(null)
const audioError = ref<string | null>(null)
const multiRoleData = ref<MultiRoleData | null>(null)
const audioRef = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const playbackSpeed = ref(1)
const abortController = ref<AbortController | null>(null)

// 组件名称（用于错误显示）
const sourceName = 'MultiRoleReading'

// 资源路径（用于错误显示）
const dataUrl = computed(() => `${props.dataBaseUrl}${props.wenId}.json`)
const audioUrl = computed(() => {
  if (!multiRoleData.value) return ''
  return `${props.audioBaseUrl}${multiRoleData.value.audio_file}`
})

// 缓存对象
const dataCache = new Map<string, MultiRoleData>()

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
 * 解析单个时间字符串为秒数
 * @param timeStr - 时间字符串，如 "00:00" 或 "01:23.45" 或 "123.45"
 * @returns 秒数
 */
function parseTime(timeStr: string): number {
  const parts = timeStr.trim().split(':')
  if (parts.length === 2) {
    const mins = parseInt(parts[0] ?? '0', 10) || 0
    const secs = parseFloat(parts[1] ?? '0') || 0
    return mins * 60 + secs
  } else if (parts.length === 1) {
    // 只有秒数的格式
    return parseFloat(parts[0] ?? '0') || 0
  }
  return 0
}

/**
 * 格式化时间显示
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * 从 time_range 解析开始和结束时间
 */
function parseTimeRange(timeRange: string): { start: number; end: number } {
  const [startStr, endStr] = timeRange.split('-')
  return {
    start: parseTime(startStr ?? '0'),
    end: parseTime(endStr ?? '0'),
  }
}

/**
 * 加载课文数据
 */
async function loadData() {
  console.log(`开始加载多角色朗读数据: wenId=${props.wenId}`)

  if (!props.wenId) {
    loading.value = false
    error.value = '请提供课文ID'
    emit('load-error', error.value)
    return
  }

  // 检查缓存
  if (props.cacheEnabled && dataCache.has(props.wenId)) {
    loading.value = false
    console.log(`使用缓存数据: ${props.wenId}`)
    multiRoleData.value = dataCache.get(props.wenId)!
    emit('load-success', multiRoleData.value)
    setupAudio()
    return
  }

  // 取消之前的请求
  if (abortController.value) {
    abortController.value.abort()
  }
  abortController.value = new AbortController()

  loading.value = true
  error.value = null
  emit('load-start')

  try {
    const url = `${props.dataBaseUrl}${props.wenId}.json`
    console.log(`请求URL: ${url}`)

    const timeout = setTimeout(() => {
      console.log(`请求超时: ${url}`)
      abortController.value?.abort()
    }, props.requestTimeout)

    const response = await fetch(url, {
      signal: abortController.value.signal,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`)
    }

    const data: MultiRoleData = await response.json()
    console.log(`数据加载成功，段落数量: ${data.segments?.length || 0}`)

    // 数据格式验证
    if (!validateMultiRoleData(data)) {
      throw new Error('数据格式错误')
    }

    multiRoleData.value = data

    // 存入缓存
    if (props.cacheEnabled) {
      dataCache.set(props.wenId, data)
    }

    emit('load-success', data)
    setupAudio()
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      error.value = '加载超时'
      emit('load-error', error.value)
      return
    }
    const errorMsg = err instanceof Error ? err.message : '加载失败'
    console.error(`加载失败: ${errorMsg}`)
    if (errorMsg.includes('404') || errorMsg.includes('HTTP错误: 404')) {
      error.value = '【404正在加班加点中】'
    } else {
      error.value = errorMsg
    }
    emit('load-error', error.value)
  } finally {
    loading.value = false
  }
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
  console.error('音频加载错误:', event)
}

/**
 * 重试加载音频
 */
function retryAudio() {
  audioError.value = null
  audioLoading.value = true
  if (audioRef.value && multiRoleData.value) {
    audioRef.value.src = `${props.audioBaseUrl}${multiRoleData.value.audio_file}`
    audioRef.value.load()
  }
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
      console.error('播放失败:', err)
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
      console.error('播放失败:', err)
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
onMounted(() => {
  if (props.autoLoad) {
    loadData()
  }
})

onUnmounted(() => {
  if (abortController.value) {
    abortController.value.abort()
  }
  if (audioRef.value) {
    audioRef.value.pause()
    audioRef.value.src = ''
  }
})

// 监听wenId变化
watch(
  () => props.wenId,
  (newWenId, oldWenId) => {
    console.log(`wenId 变化: ${oldWenId} -> ${newWenId}`)
    if (props.autoLoad && newWenId) {
      loadData()
    }
  },
)

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
  padding: 1rem;
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

/* 播放器内容 */
.player-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* 音频控制栏 */
.audio-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background-color: #f9fafb;
  border-radius: 0.5rem;
}

.main-play-btn {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background-color: #3b82f6;
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  transition: background-color 0.2s;
}

.main-play-btn:hover {
  background-color: #2563eb;
}

.progress-section {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.time {
  font-size: 0.875rem;
  color: #6b7280;
  min-width: 3.5rem;
}

.progress-bar {
  flex: 1;
  height: 0.5rem;
  cursor: pointer;
  accent-color: #3b82f6;
}

.speed-btn {
  padding: 0.5rem 1rem;
  background-color: #fff;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
  color: #374151;
}

/* 段落列表 */
.segments-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 400px;
  overflow-y: auto;
}
</style>
