<!--
  RepeatBgm.vue - 背景音乐循环播放组件

  功能说明：
  1. 根据当前活动 wenId 自动加载对应的背景音乐
  2. 响应全局 BGM store 的状态变化
  3. 默认自动播放，初始音量为 20
  4. 提供播放/暂停控制和音量调节

  可访问性（R24）：
  - 按钮使用真实 <button>，带 aria-label / aria-pressed
  - volume-slider 带 aria-label / aria-valuemin/max/valuenow，用 :value + @input 而非 v-model 保证 aria 同步
  - audio 元素 aria-hidden，用控件状态 ARIA 呈现给屏幕阅读器
-->
<template>
  <div class="repeat-bgm">
    <!-- 加载状态 -->
    <BaseLoader v-if="loading" loading-text="加载背景音乐..." />

    <!-- 错误状态 -->
    <BaseError v-else-if="error" :error="error" @retry="retry" />

    <!-- 正常状态 -->
    <div v-else-if="currentBgmFile" class="bgm-controls">
      <!-- 音频元素：aria-hidden，用按钮 ARIA 呈现状态 -->
      <audio
        ref="audioRef"
        :src="bgmUrl"
        loop
        aria-hidden="true"
        @loadedmetadata="handleLoadedMetadata"
        @error="handleAudioError"
      />

      <!-- 播放/暂停按钮：aria-pressed 呈现 toggle 状态 -->
      <button
        type="button"
        class="bgm-btn"
        @click="handleTogglePlay"
        :aria-pressed="isPlaying"
        :aria-label="isPlaying ? '暂停背景音乐' : '播放背景音乐'"
      >
        <i :class="isPlaying ? 'fas fa-pause' : 'fas fa-play'" aria-hidden="true"></i>
        <span class="btn-text">{{ isPlaying ? '暂停' : '播放' }}背景音乐</span>
      </button>

      <!-- 音量控制 -->
      <div class="volume-control">
        <button
          type="button"
          class="volume-btn"
          @click="handleToggleMute"
          :aria-pressed="isMuted"
          :aria-label="isMuted ? '取消静音' : '静音'"
        >
          <i :class="muteIconClass" aria-hidden="true"></i>
        </button>
        <!--
          R24: range slider 完整 ARIA
            - aria-label: 用途说明
            - aria-valuemin/max/valuenow: 屏幕阅读器读"音量 20%"
        -->
        <input
          ref="sliderRef"
          type="range"
          min="0"
          max="100"
          :value="isMuted ? 0 : currentVolume"
          :aria-label="`音量 ${isMuted ? 0 : currentVolume}%`"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="isMuted ? 0 : currentVolume"
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

// R25: 派生变量全部收敛成显式 computed（死代码检查时更清晰，也避免 <i :class> 的 inline 三元长表达式）
const currentBgmFile = computed(() => bgmStore.currentBgmFile)
const isPlaying = computed(() => bgmStore.isPlaying)
const currentVolume = computed(() => bgmStore.volume)
const isMuted = computed(() => bgmStore.isMuted)
const muteIconClass = computed(() => {
  if (isMuted.value) return 'fas fa-volume-mute'
  if (currentVolume.value === 0) return 'fas fa-volume-off'
  return 'fas fa-volume-up'
})

const bgmUrl = computed(() => {
  if (!currentBgmFile.value) return ''
  return getAssetUrl('audio', currentBgmFile.value)
})

// 监听路由变化，自动更新 wenId
watch(
  () => route.params.id,
  (newId) => {
    if (newId) {
      const wenId = getWenId(newId as string)
      debugLog('[RepeatBgm] 路由变化，更新wenId:', wenId)
      bgmStore.setActiveWenId(wenId)
    }
  },
  { immediate: true },
)

