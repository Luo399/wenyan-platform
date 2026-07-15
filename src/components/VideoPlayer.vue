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
    <!-- 视频播放区域 -->
    <div class="video-wrapper">
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
      -->
      <video
        ref="videoRef"
        :src="src"
        :poster="poster"
        @timeupdate="handleTimeUpdate"
        @loadedmetadata="handleLoadedMetadata"
        @play="isPlaying = true"
        @pause="isPlaying = false"
        @ended="handleEnded"
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
      <div class="progress-wrapper" @click="seek">
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

// ============================================================
// 组件 Props 定义
// ============================================================
// defineProps 是 Vue 3 Composition API 提供的宏，用于定义组件属性
const props = defineProps<{
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
      console.warn('播放失败:', err)
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
   ============================================================ */

/* 播放器最外层容器 */
.video-player-container {
  width: 100%;
  background-color: #000; /* 黑色背景 */
  border-radius: 0.5rem; /* 圆角边框 */
  overflow: hidden; /* 隐藏溢出内容 */
}

/* 视频播放区域容器 */
.video-wrapper {
  width: 100%;
  /* aspect-ratio 设置宽高比为 16:9，保持视频比例 */
  aspect-ratio: 16 / 9;
  background-color: #000; /* 黑色背景填充空白区域 */
}

/* 视频元素样式 */
.video-wrapper video {
  width: 100%; /* 宽度100%适配容器 */
  height: 100%; /* 高度100%适配容器 */
  /* object-fit: contain 保持视频原始比例，完整显示 */
  object-fit: contain;
}

/* ============================================================
   控制栏样式
   ============================================================ */

/* 控制栏容器：水平排列各控制元素 */
.controls-bar {
  display: flex; /* Flexbox 布局 */
  align-items: center; /* 垂直居中对齐 */
  gap: 0.75rem; /* 元素间距 */
  padding: 0.75rem; /* 内边距 */
  background-color: #1f2937; /* 深灰色背景 */
}

/* 播放/暂停按钮样式 */
.control-btn {
  padding: 0.375rem 0.75rem; /* 按钮内边距 */
  border: none; /* 无边框 */
  border-radius: 0.25rem; /* 圆角 */
  background-color: #3b82f6; /* 蓝色背景 */
  color: white; /* 白色文字 */
  font-size: 0.875rem; /* 字体大小 */
  cursor: pointer; /* 鼠标指针 */
  transition: background-color 0.2s; /* 过渡效果 */
  flex-shrink: 0; /* 不允许收缩 */
}

/* 按钮悬停状态：背景变深 */
.control-btn:hover {
  background-color: #2563eb;
}

/* 进度条容器 */
.progress-wrapper {
  flex: 1; /* 占据剩余空间 */
  cursor: pointer; /* 鼠标指针 */
  padding: 0.25rem 0; /* 上下内边距增加点击区域 */
}

/* 进度条轨道（背景） */
.progress-bar {
  height: 0.375rem; /* 进度条高度 */
  background-color: #4b5563; /* 灰色背景 */
  border-radius: 0.25rem; /* 圆角 */
  overflow: hidden; /* 隐藏溢出 */
}

/* 进度条填充（已播放部分） */
.progress-filled {
  height: 100%; /* 高度100%填充轨道 */
  background-color: #3b82f6; /* 蓝色填充 */
  /* transition 平滑过渡，使宽度变化有动画效果 */
  transition: width 0.1s linear;
}

/* 时间显示文本 */
.time-display {
  color: #e5e7eb; /* 浅灰色文字 */
  font-size: 0.875rem; /* 字体大小 */
  flex-shrink: 0; /* 不允许收缩 */
  min-width: 90px; /* 最小宽度 */
  text-align: right; /* 右对齐 */
}
</style>
