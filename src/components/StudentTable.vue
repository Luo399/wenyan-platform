<!--
  StudentTable.vue - 学生列表表格（仅展示与行操作）
  从 AnswerQueryView 拆分而来，负责学生 CRUD 列表的纯展示与事件抛出。
-->
<template>
  <table class="data-table">
    <thead>
      <tr>
        <th>学号</th>
        <th>姓名</th>
        <th>班级</th>
        <th>创建时间</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="student in students" :key="student.student_id">
        <td>{{ student.student_id }}</td>
        <td>{{ student.name }}</td>
        <td>{{ student.class || '-' }}</td>
        <td>{{ formatDate(student.created_at) }}</td>
        <td class="actions-cell">
          <button class="action-btn view-btn" @click="$emit('view', student)">查看</button>
          <button class="action-btn edit-btn" @click="$emit('edit', student)">编辑</button>
          <button class="action-btn answer-btn" @click="$emit('viewAnswers', student.student_id)">
            答题
          </button>
          <button class="action-btn delete-btn" @click="$emit('confirmDelete', student)">
            删除
          </button>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import type { StudentInfo } from '@/utils/studentApi'
import { formatDate } from '@/utils/format'

defineProps<{
  students: StudentInfo[]
}>()

// 行操作事件：查看 / 编辑 / 查看答题 / 确认删除
defineEmits<{
  (e: 'view', student: StudentInfo): void
  (e: 'edit', student: StudentInfo): void
  (e: 'viewAnswers', studentId: string): void
  (e: 'confirmDelete', student: StudentInfo): void
}>()
</script>
