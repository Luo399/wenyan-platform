<!--
  StudentFormModal.vue - 新增/编辑学生弹窗
  从 AnswerQueryView 拆分而来：
    - 内部维护表单状态与校验逻辑
    - 父组件用 v-if 控制挂载，每次打开会重新初始化
    - 提交时通过 emit('submit', payload) 抛出表单数据，由父组件调用 API
-->
<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content student-form-modal">
      <div class="modal-header">
        <h3>{{ isEditMode ? '编辑学生信息' : '新增学生' }}</h3>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      <div class="modal-body">
        <form @submit.prevent="handleSubmit" class="student-form">
          <div class="form-group">
            <label for="studentIdInput">学号 <span class="required">*</span></label>
            <input
              id="studentIdInput"
              v-model="form.studentId"
              type="text"
              placeholder="请输入学号（纯数字）"
              class="form-input"
              :disabled="isEditMode || isSubmitting"
              :class="{ error: errors.studentId }"
            />
            <span v-if="errors.studentId" class="error-text">{{ errors.studentId }}</span>
          </div>

          <div class="form-group">
            <label for="studentNameInput">姓名 <span class="required">*</span></label>
            <input
              id="studentNameInput"
              v-model="form.name"
              type="text"
              placeholder="请输入姓名"
              class="form-input"
              :disabled="isSubmitting"
              :class="{ error: errors.name }"
            />
            <span v-if="errors.name" class="error-text">{{ errors.name }}</span>
          </div>

          <div class="form-group">
            <label for="studentClassInput">班级 <span class="required">*</span></label>
            <input
              id="studentClassInput"
              v-model.number="form.class"
              type="number"
              placeholder="请输入班级（如：9）"
              class="form-input"
              :disabled="isSubmitting"
              :class="{ error: errors.class }"
            />
            <span v-if="errors.class" class="error-text">{{ errors.class }}</span>
          </div>

          <div class="form-actions">
            <button
              type="button"
              class="cancel-btn"
              @click="$emit('close')"
              :disabled="isSubmitting"
            >
              取消
            </button>
            <button type="submit" class="submit-btn" :disabled="isSubmitting">
              <span v-if="isSubmitting" class="spinner-small"></span>
              <span v-else>{{ isEditMode ? '保存' : '添加' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import type { StudentInfo } from '@/utils/studentApi'
import { validateStudentId, validateStudentName } from '@/utils/studentApi'

const props = withDefaults(
  defineProps<{
    /** 是否编辑模式（true=编辑，false=新增） */
    isEditMode: boolean
    /** 父组件提交进行中状态，用于禁用按钮 */
    isSubmitting: boolean
    /** 编辑模式下传入的初始学生数据；新增模式可省略 */
    initialStudent?: StudentInfo | null
  }>(),
  {
    initialStudent: null,
  },
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: { studentId: string; name: string; class: number }): void
}>()

// 表单状态：编辑模式下从 initialStudent 初始化，新增模式使用默认值
const form = reactive({
  studentId: props.initialStudent?.student_id ?? '',
  name: props.initialStudent?.name ?? '',
  class: props.initialStudent?.class ?? 9,
})

const errors = reactive<{ studentId: string; name: string; class: string }>({
  studentId: '',
  name: '',
  class: '',
})

/** 表单校验：学号仅新增校验，姓名始终校验，班级需为正整数 */
function validateForm(): boolean {
  let valid = true
  errors.studentId = ''
  errors.name = ''
  errors.class = ''

  if (!props.isEditMode) {
    const idValidation = validateStudentId(form.studentId)
    if (!idValidation.valid) {
      errors.studentId = idValidation.error!
      valid = false
    }
  }

  const nameValidation = validateStudentName(form.name)
  if (!nameValidation.valid) {
    errors.name = nameValidation.error!
    valid = false
  }

  if (!form.class || form.class <= 0) {
    errors.class = '请输入有效的班级号'
    valid = false
  }

  return valid
}

function handleSubmit() {
  if (!validateForm()) return
  emit('submit', {
    studentId: form.studentId.trim(),
    name: form.name.trim(),
    class: form.class,
  })
}
</script>
