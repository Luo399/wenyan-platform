# 03 - 后端架构重构（P0-P1）

> 返回 [README.md](file:///e:/cpp_discipline/wenyan-platform/docs/refactor/README.md)

---

## B01. errorHandler.js 模块加载即崩溃（requestLogger 未定义）
- **优先级**: P0
- **状态**: [x] 已完成
- **完成日期**: 2026-07-31
- **文件**: `backend/src/middleware/errorHandler.js`（第 59 行）
- **问题描述**:
  1. `errorHandler` 被 `function` 声明了两次（第 15-39 行和第 49-56 行），第二个覆盖第一个
  2. 第 59 行 `module.exports = { requestLogger, ... }` 中 `requestLogger` 在本文件中从未定义（第 6 行导入的是 `logRequest`）
  3. 加载此模块会抛 `ReferenceError`，导致整个应用无法启动
- **修复方案**:
  1. 删除第二个 `errorHandler` 定义（第 49-56 行）
  2. 将 `logRequest` 重命名为 `requestLogger` 或修改导出为 `{ requestLogger: logRequest, ... }`
- **验证方式**: `node -e "require('./backend/src/middleware/errorHandler')"` 无报错
- **分支建议**: `refactor/backend-01`
- **依赖**: 无

## B02. answerController.js submitAnswers 引用未定义变量 result
- **优先级**: P0
- **状态**: [x] 已完成
- **完成日期**: 2026-07-31
- **文件**: `backend/src/controllers/answerController.js`（第 77-140 行）
- **问题描述**:
  1. 第 77-134 行构建 `insertPromises` 数组但从未调用 `Promise.all` 等待
  2. 第 136-140 行引用 `result` 变量但从未声明，抛 `ReferenceError`
  3. 该接口当前 100% 返回 500
- **修复方案**:
  ```js
  const results = await Promise.all(insertPromises)
  const successCount = results.filter(r => r.changes > 0).length
  res.json({ success: true, data: { successCount, totalCount: insertPromises.length } })
  ```
- **验证方式**: `POST /api/submit` 返回 200 + 正确响应体
- **分支建议**: `refactor/backend-02`
- **依赖**: 无

## B03. services/ 层完全无法加载（引用不存在的导出）
- **优先级**: P0
- **状态**: [x] 已完成
- **完成日期**: 2026-07-31
- **文件**:
  - `backend/src/services/answerService.js`（第 6、7、10 行）
  - `backend/src/services/studentService.js`（第 6 行）
  - `backend/src/config/database.js`（第 62-65 行导出 `{ db, initAllTables }`）
  - `backend/src/utils/dbPromise.js`（第 99-105 行导出 `{ dbGet, dbAll, dbRun, stmtRun, dbTransaction }`）
- **问题描述**:
  1. service 层 `require('../config/database')` 解构 `{ answerDb, studentDb }` 但 database.js 只导出 `{ db }`
  2. service 层 `require('../utils/dbPromise')` 解构 `{ dbPrepareRun, dbSerialize }` 但 dbPromise.js 不导出这两个
  3. answerService.js 第 7 行和第 10 行重复 `const` 声明 `dbGet`/`dbAll` → SyntaxError
  4. service 层查询 `answer_records` 表但 database.js 从未建此表
- **修复方案**: 二选一统一 controller/service 路线：
  - **方案 A（推荐）**：以 service 层为准，修正 database.js 导出 + 建表语句 + dbPromise 导出
  - **方案 B**：删除 service 层，controller 直接操作数据库
- **验证方式**: `require('./backend/src/services/answerService')` 无报错
- **分支建议**: `refactor/backend-03`
- **依赖**: 无

## B04. controller 与 service compareAnswers 逻辑不一致
- **优先级**: P1
- **状态**: [x] 已完成
- **完成日期**: 2026-07-31
- **文件**:
  - `backend/src/controllers/answerController.js`（第 41-52 行）
  - `backend/src/services/answerService.js`（第 28-51 行）
- **问题描述**: 两处 `compareAnswers` 实现行为不同，controller 版本不区分类型（`1 === "1"` 误判风险），service 版本用 `String()` 转换。违反 DRY
- **修复方案**: 统一到 `backend/src/utils/answerUtils.js`，controller 和 service 都引用
- **验证方式**: 单元测试覆盖数字/字符串/数组混合比较场景
- **分支建议**: `refactor/backend-04`
- **依赖**: B03

## B05. controller 直接操作数据库绕过 service 层
- **优先级**: P1
- **状态**: [x] 已完成
- **完成日期**: 2026-07-31
- **文件**:
  - `backend/src/controllers/answerController.js`（第 1、92-132、175-234、248-269、275-296 行）
  - `backend/src/controllers/studentController.js`（第 1、4-127 行）
- **问题描述**: controller 全部在内部写 SQL，从不调用 service 层，service 层形同虚设
- **修复方案**: 重写 controller 为薄层，调用 service 函数
- **验证方式**: controller 文件中无 `db.get`/`db.run` 直接调用
- **分支建议**: `refactor/backend-05`
- **依赖**: B03

## B06. submitAnswers 与 submitSingleAnswer 大量重复逻辑
- **优先级**: P1
- **状态**: [x] 已完成
- **完成日期**: 2026-07-31
- **文件**: `backend/src/controllers/answerController.js`（第 54-149 行 vs 第 151-243 行）
- **问题描述**: 两个函数重复了"参数校验 → 取正确答案 → 比对 → 查 attempt → INSERT OR REPLACE → 返回"的相同流程
- **修复方案**: 提取 `processAnswerSubmission(studentId, wenId, answers, questions)` 公共函数
- **验证方式**: 两个接口功能不变，代码量减半
- **分支建议**: `refactor/backend-06`
- **依赖**: B02 + B05

## B07. database.js 表结构与 service 层期望不一致
- **优先级**: P1
- **状态**: [x] 已完成
- **完成日期**: 2026-07-31
- **文件**: `backend/src/config/database.js`（第 22-48 行）
- **问题描述**:
  1. `answers` 表 `UNIQUE(student_id, question_id)` 与 `attempt_number` 字段矛盾
  2. `students` 表字段是 `student_name` 但 service 期望 `name`/`class`
  3. 无索引：`student_id`、`wen_id`、`question_id` 的 WHERE 查询全表扫描
  4. 未启用 WAL 模式
  5. 未启用外键 `PRAGMA foreign_keys = ON`
- **修复方案**:
  1. 统一表结构（决定字段命名）
  2. 添加索引 `CREATE INDEX idx_answers_student ON answers(student_id)`
  3. 添加 `PRAGMA journal_mode = WAL` 和 `PRAGMA foreign_keys = ON`
  4. 解决 UNIQUE 与 attempt_number 矛盾
- **验证方式**: 数据库迁移脚本通过；查询性能测试
- **分支建议**: `refactor/backend-07`
- **依赖**: B03

## B08. token.js 是死代码，JWT 逻辑分散三处
- **优先级**: P1
- **状态**: [x] 已完成
- **完成日期**: 2026-07-31
- **文件**:
  - `backend/src/utils/token.js`（第 1-44 行，全项目未引用）
  - `backend/src/controllers/authController.js`（第 24-28 行直接 `jwt.sign`）
  - `backend/src/middleware/authMiddleware.js`（第 15、38 行直接 `jwt.verify`）
- **问题描述**: 三处 JWT 逻辑各写一套，`token.js` 封装了但无人使用
- **修复方案**:
  1. 所有 token 签发/校验统一走 `token.js`
  2. 删除 controller/middleware 内的直连 `jwt` 调用
- **验证方式**: `grep -r "jwt\.\(sign\|verify\)" backend/src/` 只命中 `token.js`
- **分支建议**: `refactor/backend-08`
- **依赖**: 无

## B09. JWT payload 字段命名不一致（下划线 vs 驼峰）
- **优先级**: P1
- **状态**: [x] 已完成
- **完成日期**: 2026-07-31
- **文件**:
  - `backend/src/controllers/authController.js`（第 24-28 行签发 `{ student_id, role }`）
  - `backend/src/middleware/authMiddleware.js`（第 16、39 行 `req.user = decoded`）
  - `backend/src/utils/logger.js`（第 190-191 行尝试读 `req.user.studentId`）
- **问题描述**: token 签发用 `student_id`（下划线），下游读 `studentId`（驼峰），全部取到 `undefined`
- **修复方案**: 统一为驼峰风格 `{ studentId, role }` 或统一为下划线，全链路一致
- **验证方式**: 中间件中 `req.user.studentId` 能正确取到值
- **分支建议**: `refactor/backend-09`
- **依赖**: B08

## B10. authMiddleware 缺少角色鉴权（RBAC）
- **优先级**: P1
- **状态**: [x] 已完成
- **完成日期**: 2026-07-31
- **文件**: `backend/src/middleware/authMiddleware.js`（第 24-48 行）
- **问题描述**: 只做 token 校验，完全没有角色检查。任何 student token 可访问管理端接口
- **修复方案**:
  ```js
  function requireRoleMiddleware(...roles) {
    return (req, res, next) => {
      if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }
      next()
    }
  }
  ```
- **验证方式**: student token 访问管理接口返回 403
- **分支建议**: `refactor/backend-10`
- **依赖**: B09

## B11. 全局日志 console.error/console.log 未走 logger.js
- **优先级**: P2
- **状态**: [x] 已完成
- **完成日期**: 2026-07-31
- **文件**: `answerController.js`、`studentController.js`、`authController.js`、`authMiddleware.js`、`database.js` 等
- **问题描述**: 项目有完整的 `utils/logger.js` 但大部分模块直接用 `console.error`/`console.log`，日志体系名存实亡
- **修复方案**: 全项目 `console.error` → `logger.error`，`console.log` → `logger.info`
- **验证方式**: `grep -r "console\.\(log\|error\)" backend/src/` 无命中
- **分支建议**: `refactor/backend-11`
- **依赖**: B01（errorHandler 修复后才能正常加载）

## B12. logger.js 日志轮转未实现
- **优先级**: P2
- **状态**: [x] 已完成
- **完成日期**: 2026-07-31
- **文件**: `backend/src/utils/logger.js`（第 116-125 行）、`backend/src/config/app.js`（第 42-43 行）
- **问题描述**: `maxFileSize`/`maxFiles` 配置已定义但代码中从未实现日志轮转，日志文件会无限增长
- **修复方案**: 使用 `winston-daily-rotate-file` 或手动实现文件大小检查 + 轮转
- **验证方式**: 日志文件超过 maxFileSize 后自动创建新文件
- **分支建议**: `refactor/backend-12`
- **依赖**: B11

## B13. database.js initAllTables 回调风格未 Promise 化
- **优先级**: P2
- **状态**: [x] 已完成
- **完成日期**: 2026-07-31
- **文件**: `backend/src/config/database.js`（第 19-60 行）
- **问题描述**: `initAllTables` 仍是两层嵌套回调，未使用已封装的 `dbPromise.js` 的 `dbRun`
- **修复方案**: 改用 `await dbRun(db, sql)` 风格
- **验证方式**: 建表逻辑正常，无回调嵌套
- **分支建议**: `refactor/backend-13`
- **依赖**: B03