// 监听 BGM 文件变化：重新加载音频（保留音量/静音状态）
watch(currentBgmFile, (newFile, oldFile) => {
  if (newFile && newFile !== oldFile && audioRef.value) {
    debugLog('[RepeatBgm] BGM文件变化:', oldFile, '->', newFile)
    audioRef.value.pause()
    // 先同步音量/静音，避免切歌后音量跳变
    audioRef.value.volume = currentVolume.value / 100
    audioRef.value.muted = isMuted.value
    audioRef.value.load()
    bgmStore.pause()
  }
})

// 监听 store 播放状态变化：sync 到 audio 元素
watch(
  () => bgmStore.isPlaying,
  (playing) => {
    if (!audioRef.value) return
    if (playing) {
      audioRef.value.play().catch((err) => {
        debugWarn('[RepeatBgm] 播放失败:', err)
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
    if (audioRef.value) audioRef.value.volume = newVolume / 100
  },
)

// 监听静音状态变化
watch(
  () => bgmStore.isMuted,
  (muted) => {
    if (audioRef.value) audioRef.value.muted = muted
  },
)

function handleLoadedMetadata() {
  debugLog('[RepeatBgm] 背景音乐加载完成:', currentBgmFile.value)
  if (!audioRef.value) return
  audioRef.value.volume = currentVolume.value / 100
  audioRef.value.muted = isMuted.value
  // 默认自动播放（浏览器可能拦截，失败则回到 pause 状态）
  bgmStore.play()
}

function handleAudioError() {
  debugError('[RepeatBgm] 音频加载失败:', bgmUrl.value)
  error.value = '背景音乐加载失败'
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
  if (audioRef.value) audioRef.value.load()
}

onMounted(() => {
  debugLog('[RepeatBgm] 组件挂载')
})

onUnmounted(() => {
  debugLog('[RepeatBgm] 组件卸载')
  if (audioRef.value) {
    audioRef.value.pause()
    // R26: 卸载时先解绑事件监听再清空 src，避免某些浏览器空 src 触发一次 error
    audioRef.value.removeAttribute('src')
    audioRef.value.load()
  }
})
</script>

<style scoped>
.repeat-bgm {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-xs);
  font-family: var(--font-family-serif);
}

.bgm-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

/* 背景音乐按钮（朱红底 + 橄榄绿边框 + 药丸圆角） */
.bgm-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-primary);
  color: var(--color-white);
  border: var(--border-width-thin) solid var(--color-border);
  border-radius: var(--radius-button);
  cursor: pointer;
  font-size: var(--font-size-small);
  transition: all 0.3s ease;
  /* R27: 焦点可见状态 */
  outline: none;
}

.bgm-btn:hover,
.bgm-btn:focus-visible {
  transform: translateY(-2px);
  box-shadow: var(--shadow-small);
}

.bgm-btn:focus-visible {
  outline: var(--border-width-thin) solid var(--color-white);
  outline-offset: 2px;
}

.bgm-btn:active {
  transform: translateY(0);
}

.btn-text {
  font-weight: var(--font-weight-semibold);
}

.volume-control {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.volume-btn {
  padding: var(--spacing-xs);
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition:
    color 0.2s,
    outline-color 0.2s;
  border-radius: var(--radius-small);
  outline: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* 避免纯 icon 按钮过小，点击区域 ≥ 32px WCAG */
  min-width: var(--control-min-size);
  min-height: var(--control-min-size);
}

.volume-btn:hover,
.volume-btn:focus-visible {
  color: var(--color-text);
}

.volume-btn:focus-visible {
  outline: var(--border-width-thin) solid var(--color-primary);
  outline-offset: 1px;
}

.volume-slider {
  width: 80px;
  height: 4px;
  appearance: none;
  background: var(--color-placeholder);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

/* R27: 滑块 focus ring */
.volume-slider:focus-visible {
  outline: var(--border-width-thin) solid var(--color-primary);
  outline-offset: 2px;
}

.volume-slider::-webkit-slider-thumb {
  appearance: none;
  width: 12px;
  height: 12px;
  background: var(--color-primary);
  border-radius: 50%;
  cursor: pointer;
}

.volume-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: var(--color-primary);
  border-radius: 50%;
  cursor: pointer;
  border: none;
}
</style>
