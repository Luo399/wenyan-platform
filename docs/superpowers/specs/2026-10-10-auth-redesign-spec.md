# 登录系统三层角色设计规格

> 管理员 - 教师 - 学生 三层角色模型收紧与密码统一
> 2026-10-10

---

## 0. 目标与范围

### 0.1 要达成什么

1. 学号严格为 8 位（4+2+2），班级编码严格为 6 位（4+2）。
2. 三层角色（admin / teacher / student）各自的认证与权限模型完全对齐需求。
3. 教师注册必须经管理员审批才能登录（pending → active）。
4. 学生和教师的初始/重置密码统一为 `99999999`。
5. 废弃无权限校验的旧路由，确保学生数据读写全部走 teacher / admin 命名空间。
6. 旧学号数据全量淘汰（不做渐进迁移）。

### 0.2 不在范围内的事

- 不建独立的 `classes` 表——班级仍以纯字符串 `class_code` 形式存在。
- 不拆分 authService / teacherService / studentService（留作后续重构）。
- 不引入新的 RBAC 框架（Casbin 等）。
- 不改动前端路由守卫逻辑（auth.ts / guards.ts 已有完整实现）。

### 0.3 采用的路径

**方案 A：就地修补**——在现有三张用户表 + JWT + requireRole 架构上做最小必要改动，不触及骨架。

---

## 1. 数据模型

### 1.1 学号格式（student_id）

| 项 | 值 |
|----|----|
| 正则 | `/^\d{8}$/` |
| 段 | `YYYYNNNN`：前 4 位入学年份，中 2 位班级序号，后 2 位班内序号 |
| 示例 | `20211123` = 2021 级 11 班 23 号 |
| 数据库 | `students.student_id TEXT NOT NULL UNIQUE`（类型不变，应用层负责校验） |

**涉及校验位置（全部要收紧到 8 位）：**
- `backend/src/controllers/authController.js` → `studentLoginSchema`
- `backend/src/controllers/teacherController.js` → `createStudentSchema` / `batchCreateSchema`
- `backend/src/controllers/adminController.js` → `createStudent` / `updateStudent`
- `frontend/src/services/studentService.ts` → 学号校验
- `frontend/src/components/StudentFormModal.vue` → 学号表单校验

### 1.2 班级编码（class_code）

| 项 | 值 |
|----|----|
| 正则 | `/^\d{4}(0[1-9]|[1-2]\d|3[0-1])$/` |
| 段 | `YYYYCC`：前 4 位年级，后 2 位班级序号 01–31 |
| 示例 | `202403` = 2024 级 3 班 |
| 数据库 | `students.class_code TEXT NOT NULL` + `teacher_classes.class_code TEXT NOT NULL` |

**涉及校验位置（全部要收紧到 6 位 + 合理范围）：**
- `backend/src/controllers/authController.js` → `teacherRegisterSchema.class_codes`
- `backend/src/controllers/teacherController.js` → `_enforceClassPermission` 中 `extractClassCode` 结果的二次校验
- `backend/src/controllers/adminController.js` → `createTeacher` / `updateTeacher` / `createStudent` / `updateStudent`
- `backend/src/services/authService.js` → `extractClassCode()` 保持取前 6 位逻辑，外加 8 位学号前置断言

### 1.3 密码常量统一

`backend/src/services/authService.js`：

```js
const DEFAULT_STUDENT_PASSWORD = '99999999'  // 原 '123456'
const DEFAULT_TEACHER_PASSWORD  = '99999999'  // 新增常量
```

