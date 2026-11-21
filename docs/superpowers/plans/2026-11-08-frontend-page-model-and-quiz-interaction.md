# 前端页面模型 + 答题交互抽取 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Figma/Excel 页面数据经唯一清洗层进入前端，并把答题渲染与交互动作彻底分离，配套单元与集成测试。

**Architecture:** `pageAdapter` 把原始 JSON 归一为 `PageModel/QuizModel`；`FigmaPageView` 按 `pageRegistry.renderMode` 选择 `BlocksRenderer` 或 `QuizListRenderer`；`useQuizSession` 持有答题状态机，`useQuizEffects` 承担提交/完成记录/埋点副作用；文案与显示策略集中在 `config/quizInteraction.ts`。

**Tech Stack:** Vue 3.5 + TypeScript + Vite + Vitest + @vue/test-utils。

**依据规格：** `docs/superpowers/specs/2026-11-08-frontend-page-model-and-quiz-interaction-design.md`

---

## 文件结构

| 文件 | 动作 | 职责 |
|---|---|---|
| `src/config/quizInteraction.ts` | 创建 | 文案 / 显示策略 / 解锁规则 |
| `src/adapters/pageAdapter.ts` | 创建 | 原始 JSON → PageModel，答案归一、questionId 统一、脏数据防御 |
| `src/composables/useQuizSession.ts` | 创建 | 答题状态机（纯逻辑，无网络/存储/DOM） |
| `src/composables/useQuizEffects.ts` | 创建 | 提交、完成记录、埋点（副作用层） |
| `src/components/figma/QuizCard.vue` | 创建 | 单题纯展示，只发 `select` / `submit` |
| `src/components/figma/QuizProgressBar.vue` | 创建 | 进度展示 |
| `src/components/figma/QuizListRenderer.vue` | 创建 | 逐题渲染 + 完成态 |
| `src/components/figma/BlocksRenderer.vue` | 创建 | 块流渲染 + 显隐 |
| `src/views/FigmaPageView.vue` | 创建 | 加载、选渲染器、组装 session/effects、导航与埋点 |
| `src/views/StepTwoView.vue` | 重写 | 薄壳，渲染 `FigmaPageView page-key="steptwo"` |
| `src/views/StepThreeView.vue` | 重写 | 薄壳，渲染 `FigmaPageView page-key="stepthree"` |
| `src/config/pageRegistry.ts` | 修改 | 增加可选 `subtitle` |
| `tests/adapters/pageAdapter.spec.ts` | 创建 | 8 类输入归一化 |
| `tests/composables/useQuizSession.spec.ts` | 创建 | 推进/回滚/重置/无效题 |
| `tests/components/figma/QuizCard.spec.ts` | 创建 | 事件与解析显示三档 |
| `tests/components/figma/QuizListRenderer.spec.ts` | 创建 | 全量挂载、显隐边界、完成态 |
| `tests/components/figma/BlocksRenderer.spec.ts` | 创建 | 块映射与显隐 |
| `tests/integration/figma-page-flow.spec.ts` | 创建 | 加载→选择→提交→解锁→完成 |

---

### Task 1: 交互配置

- [ ] 创建 `src/config/quizInteraction.ts`，导出 `QuizInteractionConfig` 与默认配置。
- [ ] 验证：`npx vitest run tests/adapters` 之前先跑 `npx vue-tsc --build --force` 无新错误。

### Task 2: 页面适配器（TDD）

- [ ] 先写 `tests/adapters/pageAdapter.spec.ts`：字母 / 数字 / 字符串数字 / `correct_index` / 多选 / 缺失 / 越界 / `options[0]` 等于题干。
- [ ] 跑测试确认失败：`npx vitest run tests/adapters/pageAdapter.spec.ts`。
- [ ] 实现 `src/adapters/pageAdapter.ts`：`adaptPage`、`adaptQuiz`、`toSubmitValue`、`isCorrect`。
- [ ] 跑测试确认通过。

### Task 3: 答题状态机（TDD）

- [ ] 先写 `tests/composables/useQuizSession.spec.ts`：三种 `advancePolicy`、失败回滚、切篇目重置、invalid 题不计完成。
- [ ] 实现 `src/composables/useQuizSession.ts`。
- [ ] 跑测试确认通过。

### Task 4: 副作用层

- [ ] 实现 `src/composables/useQuizEffects.ts`：`submitAnswer`（不传 `correctAnswer`，让后端读自身数据）、`markCompleted`、`resetCompletion`。
- [ ] 集成测试中通过 mock 验证调用参数。

### Task 5: 渲染器组件

- [ ] `QuizCard.vue` / `QuizProgressBar.vue` / `QuizListRenderer.vue` / `BlocksRenderer.vue`。
- [ ] 组件测试覆盖：只发事件、不判分；`v-show` 全量挂载；`showExplanation` 三档。

### Task 6: 页面装配

- [ ] `FigmaPageView.vue`：`getDataUrlWithVersion` + `useDataLoader` + 渲染器分发 + `PageScaffold`。
- [ ] `StepTwoView.vue` / `StepThreeView.vue` 改为薄壳。
- [ ] `pageRegistry.ts` 增加 `subtitle`。

### Task 7: 回归验证

- [ ] `npx vitest run tests/views/StepTwoView.spec.ts tests/views/StepThreeView.spec.ts tests/components/QuizCard.spec.ts`
- [ ] `npx vitest run`
- [ ] `npm run type-check`
- [ ] `npm run lint`
