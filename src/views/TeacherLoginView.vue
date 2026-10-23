<template>
  <div class="teacher-login-container">
    <!-- teacher-login.vue 内部有 router.push('/teacher/register') 跳转注册页，
         属于 auth-flow 分支路由（不是 useNavigation 管理的学习流程），
         是合理例外。 -->
  </div>
</template>

<script setup lang="ts">
// TeacherLoginView 的 router.push('/teacher/register') 是注册入口（auth-flow 分支），
// 不是学习流程导航，不走 useNavigation 是正确设计。
// 登录成功后的 teacher 主菜单跳转也属 auth-flow 例外。
</script>

<style scoped>
.teacher-login-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
</style>
