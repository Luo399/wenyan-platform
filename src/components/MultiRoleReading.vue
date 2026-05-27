<template>
  <div class="multi-role-reading">
    <!-- 加载状态 -->
    <BaseLoader v-if="loading" />

    <!-- 超时状态 -->
    <BaseTimeout v-else-if="isTimeout" @retry="retry" />

    <!-- 错误状态 -->
    <BaseError v-else-if="error" :error="error" @retry="retry" />

    <!-- 空数据状态 -->
    <BaseEmpty v-else-if="!multiRoleData?.segments?.length" />

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
      <BaseError v-if="audioError" :error="audioError" @retry="retryAudio" />

      <!-- 段落列表 -->
      <div class="segments-list">
        <div v-for="(segment, index) in segments" :key="index">
          <MultiRoleReadingItem
            :segment="segment"
            :is-active="currentSegmentIndex === index"
            :is-currently-playing="isPlaying"
            @toggle="handleSegmentToggle"
            @click="() => playFromTime(segment.startTime)"
          />
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useDataLoader } from '@/composables/useDataLoader'
import { usePlaybackControl } from '@/composables/usePlaybackControl'
import {
  adaptMultiRoleReading,
  formatTime,
  type ProcessedMultiRoleData,
  type ProcessedMultiRoleSegment,
  type RawMultiRoleData,
} from '@/adapters/multiPoleAdapter'
import { debugError } from '@/utils/debug'
import MultiRoleReadingItem from './MultiRoleReadingItem.vue'
import BaseLoader from './common/BaseLoader.vue'
import BaseError from './common/BaseError.vue'
import BaseEmpty from './common/BaseEmpty.vue'
import BaseTimeout from './common/BaseTimeout.vue'

export type { ProcessedMultiRoleSegment, ProcessedMultiRoleData }

interface Props {
  wenId: string
  audioBaseUrl?: string
  dataBaseUrl?: string
}

const props = withDefaults(defineProps<Props>(), {
  audioBaseUrl: '/audio/',
  dataBaseUrl: '/data/multi_role_reading/',
})

const emit = defineEmits<{
  (e: 'load-start'): void
  (e: 'load-success', data: ProcessedMultiRoleData): void
  (e: 'load-error', error: string): void
  (e: 'play'): void
  (e: 'pause'): void
  (e: 'ended'): void
  (e: 'segment-change', index: number): void
}>()

const dataUrl = computed(() => `${props.dataBaseUrl}${props.wenId}.json`)

// 获取原始数据
const {
  loading,
  error,
  isTimeout,
  data: rawData,
  retry,
} = useDataLoader<RawMultiRoleData>(() => dataUrl.value, {
  timeout: 10000,
  retryCount: 1,
  cacheEnabled: true,
})

// 在组件内部进行数据适配，符合"组件隔离铁律"
const multiRoleData = computed<ProcessedMultiRoleData | null>(() => {
  if (!rawData.value) return null
  try {
    return adaptMultiRoleReading(rawData.value)
  } catch (e) {
    console.error('数据适配失败:', e)
    return null
  }
})

// 监听适配成功事件
watch(multiRoleData, (data) => {
  if (data) {
    emit('load-success', data)
  }
})

// 监听错误事件
watch(error, (err) => {
  if (err) {
    emit('load-error', err)
  }
})

const audioRef = ref<HTMLAudioElement | null>(null)
const currentTime = ref(0)
const duration = ref(0)
const playbackSpeed = ref(1)
const audioLoading = ref(false)
const audioError = ref<string | null>(null)

// 使用播放控制 composable（单一真相来源）
const { isPlaying, togglePlay, play, pause, seekTo } = usePlaybackControl(audioRef, {
  onPlay: () => emit('play'),
  onPause: () => emit('pause'),
})

const segments = computed(() => multiRoleData.value?.segments || [])

const audioUrl = computed(() => {
  if (!multiRoleData.value) return ''
  return `${props.audioBaseUrl}${multiRoleData.value.audio_file}`
})

const currentSegmentIndex = computed(() => {
  const time = currentTime.value
  const segs = segments.value

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]
    if (seg && time >= seg.startTime && time < seg.endTime) {
      return i
    }
  }

  if (segs.length > 0) {
    const lastSeg = segs[segs.length - 1]
    if (lastSeg && time >= lastSeg.startTime) {
      return segs.length - 1
    }
  }

  return -1
})

function setupAudio() {
  if (!multiRoleData.value || !audioRef.value) return
  // 只有当 audioUrl 真正改变时才重新设置 src，避免不必要的加载中止
  const newSrc = audioUrl.value
  if (audioRef.value.src !== newSrc && newSrc) {
    audioRef.value.src = newSrc
  }
}

function handleLoadedData() {
  audioLoading.value = false
}

function handleAudioError(event: Event) {
  audioLoading.value = false
  audioError.value = '音频加载失败，请检查网络或重试'
  debugError('音频加载错误:', event)
}

function retryAudio() {
  audioError.value = null
  audioLoading.value = true
  if (audioRef.value && multiRoleData.value) {
    const newSrc = audioUrl.value
    if (newSrc) {
      audioRef.value.src = newSrc
      audioRef.value.load()
    }
  }
}

function handleTimeUpdate() {
  if (audioRef.value) {
    currentTime.value = audioRef.value.currentTime
    duration.value = audioRef.value.duration || 0
  }
}

function handleEnded() {
  pause()
  emit('ended')
}

function handleLoadedMetadata() {
  if (audioRef.value) {
    duration.value = audioRef.value.duration || 0
  }
}

/**
 * 处理段落按钮的切换事件
 * 如果点击的是当前正在播放的段落，则暂停
 * 如果点击的是其他段落，则跳转到该段落并播放
 * @param startTime - 段落开始时间（秒）
 */
function handleSegmentToggle(startTime: number) {
  // 如果点击的是当前正在播放的段落，则暂停
  if (currentSegmentIndex.value >= 0 && isPlaying.value) {
    const currentSegment = segments.value[currentSegmentIndex.value]
    if (currentSegment && currentSegment.startTime === startTime) {
      pause()
      return
    }
  }
  // 否则跳转到该段落并播放
  seekTo(startTime)
}

/**
 * 从指定时间开始播放
 * @param startTime - 段落开始时间（秒）
 */
function playFromTime(startTime: number) {
  seekTo(startTime)
}

function handleSeek(event: Event) {
  const target = event.target as HTMLInputElement
  const time = parseFloat(target.value)
  if (audioRef.value) {
    audioRef.value.currentTime = time
    currentTime.value = time
  }
}

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

watch(currentSegmentIndex, (newIndex) => {
  if (newIndex >= 0) {
    emit('segment-change', newIndex)
  }
})

onMounted(() => {
  if (multiRoleData.value) {
    setupAudio()
  }
})

watch(multiRoleData, (newData) => {
  if (newData) {
    setupAudio()
  }
})

onUnmounted(() => {
  if (audioRef.value) {
    audioRef.value.pause()
    audioRef.value.src = ''
  }
})

defineExpose({
  loadData: retry,
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

.player-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

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

.segments-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 400px;
  overflow-y: auto;
}
</style>
