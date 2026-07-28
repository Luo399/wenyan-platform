<!--
  DeleteConfirmModal.vue - 删除确认弹窗
  从 AnswerQueryView 拆分而来：纯展示型弹窗，仅负责确认/取消事件抛出。
-->
<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content delete-confirm-modal">
      <div class="modal-header">
        <h3>确认删除</h3>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      <div class="modal-body">
        <div class="confirm-content">
          <div class="warning-icon">⚠</div>
          <p>
            确定要删除学生 <strong>{{ student?.name }}</strong> 吗？
          </p>
          <p class="sub-text">学号：{{ student?.student_id }}</p>
          <p class="sub-text danger">此操作将同时删除该学生的所有答题记录，且无法恢复！</p>
        </div>
        <div class="form-actions">
          <button type="button" class="cancel-btn" @click="$emit('close')" :disabled="isDeleting">
            取消
          </button>
          <button type="button" class="danger-btn" @click="$emit('confirm')" :disabled="isDeleting">
            <span v-if="isDeleting" class="spinner-small"></span>
            <span v-else>确认删除</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { StudentInfo } from '@/utils/studentApi'

defineProps<{
  /** 待删除学生，可能为 null（关闭时） */
  student: StudentInfo | null
  /** 删除请求进行中，禁用按钮 */
  isDeleting: boolean
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'confirm'): void
}>()
</script>
