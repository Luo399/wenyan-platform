/**
 * Figma 页面注册表（P1 重构）
 *
 * 背景：Figma 插件按约定把页面数据上传为 OSS JSON（
 *   文字资源_{相对路径} → data/{dataDir}/{wenId}.json），前端消费侧需要知道
 * 每个页面类型对应的数据目录、渲染模式与导航 key。此前这些信息硬编码在
 * StepTwoView/StepThreeView 等视图里，新增一个 Figma 页面就得新开视图 + 路由。
 *
 * 目标：Figma 页面"零代码接入"——在下方注册表新增一条记录，
 * 并（如需独立路由）在 router + pageSequence 挂一条即可。
 *
 * 数据流图示：
 *   Figma 插件 → OSS data/{dataDir}/{wenId}.json
 *   → 页面（含本注册表元信息）→ useDataLoader 加载 → 按 renderMode 渲染
 */

import type { RouteName } from '@/config/navigation'

/** 页面渲染模式 */
export type FigmaRenderMode =
  | 'blocks' // BlockRenderer 块流（BlockQuiz/DialogueCard/WordList 等按块渲染）
  | 'quiz-list' // 逐题卡片列表（QuizCard 逐题作答）

/** 单个 Figma 页面的注册元信息 */
export interface FigmaPageMeta {
  /** 页面逻辑 key（路由 name 或 query 参数，须全局唯一） */
  key: string
  /** OSS/本地数据目录：/data/{dataDir}/{wenId}.json */
  dataDir: string
  /** 渲染模式 */
  renderMode: FigmaRenderMode
  /** 页面标题（数据加载前/失败兜底展示） */
  title: string
  /** 映射到页面序列的导航 key（useNavigation/pageSequence），非顺序页面可为 home */
  navKey: RouteName
  /** 是否要求登录（对应路由 meta.requiresAuth） */
  requiresAuth: boolean
}

/**
 * 已注册的 Figma 页面。
 * 新增示例：
 *   myNewPage: {
 *     key: 'myNewPage',
 *     dataDir: 'pages_my_new_page',
 *     renderMode: 'blocks',
 *     title: '新页面',
 *     navKey: 'steptwo',
 *     requiresAuth: true,
 *   },
 */
export const figmaPageRegistry: Record<string, FigmaPageMeta> = {
  /** 二级学习页：对话 + 测验块（Block 流式渲染） */
  steptwo: {
    key: 'steptwo',
    dataDir: 'pages_level2_dialog_quiz',
    renderMode: 'blocks',
    title: '课文研读',
    navKey: 'steptwo',
    requiresAuth: true,
  },
  /** 三级学习页：情景文本 + 逐题测验（QuizCard 逐题渲染） */
  stepthree: {
    key: 'stepthree',
    dataDir: 'pages_level3_adaptive_quiz',
    renderMode: 'quiz-list',
    title: '情景测验',
    navKey: 'stepthree',
    requiresAuth: true,
  },
}

/** 按 key 获取页面元信息 */
export function getFigmaPageMeta(key: string): FigmaPageMeta | undefined {
  return figmaPageRegistry[key]
}
