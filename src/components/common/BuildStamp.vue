<template>
  <span class="build-stamp" :data-build-id="buildId" :title="tip">{{ label }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatBuildStamp, getBuildId } from '@/utils/buildStamp'

/**
 * 发布新鲜度阶段 1：让「这个浏览器现在跑的是哪次构建」肉眼可见。
 *
 * 缓存类问题最难口头确认——同一份修复，有的浏览器新、有的还停在旧的，光看现象说不清。
 * 页脚留一个构建号，美术或老师反馈问题时先报号，就能把「看起来好了」变成可比对的字符串。
 * 号取自 CI 的提交短 sha（本地开发显示「本地构建」），格式化在 src/utils/buildStamp.ts。
 *
 * 模板刻意只留一个根节点：根级 HTML 注释在开发模式下也是一份子节点，组件会因此变成
 * fragment，@vue/test-utils 的 wrapper.element 拿到的就是挂载容器 DIV 而不是这个 span，
 * 属性和文案断言全部落空（第一次 CI 就是这么红的）。要写的说明放这里，别放模板外。
 */
const buildId = computed(() => getBuildId())
const label = computed(() => formatBuildStamp(buildId.value))
const tip = '本页面的构建号，与 GitHub 提交的短 sha 对应；反馈问题时请附上'
</script>

<style scoped>
/*
 * 父容器 .icp-footer 是 pointer-events: none（不挡住页面底部操作），
 * 这里单独放开并允许选中，方便把号复制出来。
 */
.build-stamp {
  color: var(--color-text-secondary, #999);
  pointer-events: auto;
  user-select: text;
}

/* 与备案号之间用一个中点分隔，避免两块灰字糊在一起 */
.build-stamp::before {
  content: '·';
  margin: 0 6px;
}
</style>
