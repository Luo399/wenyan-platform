# 重构清单总览

> 本目录是项目的完整重构清单，按优先级分为 7 个专题文件。
> 每个文件可独立作为一次对话任务的输入，完成后更新状态标记。

## 文件索引

| # | 专题 | 优先级 | 问题数 | 状态 | 文件 |
|---|------|--------|--------|------|------|
| 01 | 安全漏洞修复 | P0 | 11 | 未开始 | [01-security-critical.md](file:///e:/cpp_discipline/wenyan-platform/docs/refactor/01-security-critical.md) |
| 02 | 路由与鉴权系统 | P0 | 5 | 未开始 | [02-routing-auth.md](file:///e:/cpp_discipline/wenyan-platform/docs/refactor/02-routing-auth.md) |
| 03 | 后端架构重构 | P0-P1 | 13 | 未开始 | [03-backend-architecture.md](file:///e:/cpp_discipline/wenyan-platform/docs/refactor/03-backend-architecture.md) |
| 04 | 前端组件质量 | P1 | 10 | 未开始 | [04-frontend-components.md](file:///e:/cpp_discipline/wenyan-platform/docs/refactor/04-frontend-components.md) |
| 05 | 前端架构与类型 | P1-P2 | 12 | 未开始 | [05-frontend-architecture.md](file:///e:/cpp_discipline/wenyan-platform/docs/refactor/05-frontend-architecture.md) |
| 06 | 工程化与配置 | P1-P2 | 16 | 未开始 | [06-engineering-config.md](file:///e:/cpp_discipline/wenyan-platform/docs/refactor/06-engineering-config.md) |
| 07 | 数据管道优化 | P2 | 7 | 未开始 | [07-data-pipeline.md](file:///e:/cpp_discipline/wenyan-platform/docs/refactor/07-data-pipeline.md) |

**合计：74 个问题**

## 优先级说明

| 级别 | 含义 | 行动要求 |
|------|------|---------|
| **P0** | 功能崩溃 / 安全漏洞 | 必须立即修复，阻断生产 |
| **P1** | 生产构建前必须修复 | 上线前完成 |
| **P2** | 技术债务 / 代码质量 | 迭代中逐步改善 |
| **P3** | 优化建议 | 有空时处理 |

## 执行顺序建议

```
第一批（P0 安全 + 路由，阻断生产）:
  01-security-critical.md  →  02-routing-auth.md

第二批（P0-P1 后端架构，依赖第一批）:
  03-backend-architecture.md

第三批（P1 前端，彼此独立可并行）:
  04-frontend-components.md  ↔  05-frontend-architecture.md

第四批（P1-P2 工程化，可并行）:
  06-engineering-config.md

第五批（P2 数据管道，独立模块）:
  07-data-pipeline.md
```

## 状态标记规范

每个问题条目使用以下状态标记：

- `[ ]` 未开始
- `[~]` 进行中
- `[x]` 已完成
- `[!]` 阻塞中（需说明原因）

## 分支命名规范

每个专题对应一组分支，命名遵循 `refactor/<专题名>-<问题编号>`：

```
refactor/security-01      # 安全漏洞第 1 项
refactor/routing-02       # 路由鉴权第 2 项
refactor/backend-03       # 后端架构第 3 项
refactor/component-01     # 前端组件第 1 项
refactor/architecture-02  # 前端架构第 2 项
refactor/engineering-01   # 工程化第 1 项
refactor/pipeline-01      # 数据管道第 1 项
```

## 每个问题条目包含的要素

```markdown
### 问题编号. 简短标题
- **优先级**: P0 / P1 / P2
- **状态**: [ ] 未开始
- **文件**: 文件路径 + 行号范围
- **问题描述**: 具体问题与根因
- **修复方案**: 具体步骤
- **验证方式**: 如何确认修复有效
- **分支建议**: refactor/xxx-NN
- **依赖**: 是否依赖其他问题先完成
```

## 进度追踪

| 日期 | 完成专题 | 完成问题数 | 备注 |
|------|---------|-----------|------|
| - | - | 0/74 | 待开始 |

## 使用方式

1. 选择一个专题文件（如 `01-security-critical.md`）
2. 在新对话中粘贴该文件内容或引用文件路径
3. AI 读取文件后按顺序逐个修复
4. 修复完成后更新状态标记 `[ ]` → `[x]`
5. 回到本文件更新进度追踪表
