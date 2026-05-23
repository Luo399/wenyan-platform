<!-- eslint-disable vue/multi-word-component-names -->
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

const props = defineProps<{
  options: Option[]
  type: OptionsType
  modelValue?: string | number | (string | number)[]
  disabled?: boolean
}>()

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
  gap: 0.5rem;
}
.option-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background 0.2s;
}
.option-item:hover:not(.disabled) {
  background-color: #f3f4f6;
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
  border: 1px solid #9ca3af;
  border-radius: 9999px;
  background: white;
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
  background-color: #3b82f6;
  border-radius: 9999px;
}
.check {
  color: #3b82f6;
  font-weight: bold;
}
.selected .selector {
  border-color: #3b82f6;
  background-color: #eff6ff;
}
.option-label {
  font-size: 0.875rem;
}
</style>
