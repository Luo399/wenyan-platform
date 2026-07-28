# 重构分支框架结构

## 分支结构总览

所有重构分支从 `develop` 拉出，彼此独立，测试通过后合并回 `develop`。

```
develop (主开发分支)
├── refactor/db-promise           # SQLite Promise 化
├── refactor/jwt-standard         # JWT 标准库替换
├── refactor/json-reader-split    # jsonReader 函数拆分
├── refactor/controller-handler   # 控制器高阶函数
├── refactor/api-consolidate      # API 定义合并
├── refactor/dataloader-cache     # useDataLoader 缓存优化
├── refactor/student-query        # 学生查询逻辑提取
├── refactor/mousemove-scope      # WordList mousemove 优化
├── refactor/router-lazy          # 路由懒加载
├── refactor/temp-files-clean     # 临时文件清理
└── data-pipeline/main            # 数据管道主分支
    ├── data-pipeline/config      # 配置与校验
    ├── data-pipeline/incremental # 增量更新
    └── data-pipeline/version     # 版本管理
```

---

## 后端重构分支

### 1. refactor/db-promise
- **问题**: SQLite 回调风格，手工 `new Promise` 包裹重复
- **修改文件**: 
  - `backend/src/utils/dbPromise.js` (新增)
  - `backend/src/services/studentService.js`
  - `backend/src/services/answerService.js`
- **测试清单**:
  - `tests/backend/dbPromise.spec.js`
- **验证**: 所有数据库操作返回 Promise

### 2. refactor/jwt-standard
- **问题**: 手写 HMAC-SHA256 实现，安全隐患
- **修改文件**:
  - `backend/package.json`
  - `backend/src/utils/token.js`
- **测试清单**:
  - `tests/backend/token.spec.js`
- **验证**: token 生成/验证使用 jsonwebtoken

### 3. refactor/json-reader-split
- **问题**: `getCorrectAnswerFromJson` 150+ 行超长函数
- **修改文件**:
  - `backend/src/utils/jsonReader.js`
- **测试清单**:
  - `tests/backend/jsonReader.spec.js`
- **验证**: 主函数 < 50 行，提取 5 个独立查找函数

### 4. refactor/controller-handler
- **问题**: textsController 9 个重复 getter 函数
- **修改文件**:
  - `backend/src/controllers/textsController.js`
- **测试清单**:
  - `tests/backend/textsController.spec.js`
- **验证**: 使用 `createTextHandler` 高阶函数，代码压缩至 ~40 行

---

## 前端重构分支

### 5. refactor/api-consolidate
- **问题**: api.ts 与 apiService.ts 接口重复定义
- **修改文件**:
  - `src/utils/api.ts`
  - `src/services/apiService.ts`
  - 5 个引用组件
- **测试清单**:
  - `tests/utils/api.spec.ts`
- **验证**: api.ts 仅保留底层 HTTP 封装，业务接口迁移到 apiService.ts

### 6. refactor/dataloader-cache
- **问题**: 缓存为实例级，无上限，无清理接口
- **修改文件**:
  - `src/composables/useDataLoader.ts`
- **测试清单**:
  - `tests/composables/useDataLoader.spec.ts`
- **验证**: 模块级 LRU 缓存（上限 100），导出 `clearDataCache()`

### 7. refactor/student-query
- **问题**: LoginModal、StudentDisplay 重复调用学生 API
- **修改文件**:
  - `src/composables/useStudentQuery.ts` (新增)
  - `src/components/LoginModal.vue`
  - `src/components/StudentDisplay.vue`
- **测试清单**:
  - `tests/composables/useStudentQuery.spec.ts`
- **验证**: 提取共享 composable，消除重复

### 8. refactor/mousemove-scope
- **问题**: WordList 全局 mousemove 事件监听
- **修改文件**:
  - `src/components/WordList.vue`
- **测试清单**:
  - `tests/components/WordList.spec.ts`
- **验证**: 监听范围缩小到 `.article-content` 容器

### 9. refactor/router-lazy
- **问题**: 非首屏组件同步 import，首屏包体积大
- **修改文件**:
  - `src/router/index.ts`
- **测试清单**:
  - `tests/router/index.spec.ts`
- **验证**: 10 个非首屏组件改为 `() => import()`

### 10. refactor/temp-files-clean
- **问题**: 临时文件残留，.gitignore 规则缺失
- **修改文件**:
  - `.gitignore`
  - `package.json`
- **测试清单**:
  - 无（手动验证）
- **验证**: 删除临时文件，补充 `__pycache__` 规则

---

## 数据管道分支

### 11. data-pipeline/main (主分支)
- **问题**: 数据处理缺乏校验、版本管理、增量更新
- **子分支结构**:
  - `data-pipeline/config`: 配置与校验函数
  - `data-pipeline/incremental`: 增量更新追踪
  - `data-pipeline/version`: 备份/回滚/版本列表
- **修改文件**:
  - `data_processor/config.py`
  - `data_processor/processor.py`
  - `data_processor/main.py`
  - `data_processor/incremental.py`
  - `data_processor/version_manager.py`
  - `verify_pipeline.py`
  - `.github/workflows/data-pipeline.yml`
- **测试清单**:
  - `tests/data_processor/test_processor.py`
  - `tests/data_processor/test_incremental.py`
  - `tests/data_processor/test_version_manager.py`
- **验证**: 端到端验证脚本通过

---

## 执行顺序建议

**第一批（基础设施，无依赖）**:
1. `refactor/db-promise` (SQLite Promise 化，后续服务可复用)
2. `refactor/jwt-standard` (独立模块)

**第二批（后端重构，依赖第一批）**:
3. `refactor/json-reader-split` (可并行)
4. `refactor/controller-handler` (可并行)

**第三批（前端重构，彼此独立）**:
5. `refactor/api-consolidate`
6. `refactor/dataloader-cache`
7. `refactor/student-query`
8. `refactor/mousemove-scope`
9. `refactor/router-lazy`
10. `refactor/temp-files-clean`

**第四批（数据管道，独立模块）**:
11. `data-pipeline/main` + 子分支

---

## 测试要求

每个分支必须：
1. 新增对应测试文件
2. 所有测试通过
3. 不破坏现有测试
4. PR 前在本地运行 `npm test`

---

## 合并流程

```
分支开发 → 测试通过 → PR → develop → CI 通过 → 合并
```

禁止直接推送到 `develop` 和 `main`。