# 贡献指南

## 分支命名

从目标分支切出，格式 `feature/<父分支>/<子主题>`，例如：

- `feature/feature-1/fix-nav-stuck`
- `feature/main/teacher-export`

`main` 为生产分支，`feature-1` 为测试集成分支。功能分支合回父分支前，先同步父分支最新提交。

## 提交信息

遵循 Conventional Commits：

```
<type>(<scope>): <subject>
```

常用 type：`feat`、`fix`、`refactor`、`test`、`docs`、`chore`、`ci`、`build`。subject 用中文或英文均可，不加句号，一次提交只做一件事。

## Pull Request 要求

- 标题同样遵循 Conventional Commits，描述写清动机、影响范围与验证方式。
- 必须通过：`npm run type-check`、`npm run test`、`npm run lint:ci`（不自动修复的 lint）。
- 后端改动额外执行 `cd backend && npm test`。
- 不为了让 CI 变绿而调低覆盖率阈值或把测试加入忽略列表；确实需要调整时在 PR 中单独说明理由。
- 不提交任何真实密钥、口令、服务器 IP、学生数据；示例值统一用 `<PROD_SERVER_IP>`、`<DEPLOY_USER>`、`<JWT_SECRET>` 这类占位符。

## 开发约定

- 前端数据读取走 `src/adapters/`，不要在组件里直接拼接 JSON 结构。
- `backend/data/` 与 `public/data/` 的题库数据由 `scripts/sync-quiz-data.cjs` 同步；该脚本遇到数组长度不一致、字段缺失或答案冲突会拒绝写入，需先人工确认数据源。
- 新增/修改题库数据后，同时检查前端引用与 `scripts/check-data-references.sh` 的输出。

## 本地自检清单

```bash
npm run type-check
npm run test
npm run lint:ci
git diff --cached | grep -Ei "secret|password|AKID|BEGIN.*PRIVATE KEY"  # 应无命中
```
