<!--
  VideoPlayer.vue - 自定义视频播放器组件

  功能说明：
  1. 支持播放/暂停控制
  2. 显示播放进度条（可点击跳转）
  3. 显示当前时间和总时长
  4. 支持视频封面图
  5. 不包含倍速播放功能

  使用示例：
  <VideoPlayer src="/path/to/video.mp4" poster="/path/to/poster.jpg" />
-->
<template>
  <!-- 播放器最外层容器 -->
  <div class="video-player-container">
    <!-- 视频加载失败占位符 -->
    <div v-if="loadError" class="video-error-placeholder">
      <div class="error-icon">
        <svg viewBox="0 0 64 64" fill="none" width="48" height="48">
          <rect
            x="8"
            y="12"
            width="48"
            height="36"
            rx="4"
            stroke="currentColor"
            stroke-width="2.5"
            fill="none"
          />
          <circle cx="32" cy="34" r="8" stroke="currentColor" stroke-width="2" fill="none" />
          <path
            d="M28 30l8 8M36 30l-8 8"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
          <polygon points="28,24 44,34 28,44" fill="currentColor" opacity="0.3" />
        </svg>
      </div>
      <p class="error-text">视频加载失败</p>
      <p class="error-hint">请检查网络后刷新页面重试</p>
      <button class="retry-btn" @click="retryLoad">重新加载</button>
    </div>

    <!-- 视频播放区域（加载失败时隐藏） -->
    <div v-show="!loadError" class="video-wrapper">
      <!--
        video 元素：
        - ref: 用于获取 DOM 引用，以便 JavaScript 操作
        - src: 视频文件地址
        - poster: 封面图片（视频未播放时显示）
        - 事件监听：
          * timeupdate: 播放过程中定期触发，更新当前播放时间
          * loadedmetadata: 视频元数据加载完成，获取总时长
          * play: 开始播放时触发
          * pause: 暂停播放时触发
          * ended: 播放结束时触发
          * error: 视频加载失败时触发
      -->
      <video
        ref="videoRef"
        :src="src"
        :poster="poster"
        @timeupdate="handleTimeUpdate"
        @loadedmetadata="handleLoadedMetadata"
        @play="handlePlay"
        @pause="handlePause"
        @ended="handleEnded"
        @error="handleVideoError"
      ></video>
    </div>

    <!-- 自定义控制栏区域 -->
    <div class="controls-bar">
      <!-- 播放/暂停切换按钮 -->
      <!-- 根据 isPlaying 状态显示不同文字 -->
      <button class="control-btn play-btn" @click="togglePlay">
        {{ isPlaying ? '暂停' : '播放' }}
      </button>

      <!-- 进度条区域 -->
      <!-- 点击整个进度条可以跳转到对应位置 -->
      <div
        class="progress-wrapper"
        role="slider"
        tabindex="0"
        :aria-valuenow="Math.round(progressPercent)"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="`播放进度 ${Math.round(progressPercent)}%`"
        @click="seek"
        @keydown.left="seekBy(-0.05)"
        @keydown.right="seekBy(0.05)"
      >
        <!-- 进度条背景轨道 -->
        <div class="progress-bar">
          <!-- 进度条填充部分，宽度根据播放进度动态计算 -->
          <div class="progress-filled" :style="{ width: progressPercent + '%' }"></div>
        </div>
      </div>

      <!-- 时间显示区域 -->
      <!-- 格式：当前时间 / 总时长 -->
      <span class="time-display"> {{ formatTime(currentTime) }} / {{ formatTime(duration) }} </span>
    </div>
  </div>
</template>

<script setup lang="ts">
// 引入 Vue 的响应式 API
import { ref, computed } from 'vue'
import { debugWarn } from '@/utils/debug'

// ============================================================
// 组件 Props 定义
// ============================================================
const props = withDefaults(
  defineProps<{
    /**
     * 视频文件的 URL 地址
     * 支持本地路径或网络 URL
     */
    src: string

    /**
     * 视频封面图片的 URL 地址
     * 可选属性：视频未播放时显示的图片
     */
    poster?: string
  }>(),
  {
    poster: '',
  },
)

