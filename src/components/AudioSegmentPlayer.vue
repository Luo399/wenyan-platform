<!--
  AudioSegmentPlayer.vue - 音频分段播放器主组件

  功能说明：
  - 负责加载音频、控制播放/暂停、更新时间进度、高亮当前段落
  - 管理段落列表数据（从父组件传入或通过API拉取）
  - 提供全局播放/暂停按钮和进度条
  - 支持缓存机制、错误处理、请求取消

  使用方式：
  <AudioSegmentPlayer
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

  Events:
  - load-start: 开始加载数据
  - load-success: 加载成功
  - load-error: 加载失败
  - play: 开始播放
  - pause: 暂停播放
  - ended: 播放结束
  - segment-change: 当前段落变化
-->

<template>
  <div class="audio-segment-player">
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
    <div v-else class="player-content">
      <!-- 音频控制栏 -->
      <div class="audio-controls">
        <button class="main-play-btn" @click="togglePlay">
          <i class="fas" :class="isPlaying ? 'fa-pause' : 'fa-play'"></i>
        </button>

        <div class="progress-section">
          <span class="time">{{ formatTime(currentTime) }}</span>
          <input
            type="range"
            class="progress-bar"
            :value="currentTime"
            :max="duration"
            @input="handleSeek"
          />
          <span class="time">{{ formatTime(duration) }}</span>
        </div>

        <button class="speed-btn" @click="toggleSpeed">{{ playbackSpeed }}x</button>
      </div>

      <!-- 段落列表 -->
      <div class="segments-list">
        <div v-for="(segment, index) in segments" :key="index">
          <SegmentItem
            :segment="segment"
            :is-active="currentSegmentIndex === index"
            @play="() => playFromSegment(index)"
            @click="() => playFromSegment(index)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import SegmentItem from './SegmentItem.vue'
// 段落数据类型定义
export interface Segment {
  id: string
  text: string
  role: string
  avatar: string
  startTime: number
  endTime: number
}
// 课文数据类型
export interface WenData {
  wenId: string
  title: string
  audioUrl: string
  segments: Segment[]
}
// Props 类型定义
interface Props {
  wenId: string
  autoLoad?: boolean
  cacheEnabled?: boolean
  requestTimeout?: number
  audioBaseUrl?: string
}

const props = withDefaults(defineProps<Props>(), {
  autoLoad: true,
  cacheEnabled: true,
  requestTimeout: 10000,
  audioBaseUrl: '/audio/',
})
// Events
const emit = defineEmits<{
  (e: 'load-start'): void
  (e: 'load-success', data: WenData): void
  (e: 'load-error', error: string): void
  (e: 'play'): void
  (e: 'pause'): void
  (e: 'ended'): void
  (e: 'segment-change', index: number): void
}>()
// 状态管理
const loading = ref(false)
const error = ref<string | null>(null)
const wenData = ref<WenData | null>(null)
const audioRef = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const playbackSpeed = ref(1)
const abortController = ref<AbortController | null>(null)
// 缓存对象
const dataCache = new Map<string, WenData>()
// 计算属性
const segments = computed(() => wenData.value?.segments || [])
const currentSegmentIndex = computed(() => {
  const time = currentTime.value
  const segs = segments.value
  for (let i = segs.length - 1; i >= 0; i--) {
    const seg = segs[i]
    if (seg && time >= seg.startTime) {
      return i
    }
  }
  return -1
})
/**
 * 格式化时间显示
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
/**
 * 加载课文数据
 */
async function loadData() {
  if (!props.wenId) {
    error.value = '请提供课文ID'
    emit('load-error', error.value)
    return
  }
  // 检查缓存
  if (props.cacheEnabled && dataCache.has(props.wenId)) {
    wenData.value = dataCache.get(props.wenId)!
    emit('load-success', wenData.value)
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
    // 构建请求URL（注意：实际项目中需要替换为真实的API路径）
    // TODO: 将此处的JSON文件路径替换为实际的API接口
    const url = `${props.audioBaseUrl}${props.wenId}.json`
    const timeout = setTimeout(() => {
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
    const data = await response.json()
    // 数据格式验证
    if (!validateWenData(data)) {
      throw new Error('数据格式错误')
    }
    wenData.value = data
    // 存入缓存
    if (props.cacheEnabled) {
      dataCache.set(props.wenId, data)
    }
    emit('load-success', data)
    setupAudio()
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      // 请求被取消，不触发错误
      return
    }
    const errorMsg = err instanceof Error ? err.message : '加载失败'
    error.value = errorMsg
    emit('load-error', errorMsg)
  } finally {
    loading.value = false
  }
}
/**
 * 验证课文数据格式
 */
function validateWenData(data: unknown): data is WenData {
  if (!data || typeof data !== 'object') return false
  const d = data as WenData
  if (!d.wenId || !d.title || !d.audioUrl || !Array.isArray(d.segments)) {
    return false
  }
  for (const seg of d.segments) {
    if (
      !seg.id ||
      !seg.text ||
      !seg.role ||
      typeof seg.startTime !== 'number' ||
      typeof seg.endTime !== 'number'
    ) {
      return false
    }
  }
  return true
}
/**
 * 设置音频元素
 */
function setupAudio() {
  if (!wenData.value || !audioRef.value) return
  audioRef.value.src = wenData.value.audioUrl
  audioRef.value.load()
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
    audioRef.value.play().catch((err) => {
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
  audioRef.value.currentTime = segment.startTime
  if (!isPlaying.value) {
    audioRef.value.play().catch((err) => {
      console.error('播放失败:', err)
    })
    isPlaying.value = true
  }
  emit('segment-change', index)
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
  const nextIndex = (currentIndex >= 0 ? currentIndex : 2) + 1
  const nextSpeed = speeds[nextIndex % speeds.length]
  playbackSpeed.value = nextSpeed as number
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
  // 清理资源
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
  () => {
    if (props.autoLoad) {
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
.audio-segment-player {
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

<!-- 隐藏的音频元素 -->
<audio
  ref="audioRef"
  @timeupdate="handleTimeUpdate"
  @ended="handleEnded"
  @loadedmetadata="handleLoadedMetadata"
/>
