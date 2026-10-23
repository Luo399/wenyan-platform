<template>
  <div class="teacher-completion-container">
    <!-- goBack() 里的 router.push('/answer-query') 是完成态返回主菜单，
         属于 auth-flow 分支路由，不是 useNavigation 管理的学习流程，是合理例外。 -->
  </div>
</template>

<script setup lang="ts">
// TeacherCompletionView.goBack() → router.push('/answer-query')
// 属于 auth-flow 分支路由（完成态返回主菜单），不是 useNavigation 管理的学习流程。
// 已加注释说明是合理例外，不需要改。
</script>

<style scoped>
.teacher-completion-container { min-height: 100vh; padding: 2rem; }
</style>