// 组件事件：播放/暂停/结束，供父组件埋点
const emit = defineEmits<{
  (e: 'play'): void
  (e: 'pause'): void
  (e: 'ended'): void
}>()

// ============================================================
// 响应式状态定义
// ============================================================
// ref() 创建响应式引用，用于追踪状态变化

/**
 * 视频 DOM 元素的引用
 * 类型为 HTMLVideoElement 或 null（初始值为 null）
 * 用于调用 video 元素的原生方法如 play()、pause()
 */
const videoRef = ref<HTMLVideoElement | null>(null)

/**
 * 播放状态标记
 * true = 正在播放，false = 已暂停
 */
const isPlaying = ref(false)

/**
 * 当前播放位置（单位：秒）
 * 随着视频播放实时更新
 */
const currentTime = ref(0)

/**
 * 视频总时长（单位：秒）
 * 在 loadedmetadata 事件触发后从元数据中获取
 */
const duration = ref(0)

/**
 * 视频加载失败标记
 */
const loadError = ref(false)

// ============================================================
// 计算属性
// ============================================================
// computed() 创建计算属性，基于响应式数据自动计算

/**
 * 计算进度条填充百分比
 * 公式：已播放时间 / 总时长 * 100
 * 用于动态设置进度条填充元素的宽度
 */
const progressPercent = computed(() => {
  // 防止除以零，返回 0
  if (duration.value === 0) return 0
  // 计算百分比并返回
  return (currentTime.value / duration.value) * 100
})

// ============================================================
// 事件处理函数
// ============================================================

/**
 * 切换播放/暂停状态
 * 点击按钮时调用
 *
 * 逻辑说明：
 * 1. 如果当前正在播放，则暂停
 * 2. 如果当前已暂停，则开始播放
 */
function togglePlay() {
  // 安全检查：确保 videoRef 已正确绑定
  if (!videoRef.value) return

  if (isPlaying.value) {
    // 暂停视频
    videoRef.value.pause()
  } else {
    // 开始播放视频
    // play() 返回 Promise，需要处理可能的错误（如浏览器自动播放策略阻止）
    videoRef.value.play().catch((err) => {
      debugWarn('播放失败:', err)
      isPlaying.value = false
    })
  }
}

/**
 * 处理时间更新事件
 *
 * 触发时机：
 * - 视频播放过程中，浏览器会大约每 250ms 触发一次
 *
 * 功能：
 * - 同步更新 currentTime 状态，触发 UI 进度条更新
 */
function handleTimeUpdate() {
  if (videoRef.value) {
    // 从 video 元素获取当前的播放时间
    currentTime.value = videoRef.value.currentTime
  }
}

/**
 * 处理视频元数据加载完成事件
 *
 * 触发时机：
 * - 浏览器解析完视频文件的头信息后触发
 *
 * 功能：
 * - 获取视频的总时长（duration）
 * - 此时才知道视频有多长
 */
function handleLoadedMetadata() {
  if (videoRef.value) {
    // 从 video 元素获取视频总时长
    duration.value = videoRef.value.duration
  }
}

/**
 * 处理播放事件
 */
function handlePlay() {
  isPlaying.value = true
  emit('play')
}

/**
 * 处理暂停事件
 */
function handlePause() {
  isPlaying.value = false
  emit('pause')
}

/**
 * 处理视频播放结束事件
 *
 * 触发时机：
 * - 视频播放到最后一帧时触发
 *
 * 功能：
 * 1. 重置播放状态为暂停
 * 2. 重置当前播放时间为 0
 * 3. 将视频播放位置重置到开头
 */
function handleEnded() {
  // 重置播放状态
  isPlaying.value = false
  // 重置当前时间
  currentTime.value = 0
  // 将视频播放位置重置到开头
  if (videoRef.value) {
    videoRef.value.currentTime = 0
  }
}

/**
 * 处理视频加载错误
 * 显示加载失败占位符
 */
