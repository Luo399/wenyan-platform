<!-- eslint-disable vue/multi-word-component-names -->
<!--
  Repeatbgm.vue - 背景音乐循环播放组件

  功能说明：
  1. 根据当前活动 wenId 自动加载对应的背景音乐
  2. 响应全局 BGM store 的状态变化
  3. 默认自动播放，初始音量为 20
  4. 提供播放/暂停控制和音量调节
-->
<template>
  <div class="repeat-bgm">
    <!-- 加载状态 -->
    <BaseLoader v-if="loading" loading-text="加载背景音乐..." />

    <!-- 错误状态 -->
    <BaseError v-else-if="error" :error="error" @retry="retry" />

    <!-- 正常状态 -->
    <div v-else-if="currentBgmFile" class="bgm-controls">
      <!-- 音频元素 -->
      <audio
        ref="audioRef"
        :src="bgmUrl"
        loop
        @loadedmetadata="handleLoadedMetadata"
        @error="handleAudioError"
        @ended="handleAudioEnded"
      />

      <!-- 播放/暂停按钮 -->
      <button
        class="bgm-btn"
        @click="handleTogglePlay"
        :title="isPlaying ? '暂停背景音乐' : '播放背景音乐'"
      >
        <i v-if="isPlaying" class="fas fa-pause"></i>
        <i v-else class="fas fa-play"></i>
        <span class="btn-text">{{ isPlaying ? '暂停' : '播放' }}背景音乐</span>
      </button>

      <!-- 音量控制 -->
      <div class="volume-control">
        <button class="volume-btn" @click="handleToggleMute" :title="isMuted ? '取消静音' : '静音'">
          <i v-if="isMuted" class="fas fa-volume-mute"></i>
          <i v-else-if="currentVolume === 0" class="fas fa-volume-off"></i>
          <i v-else class="fas fa-volume-up"></i>
        </button>
        <input
          type="range"
          min="0"
          max="100"
          :value="isMuted ? 0 : currentVolume"
          @input="handleVolumeChange"
          class="volume-slider"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import BaseLoader from './BaseLoader.vue'
import BaseError from './BaseError.vue'
import { getAssetUrl } from '@/utils/asset'
import { useBgmStore } from '@/stores/bgm'
import { getWenId } from '@/utils/wenUtils'
import { debugLog, debugError, debugWarn } from '@/utils/debug'

const route = useRoute()
const bgmStore = useBgmStore()

const audioRef = ref<HTMLAudioElement | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

// 计算当前BGM文件
const currentBgmFile = computed(() => {
  return bgmStore.currentBgmFile
})

// 计算当前播放状态
const isPlaying = computed(() => {
  return bgmStore.isPlaying
})

// 当前音量（从store获取）
const currentVolume = computed(() => {
  return bgmStore.volume
})

// 是否静音
const isMuted = computed(() => {
  return bgmStore.isMuted
})

// BGM URL
const bgmUrl = computed(() => {
  if (!currentBgmFile.value) return ''
  return getAssetUrl('audio', currentBgmFile.value)
})

// 监听路由变化，自动更新wenId
watch(
  () => route.params.id,
  (newId) => {
    if (newId) {
      const wenId = getWenId(newId as string)
      debugLog('[Repeatbgm] 路由变化，更新wenId:', wenId)
      bgmStore.setActiveWenId(wenId)
    }
  },
  { immediate: true },
)

// 监听BGM文件变化，重新加载音频
watch(currentBgmFile, (newFile, oldFile) => {
  if (newFile && newFile !== oldFile && audioRef.value) {
    debugLog('[Repeatbgm] BGM文件变化:', oldFile, '->', newFile)
    audioRef.value.pause()
    audioRef.value.load()
    bgmStore.pause()
  }
})

// 监听store播放状态变化
watch(
  () => bgmStore.isPlaying,
  (playing) => {
    if (!audioRef.value) return

    if (playing) {
      audioRef.value.play().catch((err) => {
        debugWarn('[Repeatbgm] 播放失败:', err)
        bgmStore.pause()
      })
    } else {
      audioRef.value.pause()
    }
  },
)

// 监听音量变化
watch(
  () => bgmStore.volume,
  (newVolume) => {
    if (audioRef.value) {
      audioRef.value.volume = newVolume / 100
    }
  },
)

// 监听静音状态变化
watch(
  () => bgmStore.isMuted,
  (muted) => {
    if (audioRef.value) {
      audioRef.value.muted = muted
    }
  },
)

function handleLoadedMetadata() {
  debugLog('[Repeatbgm] ✅ 背景音乐加载完成:', currentBgmFile.value)

  if (audioRef.value) {
    audioRef.value.volume = currentVolume.value / 100
    audioRef.value.muted = isMuted.value

    // 默认自动播放
    bgmStore.play()
  }
}

function handleAudioError() {
  debugError('[Repeatbgm] ❌ 音频加载失败:', bgmUrl.value)
  error.value = '背景音乐加载失败'
}

function handleAudioEnded() {
  // 循环播放不需要特殊处理，audio元素已有loop属性
  debugLog('[Repeatbgm] 音频播放结束，将自动循环')
}

function handleTogglePlay() {
  bgmStore.togglePlay()
}

function handleToggleMute() {
  bgmStore.toggleMute()
}

function handleVolumeChange(event: Event) {
  const target = event.target as HTMLInputElement
  const newVolume = Number(target.value)
  bgmStore.setVolume(newVolume)
}

function retry() {
  error.value = null
  if (audioRef.value) {
    audioRef.value.load()
  }
}

onMounted(() => {
  debugLog('[Repeatbgm] 组件挂载')
})

onUnmounted(() => {
  debugLog('[Repeatbgm] 组件卸载')
  if (audioRef.value) {
    audioRef.value.pause()
    audioRef.value.src = ''
  }
})
</script>

<style scoped>
.repeat-bgm {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem;
}

.bgm-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.bgm-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.3s ease;
}

.bgm-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.bgm-btn:active {
  transform: translateY(0);
}

.btn-text {
  font-weight: 500;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.volume-btn {
  padding: 0.5rem;
  background: transparent;
  border: none;
  color: #6b7280;
  cursor: pointer;
  transition: color 0.2s;
}

.volume-btn:hover {
  color: #374151;
}

.volume-slider {
  width: 80px;
  height: 4px;
  appearance: none;
  background: #e5e7eb;
  border-radius: 2px;
  outline: none;
}

.volume-slider::-webkit-slider-thumb {
  appearance: none;
  width: 12px;
  height: 12px;
  background: #667eea;
  border-radius: 50%;
  cursor: pointer;
}

.volume-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: #667eea;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}
</style>
