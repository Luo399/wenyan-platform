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
          <span v-for="(char, index) in displayedText" :key="index" class="dialogue-char">{{ char }}</span>
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { getAssetUrl } from '@/utils/asset'

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

const speakerClass = computed(() => {
  const speaker = speakerName.value
  if (!speaker) return ''
  if (speaker.includes('陈胜')) return 'speaker-chen'
  if (speaker.includes('吴广')) return 'speaker-wu'
  if (speaker.includes('戍卒')) return 'speaker-soldier'
  return ''
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
  
  if (audio) {
    audio.pause()
  }
  
  audio = new Audio(getAssetUrl(`audio/${audioFile.value}.mp3`))
  audio.onended = () => {
    isPlaying.value = false
    emit('audio-pause')
  }
  
  audio.play().then(() => {
    isPlaying.value = true
    emit('audio-play', audioFile.value as string)
  }).catch((e) => {
    console.error('音频播放失败:', e)
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
function getIconUrl(iconName: string): string {
  return `/img/${iconName}`
}

// 处理图片加载失败
function handleImageError(e: Event) {
  const target = e.target as HTMLImageElement
  target.style.display = 'none'
}

// 监听内容变化
watch(dialogContent, () => {
  if (props.autoType) {
    typeText()
  } else {
    displayedText.value = dialogContent.value || ''
  }
})

onMounted(() => {
  if (props.autoType) {
    typeText()
  } else {
    displayedText.value = dialogContent.value || ''
  }
})

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
  margin-bottom: 1rem;
}

.dialogue-bubble {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid #e2e8f0;
}

.dialogue-bubble.speaker-chen {
  border-left: 4px solid #3b82f6;
}

.dialogue-bubble.speaker-wu {
  border-left: 4px solid #10b981;
}

.dialogue-bubble.speaker-soldier {
  border-left: 4px solid #f59e0b;
}

.dialogue-avatar {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
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
  font-weight: 600;
  color: #374151;
  margin-bottom: 4px;
}

.dialogue-text-content {
  font-size: 14px;
  line-height: 1.6;
  color: #4b5563;
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.dialogue-action-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.dialogue-action-btn.play-btn.playing {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

@media (max-width: 768px) {
  .dialogue-bubble {
    padding: 12px;
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