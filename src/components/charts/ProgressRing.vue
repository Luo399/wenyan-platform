<!--
  ProgressRing.vue - 圆环进度（单人三关完成率、整体完成率等）

  用 stroke-dasharray 画环而不是 path 弧：
  单一比例的环形用 dash 更短，且 percent=100 时不会出现「差 1px 没闭合」的问题。
  环心文字由插槽覆盖，默认显示百分比。
-->
<template>
  <div class="progress-ring" :style="{ width: `${size}px` }" data-testid="progress-ring">
    <svg
      :width="size"
      :height="size"
      :viewBox="`0 0 ${size} ${size}`"
      role="img"
      :aria-label="ariaLabel"
    >
      <circle
        class="ring-track"
        :cx="center"
        :cy="center"
        :r="radius"
        :stroke-width="strokeWidth"
        fill="none"
      />
      <circle
        class="ring-value"
        :cx="center"
        :cy="center"
        :r="radius"
        :stroke-width="strokeWidth"
        :stroke="color"
        fill="none"
        stroke-linecap="round"
        :stroke-dasharray="`${geometry.dash} ${geometry.circumference}`"
        transform="rotate(-90 0 0)"
        :style="{ transformOrigin: `${center}px ${center}px` }"
      />
    </svg>
    <div class="ring-center" :style="{ width: `${size}px`, height: `${size}px` }">
      <slot>
        <span class="ring-percent">{{ displayPercent }}%</span>
      </slot>
    </div>
    <div v-if="label" class="ring-label">{{ label }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ringGeometry } from './chartUtils'

export interface ProgressRingProps {
  /** 0~100，超界由 ringGeometry 夹紧 */
  percent: number
  size?: number
  strokeWidth?: number
  color?: string
  label?: string
}

const props = withDefaults(defineProps<ProgressRingProps>(), {
  size: 76,
  strokeWidth: 8,
  color: 'var(--color-primary)',
  label: '',
})

const clampedPercent = computed(() => Math.max(0, Math.min(100, Math.round(props.percent))))
const displayPercent = computed(() => clampedPercent.value)
const radius = computed(() => (props.size - props.strokeWidth) / 2)
const center = computed(() => props.size / 2)
const geometry = computed(() => ringGeometry(radius.value, clampedPercent.value))
const ariaLabel = computed(() => `${props.label || '完成进度'} ${displayPercent.value}%`)
</script>

<style scoped>
.progress-ring {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
}

.ring-track {
  stroke: var(--color-placeholder);
}

.ring-value {
  transition: stroke-dasharray 0.3s ease;
}

.ring-center {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.ring-percent {
  font-size: 0.95rem;
  font-weight: var(--font-weight-semibold);
}

.ring-label {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}
</style>
