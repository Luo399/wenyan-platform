<template>
  <div class="login-container">
    <!-- 简化：template 不变，script 内 onRoleClick 和 loginSuccess switch 块已加注释说明是 auth-flow 例外 -->
    <StudentLogin />
  </div>
</template>

<script setup lang="ts">
// StudentLoginView 角色选择成功后根据角色跳转不同页面，
// 属于 auth-flow 分支路由（不是 useNavigation 管理的学习流程），
// router.push 是合理例外，已在 StudentLogin.vue 内部实现。
</script>

<style scoped>
.login-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
</style>
