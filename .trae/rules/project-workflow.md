---
alwaysApply: true
scene: git_push
---

# 项目级规则（必须遵守）

## 1. 推送与 Actions 闭环
- 每次 `git push` 之后，必须主动读取 GitHub Actions 推送结果（前端 `Deploy Frontend to Aliyun OSS`、后端 `Deploy Backend to Aliyun Server`）。
- 若 Actions 失败，必须在本地继续修复 → 提交 → 推送 → 再次读取结果，直到两个 workflow 都显示 success 为止，**不得在失败状态下继续其他任务**。
- 读取方式：使用 `gh run list --branch <branch> --limit 1` / `gh run view <run-id> --log`，或直接 fetch Actions API。

## 2. 环境隔离
- 仓库**没有本地运行环境**，开发/调试/部署都通过云端进行，禁止假设本地有 node、npm、pm2 等环境。
- 前端：本地无 dev server；`.env.development` 仅用于代码内分支判断参考，所有真实访问走阿里云 OSS。
- 后端：本地无 Node 进程；后端在阿里云宝塔轻量服务器上运行，重启由 SSH + PM2 完成。
- 配置改动只允许修改 `.env.production`、`.env.development`、`env.example`、`backend/env.example`、`.env`（后端）和 GitHub Secrets，**禁止手动 ssh 改云端文件**。

## 3. 部署架构（事实陈述）
- 前端：Vue 3 + Vite，build 后 `dist/` 同步到阿里云 OSS（`aws s3 sync` 通过 actions/configure-aws-credentials@v4 走 OSS endpoint），CDN 走 CloudFront 失效。
- 后端：Node + Express + SQLite，部署在阿里云宝塔轻量服务器，路径由 `SERVER_PROJECT_PATH` Secret 指定，由 PM2 进程名 `wenyan-backend` 守护。
- 大资源（音视频/图片/JSON）不进入 git：
  - `.gitignore` 已忽略 `public/audio/`、`public/video/`、`public/images/`、`public/data/`、`public/*.json` 以及常见音视频/图片扩展名。
  - 这些文件直接由开发机器上传到阿里云 OSS 桶对应的 `audio/`、`video/`、`images/` 目录；前端通过 `VITE_OSS_BASE_URL` 拼地址访问。
- 触发条件：合并到 `main` 分支触发 GitHub Actions 自动部署。

## 4. 工作流（必须按此顺序）
1. 在功能分支 `trae/agent-XXXX` 开发并自测。
2. 合并到 `origin/feature-1`（特性集成分支），推送到远端。
3. feature-1 测试通过后，**单独创建一次 PR** 将 `feature-1` 合并到 `main`，触发 Actions。
4. 等待并轮询 Actions 运行结果，失败则回到步骤 1 修复后重走流程。
5. 部署成功后，对生产域名 `https://classicalab.cn` 做冒烟测试。

## 5. 数据流与组件分层（禁止违规）
- 数据来源分层：JSON 数据（OSS）→ `utils/` 解析封装 → `composables/` 行为封装 → `views/` 页面 → `components/` 视图组件。
- 任何组件**不得**直接 `fetch('/data/...')`，必须走 `utils/` 中的封装（如未来抽离 `dataLoader.ts`）。
- `useNavigation` 是唯一跳转入口，禁止在组件内直接 `router.push({ name: 'xxx' })`（除 `PoetryMenu` 这种"非顺序"入口外）。
- 学生身份（学号）必须走 `useStudentStore`，禁止在组件内读 `localStorage`。
- 提交答案必须走 `utils/api.ts` 的 `submitAnswers`，禁止在组件内直接 fetch `/api/submit`。

## 6. 命名与质量红线
- 组件名必须 ≥ 2 个单词（PascalCase），单文件组件禁止以单词命名（已用 `eslint-disable vue/multi-word-component-names` 的 `Options.vue` / `Question.vue` 是历史债务，需在下一阶段整改）。
- 视图文件 `RuleView1/2/3.vue` 与 `RuleView.vue` 高度重复（仅视频后缀不同），属于必须重构的代码异味——下一阶段合并为 `RuleVideoView.vue` + `videoKey` 参数。
- 禁止在生产构建中保留 `console.log` 调试输出（`MultiRoleReading.vue`、`StepOneView.vue` 仍有，需清理）。
- 禁止 `multi_role_reading` / `word_list` / `text_basic_info` JSON 中嵌入绝对路径，必须用相对路径或 `VITE_OSS_BASE_URL` 拼接。
