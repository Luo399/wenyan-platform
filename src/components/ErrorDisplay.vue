<!--
  ErrorDisplay.vue - 统一错误展示组件

  功能说明：
  - 统一展示各类资源错误信息
  - 支持多种资源类型：视频(video)、音频(mp3)、图片(img)、数据(json)
  - 显示错误来源（组件/页面名称）
  - 提供详细的错误信息和解决方案
  - 支持重试功能

  使用示例：
  <ErrorDisplay
    :error="error"
    source="VideoPlayer"
    resource-type="video"
    resource-path="/video/WEN_01_rule_bg.mp4"
    @retry="handleRetry"
  />

  Props:
  - error: 错误信息
  - source: 错误来源（组件/页面名称）
  - resourceType: 资源类型（video/mp3/img/json）
  - resourcePath: 资源路径
  - showRetry: 是否显示重试按钮（默认true）
  - solution: 自定义解决方案（可选）
-->
<template>
  <div class="error-display" :class="errorClass">
    <!-- 错误图标 -->
    <div class="error-icon">
      <i class="fas" :class="iconClass"></i>
    </div>

    <!-- 错误内容 -->
    <div class="error-content">
      <!-- 错误标题 -->
      <h3 class="error-title">{{ errorTitle }}</h3>

      <!-- 错误来源 -->
      <div class="error-source">
        <span class="source-label">组件：</span>
        <span class="source-value">{{ source }}</span>
      </div>

      <!-- 资源类型 -->
      <div class="resource-type">
        <span class="type-label">类型：</span>
        <span class="type-value" :class="`type-${resourceType}`">{{ resourceTypeLabel }}</span>
      </div>

      <!-- 资源路径 -->
      <div class="resource-path">
        <span class="path-label">路径：</span>
        <span class="path-value">{{ resourcePath }}</span>
      </div>

      <!-- 错误详情 -->
      <div class="error-detail">
        <span class="detail-label">原因：</span>
        <span class="detail-value">{{ errorMessage }}</span>
      </div>

      <!-- 解决方案 -->
      <div class="solution">
        <span class="solution-label">建议：</span>
        <ul class="solution-list">
          <li v-for="(item, index) in solutionItems" :key="index">{{ item }}</li>
        </ul>
      </div>

      <!-- 错误时间 -->
      <div class="error-time">
        <span class="time-label">时间：</span>
        <span class="time-value">{{ errorTime }}</span>
      </div>

      <!-- 重试按钮 -->
      <button v-if="showRetry" class="retry-btn" @click="$emit('retry')">
        <i class="fas fa-redo"></i>
        <span>重试加载</span>
      </button>

      <!-- 展开详情 -->
      <button v-if="hasDetail" class="detail-btn" @click="showMore = !showMore">
        <i class="fas" :class="showMore ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
        <span>{{ showMore ? '收起详情' : '查看详情' }}</span>
      </button>

      <!-- 更多详情 -->
      <div v-if="showMore && hasDetail" class="error-more">
        <pre class="error-stack">{{ error }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  error: string | Error
  source: string
  resourceType?: 'video' | 'mp3' | 'img' | 'json' | 'other'
  resourcePath?: string
  showRetry?: boolean
  solution?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  resourceType: 'other',
  resourcePath: '',
  showRetry: true,
})

defineEmits<{
  (e: 'retry'): void
}>()

const showMore = ref(false)
const errorTime = ref(new Date().toLocaleString('zh-CN'))

// 错误样式类
const errorClass = computed(() => `error-type-${props.resourceType}`)

// 图标类
const iconClass = computed(() => {
  const icons: Record<string, string> = {
    video: 'fa-video',
    mp3: 'fa-music',
    img: 'fa-image',
    json: 'fa-file-code',
    other: 'fa-exclamation-circle',
  }
  return icons[props.resourceType] || icons.other
})

// 错误标题
const errorTitle = computed(() => {
  const titles: Record<string, string> = {
    video: '视频资源加载失败',
    mp3: '音频资源加载失败',
    img: '图片资源加载失败',
    json: '数据资源加载失败',
    other: '资源加载失败',
  }
  return titles[props.resourceType] || titles.other
})

// 资源类型标签
const resourceTypeLabel = computed(() => {
  const labels: Record<string, string> = {
    video: '视频 (Video)',
    mp3: '音频 (MP3)',
    img: '图片 (Image)',
    json: '数据 (JSON)',
    other: '其他资源',
  }
  return labels[props.resourceType] || labels.other
})

// 错误消息
const errorMessage = computed(() => {
  if (typeof props.error === 'string') {
    return props.error
  }
  return props.error.message || '未知错误'
})

