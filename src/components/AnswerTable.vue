<!--
  AnswerTable.vue - 答题记录表格（支持两种模式）
  从 AnswerQueryView 拆分而来：
    - mode='wenId'     按文言文ID查询结果（学生维度聚合）
    - mode='studentId' 按学生ID查询结果（文言文维度记录）
-->
<template>
  <!-- 按文言文查询结果：学生维度 -->
  <table v-if="mode === 'wenId'" class="data-table">
    <thead>
      <tr>
        <th>学号</th>
        <th>姓名</th>
        <th>答题数</th>
        <th>正确数</th>
        <th>错误数</th>
        <th>平均分</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="student in records" :key="student.studentId">
        <td>{{ student.studentId }}</td>
        <td>{{ student.studentName || '未知' }}</td>
        <td>{{ student.totalQuestions }}</td>
        <td class="correct">{{ student.correctCount }}</td>
        <td class="wrong">{{ student.wrongCount }}</td>
        <td>{{ student.avgScore }}%</td>
        <td>
          <button class="action-btn detail-btn" @click="$emit('viewDetail', student)">详情</button>
        </td>
      </tr>
    </tbody>
  </table>

  <!-- 按学生查询结果：文言文维度 -->
  <table v-else class="data-table">
    <thead>
      <tr>
        <th>文言文ID</th>
        <th>答题时间</th>
        <th>答题数</th>
        <th>正确数</th>
        <th>平均分</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="record in records" :key="record.wenId">
        <td>{{ record.wenId }}</td>
        <td>{{ formatDate(record.submittedAt) }}</td>
        <td>{{ record.totalQuestions }}</td>
        <td class="correct">{{ record.correctCount }}</td>
        <td>{{ record.avgScore }}%</td>
        <td>
          <button class="action-btn detail-btn" @click="$emit('viewDetail', record)">详情</button>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import { formatDate } from '@/utils/format'

defineProps<{
  /** 查询结果记录（学生维度或文言文维度，结构由后端返回决定） */
  records: Array<Record<string, any>>
  /** 表格展示模式 */
  mode: 'wenId' | 'studentId'
}>()

// 行"详情"事件：将整行记录透传给父组件
defineEmits<{
  (e: 'viewDetail', record: Record<string, any>): void
}>()
</script>
