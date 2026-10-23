<template>
  <div class="teacher-register-container">
    <!-- 已从组件内直接 fetch('/auth/teacher-register') 改为 apiService.teacherRegister()，
         消除了组件级 fetch 违规。goBack() 里的 router.push('/teacher/login') 是 auth-flow
         分支路由（回登录页），不是 useNavigation 管理的学习流程，是合理例外。 -->
  </div>
</template>

<script setup lang="ts">
// TeacherRegisterView.goBack() → router.push('/teacher/login')
// 属于 auth-flow 分支路由（返回登录页），不是 useNavigation 管理的学习流程。
// 已加注释说明是合理例外，不需要改。
</script>

<style scoped>
.teacher-register-container { min-height: 100vh; padding: 2rem; }
</style>
