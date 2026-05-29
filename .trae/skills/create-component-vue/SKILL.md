---
name: create-component-vue
description: 当用户请求创建一个新的 Vue 组件时，请执行以下操作
---

---
name: vue-component-generator
description: 按照项目规范生成 Vue 3 组件。当用户请求创建新的 Vue 组件、页面或提到“生成组件”时，应使用此技能。它会自动应用项目的代码规范，包括使用 `<script setup>` 语法、TypeScript 类型声明等。
---

# Vue 组件生成器
此技能用于在 `wenyan-platform` 项目中生成符合规范的 Vue 3 组件。

## 指令
当用户请求创建一个新的 Vue 组件时，请执行以下操作：
1.  **分析需求**：确定组件名称、Props、Emits 和基本功能。
2.  **创建文件**：在 `src/components/` 目录下创建一个新的 `.vue` 文件。
3.  **生成代码**：编写符合项目规范的组件代码，包括：
    *   使用 `<script setup lang="ts">` 语法。
    *   使用 `defineProps` 和 `defineEmits` 定义明确的 TypeScript 接口。
    *   在 `<template>` 中实现UI布局。
    *   根据需要添加 `<style scoped>` 样式。
4.  **集成**：告知用户如何在其他页面或组件中导入和使用它。