**影响范围：**
| 场景 | 调用点 | 新密码 |
|------|--------|--------|
| admin 创建学生 | adminController.createStudent → `getDefaultPasswordHash()` | 99999999 + must_reset=1 |
| teacher 创建学生 | teacherController.createStudent / batch → `getDefaultPasswordHash()` | 99999999 + must_reset=1 |
| teacher 重置学生密码 | teacherController.resetStudent → `resetStudentPassword()` | 99999999 + must_reset=1 |
| admin 重置学生密码 | adminController.resetStudent → `resetStudentPassword()` | 99999999 + must_reset=1 |
| admin 重置教师密码 | adminController.resetTeacher → `resetTeacherPasswordByAdmin()` | **废弃随机密码生成**，改为 hash('99999999')，返回 `{ temporary_password: '99999999' }` |
| 教师注册自助设密 | teacherRegister 时用户填的密码 | 用户自选，但 ≥ 6 位 |
| 学生/教师自助改密 | authController.changePassword | 用户自选，但 ≥ 6 位 |

### 1.4 teachers.status 枚举扩展

| 状态 | 含义 | 能否登录 | 产生场景 |
|------|------|---------|---------|
| `pending` | 刚自助注册，等待管理员审批 | ❌ | `teacherRegister` 写入 |
| `active` | 已审批通过 | ✅ | 管理员 approve 后 |
| `disabled` | 管理员手动禁用 | ❌ | 管理员 setTeacherStatus |

数据库层面无需改表（status 字段本来就是 TEXT），只扩展枚举值。

### 1.5 不变的表结构

以下表保持原样，不做 schema 变更：

- `admins` — 管理员账号表
- `schools` — 学校表（teacher 外键）
- `students` — 仅应用层校验收紧
- `teacher_classes` — 教师-班级 n:n 关系表
- `password_resets` — 密码重置审计表
- `answers` — 答题记录表
- `tracking_events` — 埋点表

---

## 2. 认证流程

### 2.1 学生登录（不变）

```
POST /api/auth/student-login  { student_id: 8位, password }
  → 校验学号 8 位
  → SELECT students WHERE student_id = ?
  → verifyPassword
  → 签发 JWT { role: 'student', student_id }
  → 返回 user（含 must_reset_password）
```

### 2.2 教师注册（改）

```
POST /api/auth/teacher-register  { phone, name, school_id, password, class_codes: [6位字符串] }

改前：INSERT status='active' → 直接发 token
改后：INSERT status='pending'（教师自设密码，不强制改密）
      返回 201 { message: '注册成功，等待管理员审批' }  —— 不带 token
```

### 2.3 教师登录（改）

```
POST /api/auth/teacher-login  { phone, password }

  → SELECT teachers WHERE phone = ?
  → verifyPassword
  → 检查 status：
      'pending'  → 403 ACCOUNT_PENDING   "账号待管理员审批，请联系学校管理员"
      'disabled' → 403 ACCOUNT_DISABLED  "账号已被禁用"
      'active'   → 签发 JWT { role: 'teacher', phone }
  → 签发前/后写入 teachers.updated_at
```

### 2.4 管理员登录（不变）

```
POST /api/auth/admin-login  { username, password }
  → SELECT admins WHERE username = ?
  → verifyPassword
  → 签发 JWT { role: 'admin', username }
```

### 2.5 自助改密（不变）

```
POST /api/auth/change-password  { old_password, new_password }
  → 支持 student / teacher / admin 三个角色（authController.changePassword 已实现）
  → 改成功后 students.must_reset_password = 0
```

---

## 3. 权限矩阵

### 3.1 端点访问控制总览

| 端点前缀 | 需要登录 | 允许角色 | 说明 |
|----------|---------|---------|------|
| `/api/auth/*` | ❌（登录接口本身） | 公开 | — |
| `/api/public/student/:id` | ❌ | 公开 | 登录前查学生姓名（回显用） |
| `/api/submit` | ✅ | `student` | 学生提交答案（现有） |
| `/api/teacher/*` | ✅ | `teacher` | 教师管自己班级学生 |
| `/api/admin/*` | ✅ | `admin` | 管理员全量管理 |
| `/api/answers/*` | ✅ | `student`（提交）/ `teacher`/`admin`（查询） | 现有 |
| `/api/dashboard/*` | ✅ | `teacher` / `admin` | 现有 |
| `GET /api/students*` | — | — | **废弃并从 server.js 移除** |

