<!--
  DialogueCard.vue - Block模式对话卡片组件
  
  专门用于Block模式，直接从props接收单条对话数据
  支持下划线命名的属性（pre_dialog, audio_file, icon_dialog）
-->
<template>
  <div class="dialogue-card">
    <div class="dialogue-bubble" :class="speakerClass">
      <!-- 头像 -->
      <div class="dialogue-avatar" v-if="iconDialog">
        <img
          :src="getIconUrl(iconDialog)"
          :alt="speakerName"
          class="avatar-image"
          @error="handleImageError"
        />
      </div>
      <div class="dialogue-avatar" v-else>
        <i class="fas fa-user-circle"></i>
      </div>

      <!-- 内容区域 -->
      <div class="dialogue-content">
        <div class="dialogue-speaker">{{ speakerName }}</div>
        <div class="dialogue-text-content">
          <span v-for="(char, index) in displayedText" :key="index" class="dialogue-char">{{
            char
          }}</span>
        </div>
      </div>

      <!-- 播放按钮 -->
      <div class="dialogue-actions">
        <button
          class="dialogue-action-btn play-btn"
          v-if="audioFile"
          @click="toggleAudio"
          :class="{ playing: isPlaying }"
        >
          <i :class="isPlaying ? 'fas fa-pause' : 'fas fa-play'"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue'
import { getAssetUrl } from '@/utils/asset'
import { debugError } from '@/utils/debug'

interface Props {
  // Block模式数据（下划线命名）
  text_id?: string
  pre_dialog?: string
  audio_file?: string
  icon_dialog?: string

  // 兼容旧版命名
  textId?: string
  dialogText?: string
  audioFile?: string
  iconDialog?: string

  autoType?: boolean
  typeSpeed?: number
}

const props = withDefaults(defineProps<Props>(), {
  autoType: true,
  typeSpeed: 50,
})

const emit = defineEmits<{
  (e: 'audio-play', audioFile: string): void
  (e: 'audio-pause'): void
}>()

// 解析说话者名称
const speakerName = computed(() => {
  const text = props.pre_dialog || props.dialogText || ''
  const match = text.match(/^(.+?)：/)
  if (match) {
    return match[1]
  }
  return '未知角色'
})

// 获取实际文本内容（去除说话者名称）
const dialogContent = computed(() => {
  const text = props.pre_dialog || props.dialogText || ''
  const match = text.match(/^.+?：(.+)$/)
  if (match) {
    return match[1]
  }
  return text
})

// 下划线属性兼容
const audioFile = computed(() => props.audio_file || props.audioFile)
const iconDialog = computed(() => props.icon_dialog || props.iconDialog)

// 打字机效果
const displayedText = ref('')
const isPlaying = ref(false)
let typeInterval: ReturnType<typeof setInterval> | null = null
let audio: HTMLAudioElement | null = null

// R71: 基于说话者名动态生成 class，避免硬编码角色名
const speakerClass = computed(() => {
  const speaker = speakerName.value
  if (!speaker) return ''
  const slug = speaker.replace(/[\s：:，,]/g, '').toLowerCase()
  return `speaker-${slug}`
})

// 打字机效果
function typeText() {
  const content = dialogContent.value
  if (!content) return

  displayedText.value = ''
  let index = 0

  if (typeInterval) {
    clearInterval(typeInterval)
  }

  typeInterval = setInterval(() => {
    if (index < content.length) {
      displayedText.value += content[index]
      index++
    } else {
      if (typeInterval) {
        clearInterval(typeInterval)
        typeInterval = null
      }
    }
  }, props.typeSpeed)
}

// 切换音频播放
function toggleAudio() {
  if (!audioFile.value) return

  if (isPlaying.value) {
    pauseAudio()
  } else {
    playAudio()
  }
}

function playAudio() {
  if (!audioFile.value) return

  // R56: 创建新 Audio 前彻底清理旧实例，避免内存泄漏与音频叠加
  if (audio) {
    audio.pause()
    audio.onended = null
    audio = null
  }

  audio = new Audio(getAssetUrl('audio', `${audioFile.value}.mp3`))
  audio.onended = () => {
    isPlaying.value = false
    emit('audio-pause')
  }

  audio
    .play()
    .then(() => {
      isPlaying.value = true
      emit('audio-play', audioFile.value as string)
    })
    .catch((e) => {
      debugError('音频播放失败:', e)
    })
}

function pauseAudio() {
  if (audio) {
    audio.pause()
    isPlaying.value = false
    emit('audio-pause')
  }
}

// 获取头像URL
// R70: 用 getAssetUrl 替代硬编码 /img/
function getIconUrl(iconName: string): string {
  return getAssetUrl('images', iconName)
}

// 处理图片加载失败
function handleImageError(e: Event) {
  const target = e.target as HTMLImageElement
  // 替换为内联占位图，避免重复触发
  if (target.src.startsWith('data:image/svg+xml')) return
  target.src =
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f5f5f5"/><circle cx="50" cy="40" r="10" fill="none" stroke="#ccc" stroke-width="1.5"/><rect x="35" y="55" width="30" height="20" rx="3" fill="none" stroke="#ccc" stroke-width="1.5"/><text x="50" y="88" text-anchor="middle" fill="#bbb" font-size="8" font-family="sans-serif">加载失败</text></svg>`,
    )
}

// R74: watch immediate 替代 watch + onMounted 的重复逻辑
function syncDisplayedText() {
  if (props.autoType) {
    typeText()
  } else {
    displayedText.value = dialogContent.value || ''
  }
}

watch(dialogContent, syncDisplayedText, { immediate: true })

onUnmounted(() => {
  if (typeInterval) {
    clearInterval(typeInterval)
  }
  if (audio) {
    audio.pause()
    audio = null
  }
})
</script>

<style scoped>
.dialogue-card {
  width: 100%;
  margin-bottom: var(--spacing-md);
}

.dialogue-bubble {
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--color-bg-highlight);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-small);
  border: var(--border-width-hairline) solid var(--color-placeholder);
}

.dialogue-bubble.speaker-chen {
  border-left: 4px solid var(--color-primary);
}

.dialogue-bubble.speaker-wu {
  border-left: 4px solid var(--color-border);
}

.dialogue-bubble.speaker-soldier {
  border-left: 4px solid var(--color-accent);
}

.dialogue-avatar {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-white);
  font-size: 20px;
  overflow: hidden;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dialogue-content {
  flex: 1;
  min-width: 0;
}

.dialogue-speaker {
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  margin-bottom: 4px;
}

.dialogue-text-content {
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text-secondary);
  word-break: break-word;
}

.dialogue-char {
  display: inline;
}

.dialogue-actions {
  flex-shrink: 0;
}

.dialogue-action-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: var(--color-primary);
  color: var(--color-white);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.dialogue-action-btn:hover {
  transform: scale(1.1);
  box-shadow: var(--shadow-small);
}

.dialogue-action-btn.play-btn.playing {
  background: var(--color-primary-hover);
}

@media (max-width: 768px) {
  .dialogue-bubble {
    padding: var(--spacing-sm);
    gap: 10px;
  }

  .dialogue-avatar {
    width: 40px;
    height: 40px;
    font-size: 16px;
  }

  .dialogue-speaker {
    font-size: 12px;
  }

  .dialogue-text-content {
    font-size: 13px;
  }
}
</style>
