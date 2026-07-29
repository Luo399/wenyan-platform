<template>
  <div class="options-container">
    <div
      v-for="option in options"
      :key="option.id"
      class="option-item"
      :class="{
        selected: isSelected(option.id),
        radio: type === 'radio',
        checkbox: type === 'checkbox',
        disabled: disabled,
      }"
      @click="toggleOption(option.id)"
    >
      <span class="selector">
        <span v-if="type === 'radio' && isSelected(option.id)" class="dot"></span>
        <span v-if="type === 'checkbox' && isSelected(option.id)" class="check">✓</span>
      </span>
      <span class="option-label">{{ option.label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

export type OptionsType = 'radio' | 'checkbox'

export interface Option {
  id: string | number
  label: string
}

const props = withDefaults(
  defineProps<{
    options: Option[]
    type: OptionsType
    modelValue?: string | number | (string | number)[]
    disabled?: boolean
  }>(),
  {
    disabled: false,
    // modelValue 不给默认值：依赖 type（radio→'' / checkbox→[]），由 getInitialValue() 运行时兜底
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number | (string | number)[]): void
  (e: 'change', value: string | number | (string | number)[]): void
}>()

const getInitialValue = (): string | number | (string | number)[] => {
  if (props.type === 'radio') {
    return props.modelValue ?? ''
  } else {
    return Array.isArray(props.modelValue) ? [...props.modelValue] : []
  }
}
const selectedValue = ref<string | number | (string | number)[]>(getInitialValue())

watch(
  () => props.modelValue,
  (newVal) => {
    if (props.type === 'radio') {
      selectedValue.value = newVal ?? ''
    } else {
      selectedValue.value = Array.isArray(newVal) ? [...newVal] : []
    }
  },
)

function isSelected(id: string | number): boolean {
  if (props.type === 'radio') {
    return selectedValue.value === id
  } else {
    return (selectedValue.value as (string | number)[]).includes(id)
  }
}

function toggleOption(id: string | number) {
  if (props.disabled) return

  if (props.type === 'radio') {
    selectedValue.value = id
    emit('update:modelValue', id)
    emit('change', id)
  } else {
    let arr = [...(selectedValue.value as (string | number)[])]
    if (arr.includes(id)) {
      arr = arr.filter((item) => item !== id)
    } else {
      arr.push(id)
    }
    selectedValue.value = arr
    emit('update:modelValue', arr)
    emit('change', arr)
  }
}
</script>

<style scoped>
.options-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  font-family: var(--font-family-serif);
}
.option-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs);
  border-radius: var(--radius-small);
  cursor: pointer;
  transition: background 0.2s;
}
.option-item:hover:not(.disabled) {
  background-color: var(--color-bg-highlight);
}
.option-item.disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.selector {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border: var(--border-width-hairline) solid var(--color-text-secondary);
  border-radius: 9999px;
  background: var(--color-white);
}
.option-item.radio .selector {
  border-radius: 9999px;
}
.option-item.checkbox .selector {
  border-radius: 0.25rem;
}
.dot {
  width: 0.625rem;
  height: 0.625rem;
  background-color: var(--color-primary);
  border-radius: 9999px;
}
.check {
  color: var(--color-primary);
  font-weight: bold;
}
/* 选中状态：朱红色边框 + 米色背景 */
.selected .selector {
  border-color: var(--color-primary);
  background-color: var(--color-bg-highlight);
}
.option-label {
  font-size: var(--font-size-small);
}
</style>