### 3.2 教师权限细化（teacherController）

| 能力 | 实现 |
|------|------|
| 列出所教班级学生 | `WHERE class_code IN (所教班级)` |
| 添加学生 | `student_id` 前 6 位必须属于所教班级 |
| 批量添加学生 | 同上，每条独立校验 |
| 更新学生姓名 | 学生 `class_code` 必须属于所教班级 |
| 删除学生 | 同上 |
| 重置学生密码 | 同上 |
| 查看学生完成情况 | 同上 |

**核心校验函数**：`teacherCanManageClass(teacherId, classCode)` — teacherController 通过 `resolveTeacherId(req)` 拿到 `teachers.id`，再调用 authService 中的该函数。

### 3.3 管理员权限（adminController）

所有 CRUD 操作不受 `class_code` 限制，管理员可以：
- 创建/更新/删除任意学生（含指定班级）
- 创建/更新/删除教师（含 class_codes 分配）
- 启用/禁用教师
- 重置学生/教师密码
- 审批 pending 教师

### 3.4 中间件链（不变）

```js
// 示例：教师添加学生
router.post(
  '/teacher/students',
  requireAuthMiddleware,        // 1) 必须有 token
  requireRole('teacher'),       // 2) 必须是教师 + status=active 检查
  teacherController.createStudent,
)

// 示例：管理员创建教师
router.post(
  '/admin/teachers',
  requireAuthMiddleware,
  requireRole('admin'),
  adminController.createTeacher,
)
```

---

## 4. API 端点清单（含增改删）

### 4.1 收紧校验的端点

| 端点 | 文件 | 变更内容 |
|------|------|---------|
| `POST /api/auth/student-login` | authController.js | studentLoginSchema `.length(8)` + 正则 `/^\d{8}$/` |
| `POST /api/auth/teacher-register` | authController.js | teacherRegisterSchema class_codes 正则收紧；创建时 status='pending'；返回不带 token |
| `POST /api/auth/teacher-login` | authController.js | teacherLoginSchema 增加 pending 拒绝逻辑 → 403 ACCOUNT_PENDING |
| `POST /api/teacher/students` | teacherController.js | createStudentSchema batchCreateSchema 学号正则 `/^\d{8}$/`；班级正则收紧 |
| `POST /api/teacher/students/batch` | teacherController.js | 同上 |
| `GET/PUT/DELETE /api/teacher/students/:studentId` | teacherController.js | 无结构变化，权限校验内部依赖 extractClassCode，学号正则收紧 |
| `POST /api/admin/students` | adminController.js | createStudent 学号正则 `/^\d{8}$/`；class_code 正则收紧 |
| `PUT /api/admin/students/:studentId` | adminController.js | updateStudent class_code 正则收紧 |
| `POST /api/admin/teachers` | adminController.js | createTeacher class_codes 正则收紧 |
| `PUT /api/admin/teachers/:phone` | adminController.js | updateTeacher class_codes 正则收紧 |

### 4.2 废弃的旧路由（从 server.js 移除注册）

| 旧端点 | 现状 | 处理 |
|--------|------|------|
| `GET /api/students` | studentController.getStudentList，无 class 权限 | 移除 |
| `GET /api/students/:studentId` | studentController.getStudent，无 class 权限 | 移除 |
| `POST /api/students` | studentController.createStudent，无 class 权限 | 移除 |
| `PUT /api/students/:studentId` | studentController.updateStudent，无 class 权限 | 移除 |
| `DELETE /api/students/:studentId` | studentController.deleteStudent，无 class 权限 | 移除 |

**注意**：`studentController.js` 文件本身暂保留（`getStudentPublicName` 仍在公开路由使用）。仅移除上述 5 个注册。

### 4.3 新增端点

| 端点 | Controller | 方法 | 权限 | 说明 |
|------|-----------|------|------|------|
| `GET /api/admin/teachers?status=pending\|active\|disabled` | adminController.listTeachers | 扩展 | admin | 加 status 查询参数过滤 |
| `POST /api/admin/teachers/:phone/approve` | adminController | 新增 | admin | UPDATE SET status='active' |
| `DELETE /api/admin/teachers/:phone` | adminController.deleteTeacher | 现有 | admin | 同时用于 reject——直接删除 pending 教师 |

