<!--
  SectionDivider.vue - 区域分割线组件

  功能说明：
  - 显示带文字的分割线
  - 支持自定义文字和样式

  Props:
    text: string - 分割线文字
    color?: string - 文字颜色，默认灰色

  使用示例：
  <SectionDivider text="音频学习" />
  <SectionDivider text="视频学习" color="#3b82f6" />
-->
<template>
  <div class="section-divider">
    <div class="line"></div>
    <span class="divider-text" :style="{ color: textColor }">{{ text }}</span>
    <div class="line"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  text: string
  color?: string
}

const props = withDefaults(defineProps<Props>(), {
  color: '#6b7280',
})

const textColor = computed(() => props.color)
</script>

<style scoped>
.section-divider {
  display: flex;
  align-items: center;
  margin: 1.5rem 0;
  gap: 1rem;
}

.line {
  flex: 1;
  height: 1px;
  background-color: #e5e7eb;
}

.divider-text {
  font-size: 0.875rem;
  white-space: nowrap;
  font-weight: 500;
}
</style>