function handleVideoError() {
  loadError.value = true
  isPlaying.value = false
  debugWarn('视频加载失败:', src)
}

/**
 * 重新加载视频
 * 重置错误状态，重新加载视频源
 */
function retryLoad() {
  loadError.value = false
  // 通过重新设置 src 触发重新加载
  if (videoRef.value) {
    const currentSrc = videoRef.value.src
    videoRef.value.src = ''
    // 强制浏览器重新加载
    setTimeout(() => {
      if (videoRef.value) {
        videoRef.value.src = currentSrc
        videoRef.value.load()
      }
    }, 100)
  }
}

/**
 * 处理进度条点击跳转
 *
 * 功能：
 * - 根据用户点击位置，计算对应的播放时间
 * - 将视频跳转到指定位置
 *
 * @param event - 鼠标点击事件对象
 *
 * 算法说明：
 * 1. 获取进度条元素的位置信息（getBoundingClientRect）
 * 2. 计算点击位置相对于元素左边的百分比
 * 3. 用百分比乘以总时长，得到目标播放时间
 * 4. 设置 video 的 currentTime 属性实现跳转
 */
function seek(event: MouseEvent) {
  // 安全检查：确保视频已加载且有有效的总时长
  if (!videoRef.value || duration.value === 0) return

  // 获取进度条 DOM 元素
  const target = event.currentTarget as HTMLElement

  // 获取元素相对于视口的位置和尺寸
  const rect = target.getBoundingClientRect()

  // 计算点击位置占整个进度条宽度的百分比
  // event.clientX: 鼠标点击位置相对于视口左边的距离
  // rect.left: 进度条元素相对于视口左边的距离
  const percent = (event.clientX - rect.left) / rect.width

  // 计算对应的播放时间（秒）
  const seekTime = percent * duration.value

  // 执行跳转
  if (videoRef.value) {
    videoRef.value.currentTime = seekTime
    // 同时更新当前时间状态，保持 UI 同步
    currentTime.value = seekTime
  }
}

/**
 * R64: 键盘按左右箭头按步长跳转
 * @param delta - 相对增量（0~1），负值后退、正值前进
 */
function seekBy(delta: number) {
  if (!videoRef.value || duration.value === 0) return
  const target = Math.max(0, Math.min(1, currentTime.value / duration.value + delta))
  const seekTime = target * duration.value
  videoRef.value.currentTime = seekTime
  currentTime.value = seekTime
}

/**
 * 格式化时间显示
 *
 * 功能：
 * - 将秒数转换为 "mm:ss" 格式的字符串
 * - 例如：90 秒 -> "01:30"
 *
 * @param seconds - 未格式化的秒数
 * @returns 格式化后的时间字符串
 *
 * 算法说明：
 * 1. 用 Math.floor 取整得到整数分钟和整数秒
 * 2. 使用 padStart(2, '0') 确保两位数显示（05, 10 等）
 */
