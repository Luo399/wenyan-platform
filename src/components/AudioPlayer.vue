<!--
  AudioPlayer.vue - 自定义音频播放器组件

  功能说明：
  1. 支持播放/暂停控制（使用 Font Awesome 图标）
  2. 支持音量开关控制
  3. 显示播放进度（时间格式 mm:ss）
  4. 支持进度条点击跳转

  Font Awesome 图标说明：
  - fa-play: 播放图标
  - fa-pause: 暂停图标
  - fa-volume-up: 音量开启图标
  - fa-volume-mute: 静音图标
-->
<template>
  <!-- 音频播放器容器 -->
  <div class="audio-player-container">
    <!-- 音频元素（隐藏原生控件） -->
    <audio
      ref="audioRef"
      :src="src"
      @timeupdate="handleTimeUpdate"
      @loadedmetadata="handleLoadedMetadata"
      @play="isPlaying = true"
      @pause="isPlaying = false"
      @ended="handleEnded"
    ></audio>

    <!-- 控制栏 -->
    <div class="controls-bar">
      <!-- 播放/暂停按钮 -->
      <button class="control-btn" @click="togglePlay" :title="isPlaying ? '暂停' : '播放'">
        <!-- 根据播放状态显示不同图标 -->
        <i v-if="isPlaying" class="fas fa-pause"></i>
        <i v-else class="fas fa-play"></i>
      </button>

      <!-- 进度区域 -->
      <div class="progress-section">
        <!-- 时间显示：当前时间 / 总时长 -->
        <span class="time-display">
          {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
        </span>

        <!-- 进度条 -->
        <div class="progress-wrapper" @click="seek">
          <div class="progress-bar">
            <div class="progress-filled" :style="{ width: progressPercent + '%' }"></div>
          </div>
        </div>
      </div>

      <!-- 音量控制按钮 -->
      <button
        class="control-btn volume-btn"
        @click="toggleMute"
        :title="isMuted ? '取消静音' : '静音'"
      >
        <!-- 根据静音状态显示不同图标 -->
        <i v-if="isMuted" class="fas fa-volume-mute"></i>
        <i v-else class="fas fa-volume-up"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { debugWarn } from '@/utils/debug'

// ============================================================
// 组件 Props 定义
// ============================================================
const props = defineProps<{
  /**
   * 音频文件的 URL 地址
   */
  src: string
}>()

// ============================================================
// 响应式状态定义
// ============================================================

/** 音频元素引用 */
const audioRef = ref<HTMLAudioElement | null>(null)
/** 是否正在播放 */
const isPlaying = ref(false)
/** 是否静音 */
const isMuted = ref(false)
/** 当前播放时间（秒） */
const currentTime = ref(0)
/** 音频总时长（秒） */
const duration = ref(0)

// ============================================================
// 计算属性
// ============================================================

/**
 * 计算进度条填充百分比
 */
const progressPercent = computed(() => {
  if (duration.value === 0) return 0
  return (currentTime.value / duration.value) * 100
})

// ============================================================
// 事件处理函数
// ============================================================

/**
 * 切换播放/暂停状态
 */
function togglePlay() {
  if (!audioRef.value) return

  if (isPlaying.value) {
    audioRef.value.pause()
  } else {
    audioRef.value.play().catch((err) => {
      debugWarn('播放失败:', err)
      isPlaying.value = false
    })
  }
}

/**
 * 切换静音状态
 */
function toggleMute() {
  if (!audioRef.value) return

  isMuted.value = !isMuted.value
  audioRef.value.muted = isMuted.value
}

/**
 * 处理时间更新事件
 */
function handleTimeUpdate() {
  if (audioRef.value) {
    currentTime.value = audioRef.value.currentTime
  }
}

/**
 * 处理音频元数据加载完成事件
 */
function handleLoadedMetadata() {
  if (audioRef.value) {
    duration.value = audioRef.value.duration
  }
}

/**
 * 处理音频播放结束事件
 */
function handleEnded() {
  isPlaying.value = false
  currentTime.value = 0
  if (audioRef.value) {
    audioRef.value.currentTime = 0
  }
}

/**
 * 点击进度条跳转
 * @param event - 鼠标点击事件
 */
function seek(event: MouseEvent) {
  if (!audioRef.value || duration.value === 0) return

  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const percent = (event.clientX - rect.left) / rect.width
  const seekTime = percent * duration.value

  if (audioRef.value) {
    audioRef.value.currentTime = seekTime
    currentTime.value = seekTime
  }
}

/**
 * 格式化时间显示
 * @param seconds - 秒数
 * @returns 格式化的字符串（mm:ss）
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
</script>

<style scoped>
/* 播放器容器 */
.audio-player-container {
  width: 100%;
  background-color: #f3f4f6;
  border-radius: 0.5rem;
  padding: 1rem;
}

/* 控制栏：水平排列各控制元素 */
.controls-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* 控制按钮样式 */
.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  border-radius: 50%;
  background-color: #3b82f6;
  color: white;
  cursor: pointer;
  transition: background-color 0.2s;
  flex-shrink: 0;
}

.control-btn:hover {
  background-color: #2563eb;
}

/* 音量按钮样式 */
.volume-btn {
  background-color: #6b7280;
}

.volume-btn:hover {
  background-color: #4b5563;
}

/* 进度区域 */
.progress-section {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* 时间显示文本 */
.time-display {
  color: #374151;
  font-size: 0.875rem;
  flex-shrink: 0;
  min-width: 90px;
}

/* 进度条容器 */
.progress-wrapper {
  flex: 1;
  cursor: pointer;
  padding: 0.25rem 0;
}

/* 进度条轨道 */
.progress-bar {
  height: 0.375rem;
  background-color: #d1d5db;
  border-radius: 0.25rem;
  overflow: hidden;
}

/* 进度条填充 */
.progress-filled {
  height: 100%;
  background-color: #3b82f6;
  transition: width 0.1s linear;
}
</style>
