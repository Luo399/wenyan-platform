# 变更日志

## [v1.1.0] - 2026-07-16

### 代码重构（10项）

#### 后端

| # | 重构内容 | 修改文件 | 效果 |
|---|---------|---------|------|
| 1 | 控制器重复代码统一 | `backend/src/controllers/textsController.js` | 高阶函数 `createTextHandler` 统一 9 个重复 getter，170行 → 40行 |
| 2 | SQLite 回调 Promise 化 | `backend/src/utils/dbPromise.js`（新建）+ `studentService.js` + `answerService.js` | 移除所有手工 `new Promise` 包裹，统一使用 `dbGet/dbAll/dbRun` |
| 3 | jsonReader 超长函数拆分 | `backend/src/utils/jsonReader.js` | 提取 `findAnswerInData`、`extractAnswer`、`matchesId`，主函数 150行 → 30行 |
| 4 | JWT 标准库替换 | `backend/src/utils/token.js` + `backend/package.json` | `jsonwebtoken` 替换手写 HMAC-SHA256 实现 |

#### 前端

| # | 重构内容 | 修改文件 | 效果 |
|---|---------|---------|------|
| 5 | API 重复定义合并 | `src/utils/api.ts` + `src/services/apiService.ts` + 4 个引用文件 | api.ts 仅保留底层 HTTP 封装，业务接口和类型统一到 apiService.ts |
| 6 | useDataLoader 缓存优化 | `src/composables/useDataLoader.ts` | 缓存提升为模块级共享，LRU 上限 100 条，新增 `clearDataCache()` |
| 7 | WordList mousemove 优化 | `src/components/WordList.vue` | 事件监听从 `document` 缩小到 `.article-content` 容器 |
| 8 | 学生姓名查询逻辑提取 | `src/composables/useStudentQuery.ts`（新建）+ `LoginModal.vue` | 提取共享 composable，消除重复 API 调用代码 |

#### 工程化

| # | 重构内容 | 修改文件 | 效果 |
|---|---------|---------|------|
| 9 | 路由懒加载 | `src/router/index.ts` | 非首屏 6 个页面组件改为 `() => import()` 异步加载 |
| 10 | 临时文件和依赖清理 | 删除 18 个临时文件 + `.gitignore` + `package.json` | 移除 bfg.jar、调试脚本、生成脚本等，补充忽略规则，修正依赖分类 |

### 已知遗留问题（未处理）

- 后端 `logger.js` 输出逻辑重复
- `rateLimitMiddleware` 内存存储（多实例部署时限流不共享）
- 后端缺少全局 async 错误捕获
- `wenUtils.ts` 与 `PoetryMenu.vue` 硬编码数据重复
- `Level1Quiz.vue` 中非 UI 逻辑混杂
- `useQuizProgress.ts` 职责不够单一
- `databaseAdapter.ts` 与 `adapterUtils.ts` parseTimeRange 重复定义
- 前端 `stores/auth.ts` 手动解析 JWT payload
- `vite.config.ts` legacy 插件 IE11 目标不合理
