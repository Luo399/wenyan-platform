# 变更记录 2026-09-30

> 依据 `rules/maintenance_standards.md` 4.5.1 / 4.5.3 生成；保存位置 `docs/maintenance/changelog/`，命名 `changelog-YYYYMMDD.md`。

| 变更编号 | 变更类型 | 影响范围 | 变更描述 | 测试状态 | 上线状态 |
|---|---|---|---|---|---|
| CR-20260930-01 | chore | `scripts/nightly/`、`tasks/`、`package.json` | 搭建夜间开发自动化脚手架：新增夜间任务清单、夜间 CLI（同步/分支/校验/CI 轮询/递归合并/变更记录）、补齐根 `npm test` 脚本 | 待测试 | 待上线 |

## 变更明细

### CR-20260930-01 夜间开发自动化脚手架

- **变更类型**：chore（工程配置）
- **变更时间**：2026-09-30
- **实施人**：Luo
- **影响范围**：`scripts/nightly/nightly-cli.js`（新增）、`tasks/nightly-tasks.md`（新增）、`package.json`（新增 `test` 脚本）、`docs/maintenance/changelog/`（新建目录）
- **变更描述**：
  - 新增 `tasks/nightly-tasks.md`，以 `##` 父功能 / `###` 子功能 的层级登记当夜任务，行尾 `(slug)` 作为分支名片段。
  - 新增 `scripts/nightly/nightly-cli.js`，提供 `preflight` / `sync` / `plan` / `start` / `check` / `push-wait` / `merge` / `finish` 子命令，落实「推送后必须轮询 Actions 至 completed」「子分支递归合并回父分支、父分支合并回 feature-1」的规则。
  - `package.json` 补充 `"test": "vitest run"`，补齐此前缺失的测试入口（`vitest` 已在 devDependencies 中但未接线）。
- **测试状态**：待测试
- **上线状态**：待上线
- **说明**：`feature-1 → main` 的合并仅通过 PR 并等待人工审批，本变更不涉及生产部署。