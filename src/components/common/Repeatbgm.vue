<!-- eslint-disable vue/multi-word-component-names -->
<!--
  Repeatbgm.vue - 背景音乐循环播放组件

  功能说明：
  1. 根据 wenId 加载 text_basic_info 数据
  2. 获取 bgm 属性并循环播放背景音乐
  3. 提供播放/暂停控制
  4. 支持音量调节
-->
<template>
  <div class="repeat-bgm">
    <!-- 加载状态 -->
    <BaseLoader v-if="loading" loading-text="加载背景音乐..." />

    <!-- 错误状态 -->
    <BaseError v-else-if="error" :error="error" @retry="retry" />

    <!-- 正常状态 -->
    <div v-else-if="basicInfo" class="bgm-controls">
      <!-- 音频元素 -->
      <audio
        ref="audioRef"
        :src="bgmUrl"
        loop
        @loadedmetadata="handleLoadedMetadata"
        @error="handleAudioError"
      ></audio>

      <!-- 播放/暂停按钮 -->
      <button
        class="bgm-btn"
        @click="togglePlay"
        :title="isPlaying ? '暂停背景音乐' : '播放背景音乐'"
      >
        <i v-if="isPlaying" class="fas fa-pause"></i>
        <i v-else class="fas fa-play"></i>
        <span class="btn-text">{{ isPlaying ? '暂停' : '播放' }}背景音乐</span>
      </button>

      <!-- 音量控制 -->
      <div class="volume-control">
        <button class="volume-btn" @click="toggleMute" :title="isMuted ? '取消静音' : '静音'">
          <i v-if="isMuted" class="fas fa-volume-mute"></i>
          <i v-else class="fas fa-volume-up"></i>
        </button>
        <input
          type="range"
          min="0"
          max="100"
          :value="volume"
          @input="handleVolumeChange"
          class="volume-slider"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import BaseLoader from './BaseLoader.vue'
import BaseError from './BaseError.vue'
import { useDataLoader } from '@/composables/useDataLoader'
import { getAssetUrl } from '@/utils/asset'
import { debugLog, debugError, debugWarn } from '@/utils/debug'

interface TextBasicInfo {
  text_id: string
  title: string
  author: string
  dynasty: string
  original_text: string
  illustration?: string
  bgm?: string
}

interface Props {
  wenId: string
  autoPlay?: boolean
  defaultVolume?: number
}

const props = withDefaults(defineProps<Props>(), {
  autoPlay: true,
  defaultVolume: 50,
})

const audioRef = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const isMuted = ref(false)
const volume = ref(props.defaultVolume)

const dataUrl = computed(() => `/data/text_basic_info/${props.wenId}.json`)

const { loading, error, data: basicInfo, retry } = useDataLoader<TextBasicInfo>(() => dataUrl.value)

const bgmUrl = computed(() => {
  if (!basicInfo.value?.bgm) return ''
  return getAssetUrl(`audio/${basicInfo.value.bgm}`)
})

function togglePlay() {
  if (!audioRef.value) return

  if (isPlaying.value) {
    audioRef.value.pause()
    isPlaying.value = false
  } else {
    audioRef.value.play().catch((err) => {
      debugError('[Repeatbgm] 播放失败:', err)
    })
    isPlaying.value = true
  }
}

function toggleMute() {
  if (!audioRef.value) return
  isMuted.value = !isMuted.value
  audioRef.value.muted = isMuted.value
}

function handleVolumeChange(event: Event) {
  const target = event.target as HTMLInputElement
  volume.value = Number(target.value)
  if (audioRef.value) {
    audioRef.value.volume = volume.value / 100
  }
}

function handleLoadedMetadata() {
  debugLog('[Repeatbgm] ✅ 背景音乐加载完成:', basicInfo.value?.bgm)

  if (audioRef.value) {
    audioRef.value.volume = volume.value / 100

    if (props.autoPlay) {
      audioRef.value.play().catch((err) => {
        debugWarn('[Repeatbgm] 自动播放失败（可能需要用户交互）:', err)
      })
    }
  }
}

function handleAudioError() {
  debugError('[Repeatbgm] ❌ 音频加载失败:', bgmUrl.value)
}

watch(bgmUrl, (newUrl) => {
  if (newUrl && audioRef.value) {
    audioRef.value.load()
    isPlaying.value = false
  }
})

onUnmounted(() => {
  if (audioRef.value) {
    audioRef.value.pause()
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