### 4.4 修改密码重置逻辑

| 函数 | 当前 | 目标 |
|------|------|------|
| `authService.resetStudentPassword()` | `getDefaultPasswordHash()` → `'123456'` | 同函数，改常量值 → `'99999999'` |
| `authService.resetTeacherPasswordByAdmin()` | 生成 10 位随机密码 + 返回明文 | 改 hash('99999999')，返回 `{ temporary_password: '99999999' }` |
| `DEFAULT_STUDENT_PASSWORD` | `'123456'` | `'99999999'` |
| 新增常量 `DEFAULT_TEACHER_PASSWORD` | 不存在 | `'99999999'` |

---

## 5. 数据清理与迁移

### 5.1 一次性清理脚本

文件：`backend/scripts/cleanup-before-login-redesign.js`（执行后可删除）

脚本（JS，通过 getDefaultPasswordHash() 生成 bcrypt 哈希，不是纯 SQL），执行前带 dry-run 模式先预览影响：

```js
// 伪代码，实际写在 cleanup-before-login-redesign.js 里
const result = await dbRun(`DELETE FROM students WHERE length(student_id) != 8 OR student_id NOT GLOB '[0-9]*'`);
logger.info(`已删除 ${result.changes} 条非 8 位学号的学生记录`);

const newHash = await getDefaultPasswordHash();  // bcrypt hash('99999999')
await dbRun(`UPDATE teachers SET password_hash = ?, updated_at = datetime('now')`, [newHash]);
logger.info('已将所有教师密码重置为 99999999');

// 可选步骤：将现有 active 教师置为 pending
// await dbRun(`UPDATE teachers SET status = 'pending' WHERE status = 'active'`);
// 由人工决定是否开启
```

### 5.2 保留的测试数据

- 测试种子学生：`99999999` / 初始密码 `99999999`（`backend/scripts/add-test-student.js` 和 `database.seedTestStudent()` 同步改密码常量）
- 默认管理员：`admin` / 密码不变（未在范围内）

### 5.3 执行顺序

1. Git push 本 spec 文档
2. 进入实施计划阶段，按计划分分支开发
3. 部署到测试环境后、生产前手动运行清理脚本
4. 生产部署

---

## 6. 前端改动

涉及的改动（量小，归在后端 PR 中统一提交）：

| 文件 | 改动 |
|------|------|
| `src/services/studentService.ts` | 学号校验 `.min(4)` → `.length(8)` + 正则 `/^\d{8}$/` |
| `src/components/StudentFormModal.vue` | 学号表单校验同步收紧 + 提示文案更新（"请输入 8 位学号"） |
| 教师注册页面（如有） | class_codes 正则收紧 + 提示文案 |
| `src/stores/auth.ts` | 登录后处理新的错误码：`ACCOUNT_PENDING` → 提示"账号待审批" |

---

## 7. 风险与回滚

| 风险 | 缓解 |
|------|------|
| 清理脚本误删生产数据 | 上线前先在测试服务器跑一遍清理脚本，确认影响范围；清理脚本带 `dry-run` 选项 |
| 旧前端/外部脚本调用废弃路由 | 部署时保留 studentController.js 一段时间（文件不删），但 server.js 移除路由注册；观察 access log 如 404 再处理 |
| 管理员忘记审批导致教师无法登录 | adminController.listTeachers 默认返回全部，加 status=pending 筛选按钮在管理后台首页醒目标出待审批数量 |
| 测试学生密码变更 | 同步修改 `seedTestStudent()` 和 `add-test-student.js` |

**回滚方案**：由于改动集中在应用层校验与常量，数据库无 schema 变更。回滚即回退代码版本 + 手动恢复 DEFAULT_STUDENT_PASSWORD 值。
