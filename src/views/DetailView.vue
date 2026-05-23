<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
const articleId = route.params.id ?? ''  // 拿到 URL 里的 id，空值时使用空字符串

// 根据 id 获取篇目数据（这里先硬编码，以后可以从网络请求获取）
function getArticleById(id: number) {
  const articlesMap: Record<number, { title: string; content: string }> = {
    1: { title: "论语·学而篇", content: "学而时习之，不亦说乎？..." },
    2: { title: "孟子·梁惠王上", content: "孟子见梁惠王。王曰：\"叟！不远千里而来，亦将有以利吾国乎？\"..." },
    3: { title: "劝学", content: "君子曰：学不可以已。青，取之于蓝，而青于蓝；冰，水为之，而寒于水。" }
  }
  return articlesMap[Number(id)] || { title: "未知篇目", content: "暂无内容" }
}

const article = getArticleById(Number(articleId))
</script>

<template>
  <div>
    <h1>{{ article.title }}</h1>
    <p>{{ article.content }}</p>
    <button @click="$router.back()">返回列表</button>
  </div>
</template>