function formatTime(seconds: number): string {
  // 计算分钟数（向下取整）
  const mins = Math.floor(seconds / 60)
  // 计算剩余秒数
  const secs = Math.floor(seconds % 60)
  // 格式化为两位数并用冒号连接
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
</script>

<style scoped>
/* ============================================================
   样式说明：
   - 使用 scoped 确保样式仅在当前组件内生效
   - 采用 Flexbox 布局实现控制栏的水平排列
   - 颜色与字体遵循设计 token 规范
   ============================================================ */

/* 播放器最外层容器 */
.video-player-container {
  width: 100%;
  /* 黑色背景（视频播放区域） */
  background-color: var(--color-text);
  border-radius: var(--radius-small); /* 圆角边框 */
  overflow: hidden; /* 隐藏溢出内容 */
  /* 使用设计 token 衬线字体 */
  font-family: var(--font-family-serif);
}

/* 视频播放区域容器 */
.video-wrapper {
  width: 100%;
  /* aspect-ratio 设置宽高比为 16:9，保持视频比例 */
  aspect-ratio: 16 / 9;
  background-color: var(--color-text); /* 黑色背景填充空白区域 */
}

/* 视频元素样式 */
.video-wrapper video {
  width: 100%; /* 宽度100%适配容器 */
  height: 100%; /* 高度100%适配容器 */
  /* object-fit: contain 保持视频原始比例，完整显示 */
  object-fit: contain;
}

/* 视频加载失败占位符 */
.video-error-placeholder {
  width: 100%;
  aspect-ratio: 16 / 9;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg-secondary, #f5f5f5);
  gap: var(--spacing-sm, 8px);
  color: var(--color-text-secondary, #999);
}

.error-icon {
  opacity: 0.6;
  margin-bottom: 4px;
}

.error-text {
  font-size: var(--font-size-body, 16px);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--color-text, #333);
  margin: 0;
}

.error-hint {
  font-size: var(--font-size-small, 13px);
  color: var(--color-text-secondary, #999);
  margin: 0;
}

.retry-btn {
  margin-top: 8px;
  padding: 6px 20px;
  border: 1px solid var(--color-border, #ccc);
  border-radius: var(--radius-button, 50px);
  background-color: var(--color-white, #fff);
  color: var(--color-text, #333);
  font-family: var(--font-family-serif, serif);
  font-size: var(--font-size-small, 13px);
  cursor: pointer;
  transition: background-color 0.2s;
}

.retry-btn:hover {
  background-color: var(--color-bg-highlight, #f0efe9);
}

/* ============================================================
   控制栏样式
   ============================================================ */

/* 控制栏容器：水平排列各控制元素 */
.controls-bar {
  display: flex; /* Flexbox 布局 */
  align-items: center; /* 垂直居中对齐 */
  gap: var(--spacing-sm); /* 元素间距 */
  padding: var(--spacing-sm); /* 内边距 */
  /* 视频控制栏深色背景，设计 token 无对应深色变量，保留原值 */
  background-color: #1f2937;
}

/* 播放/暂停按钮样式（文字按钮：朱红底 + 橄榄绿边框 + 药丸圆角） */
.control-btn {
  padding: var(--spacing-xs) var(--spacing-sm); /* 按钮内边距 */
  border: var(--border-width-thin) solid var(--color-border); /* 橄榄绿边框 */
  border-radius: var(--radius-button); /* 药丸圆角 */
  background-color: var(--color-primary); /* 朱红主色底 */
  color: var(--color-white); /* 白色文字 */
  font-size: var(--font-size-small); /* 字体大小 */
  cursor: pointer; /* 鼠标指针 */
  transition: background-color 0.2s; /* 过渡效果 */
  flex-shrink: 0; /* 不允许收缩 */
}

/* 按钮悬停状态：暗红 */
.control-btn:hover {
  background-color: var(--color-primary-hover);
}

/* 进度条容器 */
.progress-wrapper {
  flex: 1; /* 占据剩余空间 */
  cursor: pointer; /* 鼠标指针 */
  padding: 0.25rem 0; /* 上下内边距增加点击区域 */
}

/* R64: 键盘聚焦可见样式 */
.progress-wrapper:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: var(--radius-small);
}

/* 进度条轨道（背景） */
.progress-bar {
  height: 0.375rem; /* 进度条高度 */
  /* 灰色轨道（深色控制栏上的次要灰） */
  background-color: var(--color-text-secondary);
  border-radius: var(--radius-small); /* 圆角 */
  overflow: hidden; /* 隐藏溢出 */
}

/* 进度条填充（已播放部分） */
.progress-filled {
  height: 100%; /* 高度100%填充轨道 */
  background-color: var(--color-primary); /* 朱红主色填充 */
  /* transition 平滑过渡，使宽度变化有动画效果 */
  transition: width 0.1s linear;
}

/* 时间显示文本 */
.time-display {
  color: var(--color-white); /* 白色文字（深色背景上） */
  font-size: var(--font-size-small); /* 字体大小 */
  flex-shrink: 0; /* 不允许收缩 */
  min-width: 90px; /* 最小宽度 */
  text-align: right; /* 右对齐 */
}
</style>
