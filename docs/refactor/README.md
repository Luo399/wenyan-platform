# 重构清单总览

> 本目录是项目的完整重构清单，按优先级分为 7 个专题文件 + 2 个滚动审查文件。
> 每个文件可独立作为一次对话任务的输入，完成后更新状态标记。

## 文件索引

### 一、专题清单（按模块划分）

| #   | 专题                    | 优先级 | 问题数 | 状态   | 文件                                                                                                               |
| --- | ----------------------- | ------ | ------ | ------ | ------------------------------------------------------------------------------------------------------------------ |
| 01  | 安全漏洞修复            | P0     | 11     | 未开始 | [01-security-critical.md](file:///e:/cpp_discipline/wenyan-platform/docs/refactor/01-security-critical.md)         |
| 02  | 路由与鉴权系统          | P0     | 5      | 未开始 | [02-routing-auth.md](file:///e:/cpp_discipline/wenyan-platform/docs/refactor/02-routing-auth.md)                   |
| 03  | 后端架构重构            | P0-P1  | 13     | 未开始 | [03-backend-architecture.md](file:///e:/cpp_discipline/wenyan-platform/docs/refactor/03-backend-architecture.md)   |
| 04  | 前端组件质量（C01-C11） | P1-P2  | 11     | 已完成 | [04-frontend-components.md](file:///e:/cpp_discipline/wenyan-platform/docs/refactor/04-frontend-components.md)     |
| 05  | 前端架构与类型          | P1-P2  | 12     | 未开始 | [05-frontend-architecture.md](file:///e:/cpp_discipline/wenyan-platform/docs/refactor/05-frontend-architecture.md) |
| 06  | 工程化与配置            | P1-P2  | 16     | 未开始 | [06-engineering-config.md](file:///e:/cpp_discipline/wenyan-platform/docs/refactor/06-engineering-config.md)       |
| 07  | 数据管道优化            | P2     | 7      | 已完成 | [07-data-pipeline.md](file:///e:/cpp_discipline/wenyan-platform/docs/refactor/07-data-pipeline.md)                 |

专题合计：75 个问题

### 二、滚动审查清单（C01-C11 完成后持续发现的新问题）

| #   | 轮次   | 范围                                | 问题数 | 状态   | 文件                                                                                                   |
| --- | ------ | ----------------------------------- | ------ | ------ | ------------------------------------------------------------------------------------------------------ |
| 08  | 第二轮 | C01-C11 完成后的前端审查（R01-R50） | 50     | 未开始 | [08-frontend-round2.md](file:///e:/cpp_discipline/wenyan-platform/docs/refactor/08-frontend-round2.md) |
| 09  | 第三轮 | 更广泛文件审查（R51-R116）          | 66     | 已完成 | [09-frontend-round3.md](file:///e:/cpp_discipline/wenyan-platform/docs/refactor/09-frontend-round3.md) |

滚动审查合计：116 个问题

**累计：191 个问题（专题 75 + 滚动审查 116）**

## 优先级说明

| 级别   | 含义                | 行动要求               |
| ------ | ------------------- | ---------------------- |
| **P0** | 功能崩溃 / 安全漏洞 | 必须立即修复，阻断生产 |
| **P1** | 生产构建前必须修复  | 上线前完成             |
| **P2** | 技术债务 / 代码质量 | 迭代中逐步改善         |
| **P3** | 优化建议            | 有空时处理             |

## 执行顺序建议

### 已完成

```
04-frontend-components.md（C01-C11 全部完成）
```

### 待执行（按优先级排序）

```
第一批（P0 安全 + 路由，阻断生产）:
  01-security-critical.md  →  02-routing-auth.md
  + 09-frontend-round3.md 中的 P0 安全问题（R90, R103, R108, R51, R52, R54）

第二批（P0-P1 后端架构，依赖第一批）:
  03-backend-architecture.md

第三批（P1 前端架构 + 第二/三轮审查 P1）:
  05-frontend-architecture.md  ↔  08-frontend-round2.md（R01-R11 等 P1）
  ↔  09-frontend-round3.md（R55-R57, R62, R64, R75, R82, R91, R96, R98, R101, R104, R109, R115 等 P1）

第四批（P1-P2 工程化，可并行）:
  06-engineering-config.md

第五批（P2 数据管道，独立模块）:
  07-data-pipeline.md

第六批（P2-P3 滚动审查剩余项）:
  08-frontend-round2.md 的 P2-P3（R07-R50）
  09-frontend-round3.md 的 P2-P3（R53-R116）
```

### 跨文件依赖关系

- 09-frontend-round3.md 的 R51（ScenQuiz 异步 useDataLoader）依赖 R01（AdaptQuiz 同类问题）的模式参考
- 09-frontend-round3.md 的 R53（PreQuizText textId）依赖 R52（同文件竞态 bug 修复）
- 09-frontend-round3.md 的 R103（login 凭证）依赖 R90（前端密钥移除）
- 09-frontend-round3.md 的 R107（submittedAt 服务端生成）依赖 R90
- 09-frontend-round3.md 的 R111/R112（adapter 改进）依赖 R108（adapter 工厂重构）

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

| 日期                    | 完成专题                       | 完成问题数                  | 备注                                                                                                                                                             |
| ----------------------- | ------------------------------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-28 ~ 2026-07-29 | 04-frontend-components.md      | 11/11（C01-C11）            | 全部合并到 main，生产部署成功                                                                                                                                    |
| 2026-07-30              | 09-frontend-round3.md P0       | 4/66（R51, R52, R54, R108） | useDataLoader 异步调用违规 ×3 + adapter 工厂重构，分支+CI 通过，PR 待合并                                                                                        |
| 2026-07-30              | 09-frontend-round3.md R90      | 1/66（R90）                 | 前端 VITE_AUTH_SECRET dead code 清理 + 后端 HMAC 校验移除 + yml/env 配置清理，PR #54 squash 合并到 feature-1，测试环境部署成功                                    |
| 2026-07-30              | 09-frontend-round3.md R103     | 1/66（R103）                | stores/auth.ts 加 password 参数 + 改调 /api/auth/student/login；LoginModal/StudentDisplay 加密码输入框；apiService.ts 删 dead login；PR #55 squash 合并到 feature-1，测试环境部署成功。强制改密流程延后 |
| 2026-07-30              | 09-frontend-round3.md P1 批次  | 8/66（R75, R82, R91, R96, R98, R101, R104, R115） | P1 安全+数据完整性批次：R75/R82 被前序轮次覆盖；R91/R96/R98/R101/R104/R115 由 PR #58 squash 合并到 feature-1，测试环境部署成功 |
| 2026-07-30              | 07-data-pipeline.md            | 7/7（P01-P07）              | config.py 重构提取 map_answer_to_index/post_process_quiz_generic 并消除副作用；validators.py 加 is_absolute_path/validate_no_absolute_path；新建 pyproject.toml 声明依赖与包结构；main.py 移除 sys.path.append；ci-checks.yml 新增 pipeline-test job；test_config.py/test_validators.py 补充单元测试；P02/P03 代码早已修复同步文档状态 |
| 2026-07-30              | 09-frontend-round3.md P1 批次4 | 6/66（R55, R56, R57, R62, R64, R109） | P1 bug+a11y 批次：R55 DialogText typeText 去重；R56 Audio 内存泄漏；R57 ScenQuiz watchLoader 抽取；R62 CultureCards 键盘支持；R64 进度条键盘操作；R109 correct_answer ?? 修复。PR #60 squash 合并到 feature-1，前端测试部署成功（无 backend 改动，后端部署未触发属预期） |
| 2026-07-30              | 09-frontend-round3.md P2/P3    | 46/66（P2: 37 项 + P3: 9 项） | P2/P3 全量优化：utils(api/asset/localStorage/format) 类型安全+异常包裹；stores+composables auth/student/bgm/useNavigation/useDataLoader/useQuizProgress 重构；adapters quizAdapter/level1-3 类型+拆分；components PreQuizText/StepThreeView/CultureCards/BlockRenderer/BackContinue/DialogText/DialogueCard/ScenQuiz a11y+DRY+性能；services+router apiService/router/guards 类型+清理。分支 trae/agent-round3-p2p3，PR 待创建 |
| -                       | 01-03, 05-06 专题              | 0/57                        | 待开始（07 已完成）                                                                                                                                             |
| -                       | 08-frontend-round2.md          | 0/50                        | 待开始                                                                                                                                                           |
| -                       | 09-frontend-round3.md 剩余     | 0/0                         | 09 专题 R51-R116 共 66 项全部完成                                                                                                                                |
| -                       | **合计**                       | **84/191**                  | 专题 18（04 的 11 + 07 的 7）+ 滚动审查 66（R51-R116 全部）                                                                                                     |

## 使用方式

1. 选择一个专题文件（如 `01-security-critical.md`）
2. 在新对话中粘贴该文件内容或引用文件路径
3. AI 读取文件后按顺序逐个修复
4. 修复完成后更新状态标记 `[ ]` → `[x]`
5. 回到本文件更新进度追踪表