// 解决方案列表
const solutionItems = computed(() => {
  // 默认解决方案
  const defaultSolutions: Record<string, string[]> = {
    video: [
      '检查视频文件是否存在于指定路径',
      '确认视频格式是否被浏览器支持（推荐 MP4/H.264）',
      '检查网络连接是否正常',
      '尝试刷新页面重试',
    ],
    mp3: [
      '检查音频文件是否存在于指定路径',
      '确认音频格式是否被浏览器支持（推荐 MP3）',
      '检查网络连接是否正常',
      '尝试刷新页面重试',
    ],
    img: [
      '检查图片文件是否存在于指定路径',
      '确认图片格式是否被浏览器支持（JPG/PNG/WebP）',
      '检查网络连接是否正常',
      '尝试清除浏览器缓存后重试',
    ],
    json: [
      '检查JSON文件是否存在于指定路径',
      '确认JSON格式是否正确（使用JSON校验工具检查）',
      '检查API接口是否正常响应',
      '检查网络连接是否正常',
    ],
    other: [
      '检查资源文件是否存在',
      '检查网络连接是否正常',
      '尝试刷新页面重试',
      '联系管理员获取帮助',
    ],
  }

  if (props.solution && props.solution.length > 0) {
    return props.solution
  }
  return defaultSolutions[props.resourceType] || defaultSolutions.other
})

// 是否有更多详情
const hasDetail = computed(() => {
  const errorStr = typeof props.error === 'string' ? props.error : props.error.message
  return errorStr.length > 50 || props.resourcePath?.length > 30
})
</script>

<style scoped>
.error-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem;
  border-radius: 0.5rem;
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  gap: 0.75rem;
  max-width: 500px;
  margin: 1rem auto;
}

/* 不同资源类型的样式 */
.error-type-video {
  background-color: #fff7ed;
  border-color: #fed7aa;
}

.error-type-mp3 {
  background-color: #f0fdf4;
  border-color: #86efac;
}

.error-type-img {
  background-color: #eff6ff;
  border-color: #bfdbfe;
}

.error-type-json {
  background-color: #faf5ff;
  border-color: #c4b5fd;
}

.error-type-other {
  background-color: #fef2f2;
  border-color: #fecaca;
}

/* 图标样式 */
.error-icon {
  font-size: 2.5rem;
  color: #ef4444;
}

.error-type-video .error-icon {
  color: #ea580c;
}

.error-type-mp3 .error-icon {
  color: #16a34a;
}

.error-type-img .error-icon {
  color: #2563eb;
}

.error-type-json .error-icon {
  color: #7c3aed;
}

/* 错误内容 */
.error-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  width: 100%;
}

.error-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  width: 100%;
  text-align: center;
}

/* 信息行样式 */
.error-source,
.resource-type,
.resource-path,
.error-detail,
.error-time {
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  font-size: 0.875rem;
  width: 100%;
  flex-wrap: wrap;
}

.source-label,
.type-label,
.path-label,
.detail-label,
.time-label,
.solution-label {
  color: #6b7280;
  font-weight: 500;
  flex-shrink: 0;
}

.source-value {
  color: #3b82f6;
  font-weight: 500;
  font-family: 'Monaco', 'Consolas', monospace;
}

.type-value {
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.type-video {
  background-color: #fed7aa;
  color: #ea580c;
}

.type-mp3 {
  background-color: #86efac;
  color: #16a34a;
}

.type-img {
  background-color: #bfdbfe;
  color: #2563eb;
}

.type-json {
  background-color: #c4b5fd;
  color: #7c3aed;
}

.type-other {
  background-color: #fecaca;
  color: #dc2626;
}

.path-value {
  color: #1f2937;
  font-family: 'Monaco', 'Consolas', monospace;
  word-break: break-all;
}

.detail-value {
  color: #dc2626;
  word-break: break-all;
}

.time-value {
  color: #9ca3af;
}

/* 解决方案 */
.solution {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.75rem;
  background-color: rgba(0, 0, 0, 0.03);
  border-radius: 0.375rem;
  width: calc(100% - 1.5rem);
}

.solution-label {
  font-size: 0.875rem;
}

.solution-list {
  margin: 0;
  padding-left: 1.25rem;
  font-size: 0.875rem;
  color: #4b5563;
  gap: 0.25rem;
}

.solution-list li {
  margin-bottom: 0.25rem;
}

.solution-list li:last-child {
  margin-bottom: 0;
}

/* 按钮样式 */
.retry-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1.25rem;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
  align-self: center;
  transition: background-color 0.2s;
}

.retry-btn:hover {
  background-color: #2563eb;
}

.retry-btn:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}

.detail-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: none;
  color: #6b7280;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  align-self: center;
}

.detail-btn:hover {
  color: #3b82f6;
}

/* 更多详情 */
.error-more {
  margin-top: 0.5rem;
  padding: 1rem;
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 0.25rem;
  width: calc(100% - 2rem);
  overflow: auto;
}

.error-stack {
  margin: 0;
  font-size: 0.75rem;
  color: #4b5563;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: 'Monaco', 'Consolas', monospace;
}
</style>
