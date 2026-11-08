# 变更记录 changelog-20261001

> 记录时间：2026-10-01
> 实施人：Trae 夜间开发代理
> 集成分支：feature-1（远端 https://github.com/Luo399/wenyan-platform.git）
> 说明：本批次为 10.1-10.2 夜间开发任务（共 5 项），均在 `trae/agent-*` 开发分支上完成、经 GitHub Actions `CI Checks` 通过后以 `--no-ff` 合并回 `feature-1`；未推送/未合并到 `main`。

## 变更明细

### 1. 导航「继续」按钮延迟优化

| 字段 | 内容 |
|-----|------|
| 变更编号 | R101 |
| 变更类型 | fix/perf |
| 变更描述 | `src/composables/useNavigation.ts` 的 `goNext()` 在生产环境仍有 6 处 `console.*` 输出，其中序列化整个 `nextPage` 对象阻塞主线程，导致点击「继续」响应延迟；改为 `debugLog/debugWarn` 并补充耗时埋点 |
| 变更时间 | 2026-10-01 |
| 实施人 | Trae 夜间开发代理 |
| 影响范围 | `src/composables/useNavigation.ts`、`tests/composables/useNavigation.spec.ts` |
| 测试状态 | 通过（CI Checks success） |
| 上线状态 | 待上线（已合并 feature-1） |

### 2. 测试账密 99999999 学生登录失败修复

| 字段 | 内容 |
|-----|------|
| 变更编号 | R102 |
| 变更类型 | fix |
| 变更描述 | 根因有四：①登录页 `useStudentQuery` 调用需鉴权的 `GET /api/students/:id` 必然 401；②`src/utils/api.ts` 把任何 401 都当作「登录过期」；③后端 `getStudent` 返回 `student_name` 而前端读 `data.name`；④`backend/src/config/database.js` 的 `seedTestStudent` 注释与 NODE_ENV 判断不符。修复：新增公开接口 `GET /api/students/:studentId/name`（仅返回学号+姓名）；401 语义按「是否已有会话」区分；`getStudent` 增加 `name` 兼容别名；播种逻辑增加生产环境守卫 |
| 变更时间 | 2026-10-01 |
| 实施人 | Trae 夜间开发代理 |
| 影响范围 | `backend/src/controllers/studentController.js`、`backend/src/routes/index.js`、`backend/src/config/database.js`、`src/utils/api.ts`、`src/composables/useStudentQuery.ts`、`backend/tests/student-login.test.js`、`backend/tests/seed-production.test.js` |
| 测试状态 | 通过（新增后端回归测试；CI Checks success） |
| 上线状态 | 待上线（已合并 feature-1） |

### 3. 管理员界面教师/学生账密增删查改

| 字段 | 内容 |
|-----|------|
| 变更编号 | R103 |
| 变更类型 | feat |
| 变更描述 | 后端 `adminController` 补齐「按 id 查单个 / 更新 / 删除」教师与学生能力，并新增「新增学生」；前端新增 `services/adminService.ts` 与管理员控制台页 `views/AdminConsoleView.vue`（教师 / 学生两个 Tab，含列表、增删改、重置密码），路由新增 `/admin-console`，管理员登录后跳转控制台 |
| 变更时间 | 2026-10-01 |
| 实施人 | Trae 夜间开发代理 |
| 影响范围 | `backend/src/controllers/adminController.js`、`backend/src/routes/index.js`、`backend/tests/admin-accounts.test.js`、`src/services/adminService.ts`、`src/views/AdminConsoleView.vue`、`src/router/index.ts`、`src/views/AdminLoginView.vue`、`src/views/AnswerQueryView.vue` |
| 测试状态 | 通过（新增后端测试；CI Checks success） |
| 上线状态 | 待上线（已合并 feature-1） |

### 4. 教师对本班学生账密增删查改（补删除学生）

| 字段 | 内容 |
|-----|------|
| 变更编号 | R104 |
| 变更类型 | feat |
| 变更描述 | `teacherController` 原已具备学生查询/新增/批量新增/更新/重置密码能力，本次补齐「删除学生」`deleteStudent`，权限校验复用 `teacherCanManageClass`（仅能删除自己所教班级学生，越权返回 403），并同步登记路由与 `module.exports` |
| 变更时间 | 2026-10-01 |
| 实施人 | Trae 夜间开发代理 |
| 影响范围 | `backend/src/controllers/teacherController.js`、`backend/src/routes/index.js`、`backend/tests/teacher-students.test.js` |
| 测试状态 | 通过（新增后端测试；CI Checks success） |
| 上线状态 | 待上线（已合并 feature-1） |

### 5. 教师查看学生完成情况（框架 + 前端页面）

| 字段 | 内容 |
|-----|------|
| 变更编号 | R105 |
| 变更类型 | feat |
| 变更描述 | 搭建「教师查看学生完成情况」基本框架：后端新增 `GET /api/teacher/completion/students`（返回所教班级学生名单与统一统计字段，`metrics_ready=false` 标记统计口径待接入）；前端新增 `services/teacherCompletionService.ts` 与 `views/TeacherCompletionView.vue`（班级筛选、汇总卡片、明细表、空/错状态），路由新增 `/teacher-completion`，教师工具导航新增入口 |
| 变更时间 | 2026-10-01 |
| 实施人 | Trae 夜间开发代理 |
| 影响范围 | `backend/src/controllers/teacherController.js`、`backend/src/routes/index.js`、`backend/tests/teacher-completion.test.js`、`src/services/teacherCompletionService.ts`、`src/views/TeacherCompletionView.vue`、`src/router/index.ts`、`src/views/AnswerQueryView.vue` |
| 测试状态 | 通过（新增后端测试；CI Checks success） |
| 上线状态 | 待上线（已合并 feature-1） |

## 验证方式

- 后端：`cd backend; $env:DB_PATH=':memory:'; $env:JWT_SECRET='ci-test-secret'; $env:NODE_ENV='test'; npm test` → 13 个 suite / 146 个用例全部通过
- 前端：`npm run type-check` → 无类型错误
- 远端：GitHub Actions `CI Checks`（quality-check / backend-check / pipeline-test / figma-plugin-check）在 `trae/agent-101~105` 各分支均为 success

## 备注

- 本批次仅做代码编写、本地静态检查与 GitHub Actions 轮询；未启动本地服务、未部署、未 SSH 云服务器、未改动真实 .env 密钥。
- 任务 5 的统计口径（答题数 / 正确数 / 完成率 / 最近提交时间）为后续迭代内容，接口已通过 `metrics_ready=false` 显式标记，前端据此提示。
