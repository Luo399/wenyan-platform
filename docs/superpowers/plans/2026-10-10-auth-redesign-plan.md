# 登录系统三层角色实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现管理员-教师-学生三层角色模型收紧，学号严格 8 位，班级严格 6 位，密码统一 99999999，教师注册走审批制（pending → active），废弃无权限旧路由。

**Architecture:** 就地修补方案——在现有三张用户表（admins/teachers/students）+ JWT + requireRole 架构上做最小必要改动，不触及骨架。改动集中在：authService 常量和密码重置逻辑、authService.extractClassCode 加 8 位学号前置断言、各 controller zod schema 校验收紧、teacherRegister 改写 pending、teacherLogin 加 pending 拒绝、adminController 新增 approve 端点、server.js 移除旧路由注册。

**Tech Stack:** Node.js + Express + SQLite (better-sqlite3) + JWT (jsonwebtoken) + bcryptjs + Zod + Jest (supertest)

**Spec:** [2026-10-10-auth-redesign-spec.md](../specs/2026-10-10-auth-redesign-spec.md)

---

## 文件变更总览

| # | 文件 | 操作 | 职责 |
|---|------|------|------|
| 1 | `backend/src/services/authService.js` | 修改 | 密码常量改值、resetTeacherPasswordByAdmin 改逻辑 |
| 2 | `backend/tests/auth-service.test.js` | 修改 | 同步密码常量期望值为 99999999 |
| 3 | `backend/src/controllers/authController.js` | 修改 | 学号 8 位正则、班级 6 位正则、teacherRegister 写 pending、teacherLogin 拒绝 pending |
| 4 | `backend/src/controllers/teacherController.js` | 修改 | zod schema 学号/班级正则收紧 |
| 5 | `backend/src/controllers/adminController.js` | 修改 | 学号/班级正则收紧、listTeachers 加 status 过滤、新增 approve 端点 |
| 6 | `backend/src/routes/index.js` | 修改 | 废弃 5 个旧 `/api/students/*` 路由、新增 approve 路由 |
| 7 | `backend/src/config/database.js` | 修改 | seedTestStudent 密码同步为 99999999 |
| 8 | `backend/scripts/add-test-student.js` | 修改 | 测试学生密码同步为 99999999 |
| 9 | `src/services/studentService.ts` | 修改 | 学号校验收紧 |
| 10 | `src/components/StudentFormModal.vue` | 修改 | 学号表单校验收紧 |
| 11 | `src/stores/auth.ts` | 修改 | 登录后处理 ACCOUNT_PENDING 错误码 |
| 12 | `backend/scripts/cleanup-before-login-redesign.js` | 新建 | 一次性清理脚本（dry-run 可选） |

---

### Task 1: 密码常量修改 + authService 重构

**Files:**
- Modify: `backend/src/services/authService.js`
- Modify: `backend/tests/auth-service.test.js`

- [ ] **Step 1: 写/改测试——先让它失败**

修改 `backend/tests/auth-service.test.js` 中的密码常量测试：

```js
// 改前
test('默认学生初始密码应为 123456', () => {
  expect(DEFAULT_STUDENT_PASSWORD).toBe('123456')
})

// 改后
test('默认学生初始密码应为 99999999', () => {
  expect(DEFAULT_STUDENT_PASSWORD).toBe('99999999')
})
test('默认教师初始密码应为 99999999', () => {
  const { DEFAULT_TEACHER_PASSWORD } = require('../src/services/authService')
  expect(DEFAULT_TEACHER_PASSWORD).toBe('99999999')
})
```

同时更新 auth-service.test.js 第 9 行注释：
```
// 覆盖：
//  5. 默认密码 "99999999" 经哈希后能通过 verifyPassword
```

找到文件中 `verifyPassword(getDefaultPasswordHash(), ...)` 相关测试（搜索 `默认密码`），把期望值也同步为 99999999。

- [ ] **Step 2: 运行测试确认它失败**

```powershell
cd d:\wenyanplatform\backend; C:\Users\19\AppData\Roaming\TRAE` SOLO` CN\ModularData\ai-agent\vm\tools\node\npm.cmd test -- auth-service.test.js
```

预期：FAIL，`expected '123456' to be '99999999'`

- [ ] **Step 3: 修改 authService.js 密码常量**

在 `backend/src/services/authService.js`：

```js
// 改前（L11）
const DEFAULT_STUDENT_PASSWORD = '123456'

// 改后
const DEFAULT_STUDENT_PASSWORD = '99999999'  // 学生初始/重置密码
const DEFAULT_TEACHER_PASSWORD  = '99999999'  // 教师重置密码
```

- [ ] **Step 4: 重写 resetTeacherPasswordByAdmin**

在 `backend/src/services/authService.js`，找到 `resetTeacherPasswordByAdmin` 函数（L112-L128），改前：

```js
async function resetTeacherPasswordByAdmin(phone, resetByAdmin) {
  const temporaryPassword = generateTemporaryPassword(10)
  const newHash = await hashPassword(temporaryPassword)
  ...
  return { success: true, temporaryPassword }
}
```

改后：

```js
async function resetTeacherPasswordByAdmin(phone, resetByAdmin) {
  const newHash = await hashPassword(DEFAULT_TEACHER_PASSWORD)
  const now = new Date().toISOString()
  const info = await run(
    `UPDATE teachers
        SET password_hash = ?,
            updated_at = ?
      WHERE phone = ?`,
    [newHash, now, phone],
  )
  if (!info || info.changes === 0) {
    return { success: false, reason: 'TEACHER_NOT_FOUND' }
  }
  await recordPasswordReset('teacher', phone, 'admin', resetByAdmin)
  return { success: true, temporaryPassword: DEFAULT_TEACHER_PASSWORD }
}
```

- [ ] **Step 5: 更新 module.exports**

在 `module.exports` 中新增导出 DEFAULT_TEACHER_PASSWORD：

```js
module.exports = {
  DEFAULT_STUDENT_PASSWORD,
  DEFAULT_TEACHER_PASSWORD,   // ← 新增
  BCRYPT_ROUNDS,
  ...
}
```

- [ ] **Step 6: 运行测试确认它通过**

```powershell
cd d:\wenyanplatform\backend; C:\Users\19\AppData\Roaming\TRAE` SOLO` CN\ModularData\ai-agent\vm\tools\node\npm.cmd test -- auth-service.test.js
```

预期：全部 PASS

- [ ] **Step 7: commit**

```powershell
cd d:\wenyanplatform; git add backend/src/services/authService.js backend/tests/auth-service.test.js; git commit -m "refactor(auth): unify default password to 99999999 for students and teachers"
```

---

### Task 2: 学号 8 位 + 班级 6 位正则收紧（controller 层）

**Files:**
- Modify: `backend/src/controllers/authController.js`
- Modify: `backend/src/controllers/teacherController.js`
- Modify: `backend/src/controllers/adminController.js`

- [ ] **Step 1: authController.js — studentLoginSchema 学号收紧**

找到 authController.js L23-L29：

```js
// 改前
const studentLoginSchema = z.object({
  student_id: z
    .string()
    .regex(/^\d+$/, '学号必须为纯数字')
    .min(4, '学号长度不能少于 4 位'),
  password: z.string().min(1, '密码必填'),
})

// 改后
const studentLoginSchema = z.object({
  student_id: z
    .string()
    .regex(/^\d{8}$/, '学号必须为 8 位纯数字（格式 YYYYNNNN）'),
  password: z.string().min(1, '密码必填'),
})
```

- [ ] **Step 2: authController.js — teacherRegisterSchema class_codes 收紧**

找到 L31-L39：

```js
// 改前
const teacherRegisterSchema = z.object({
  ...
  class_codes: z
    .array(z.string().regex(/^\d{6}$/, '班级编码必须为 6 位数字'))
    .min(1, '至少选择一个所教班级'),
})

// 改后
const CLASS_CODE_REGEX = /^\d{4}(0[1-9]|[1-2]\d|3[0-1])$/

const teacherRegisterSchema = z.object({
  ...
  class_codes: z
    .array(z.string().regex(CLASS_CODE_REGEX, '班级编码必须为 6 位数字（格式 YYYYCC，CC 范围 01-31）'))
    .min(1, '至少选择一个所教班级'),
})
```

把 `CLASS_CODE_REGEX` 常量放在文件顶部 zod 导入后，供本文件多处复用。

- [ ] **Step 3: teacherController.js — createStudentSchema 学号收紧**

找到 L18-L24：

```js
// 改前
const createStudentSchema = z.object({
  student_id: z
    .string()
    .regex(/^\d+$/, '学号必须为纯数字')
    .min(6, '学号长度至少为 6 位'),
  student_name: z.string().min(1, '姓名必填').max(20, '姓名不能超过 20 字符'),
})

// 改后
const STUDENT_ID_REGEX = /^\d{8}$/

const createStudentSchema = z.object({
  student_id: z
    .string()
    .regex(STUDENT_ID_REGEX, '学号必须为 8 位纯数字（格式 YYYYNNNN）'),
  student_name: z.string().min(1, '姓名必填').max(20, '姓名不能超过 20 字符'),
})
```

- [ ] **Step 4: teacherController.js — batchCreateSchema 同步收紧**

找到 L30-L38，把内部正则替换为复用同一个 STUDENT_ID_REGEX：

```js
const batchCreateSchema = z.array(
  z.object({
    student_id: z
      .string()
      .regex(STUDENT_ID_REGEX, '学号必须为 8 位纯数字（格式 YYYYNNNN）'),
    student_name: z.string().min(1, '姓名必填').max(20, '姓名不能超过 20 字符'),
  }),
)
```

- [ ] **Step 5: adminController.js — createStudent / updateStudent 正则收紧**

找到 adminController.createStudent 中 (L406)：

```js
// 改前
if (!student_id || typeof student_id !== 'string' || !/^\d+$/.test(student_id) || student_id.length < 6) {
  return res.status(400).json({ ..., message: '学号必须为至少 6 位纯数字' })
}

// 改后
if (!student_id || typeof student_id !== 'string' || !/^\d{8}$/.test(student_id)) {
  return res.status(400).json({ success: false, error: 'INVALID_STUDENT_ID', message: '学号必须为 8 位纯数字（格式 YYYYNNNN）' })
}
```

同文件 createStudent 的 class_code 校验 (L413) 同步收紧：

```js
// 改前
if (!/^\d{6}$/.test(String(finalClassCode))) { ... }

// 改后
if (!/^\d{4}(0[1-9]|[1-2]\d|3[0-1])$/.test(String(finalClassCode))) { ... }
```

adminController.updateStudent 的 class_code 校验 (L460) 同步收紧：

```js
// 改前
if (class_code !== undefined && !/^\d{6}$/.test(String(class_code))) { ... }

// 改后
if (class_code !== undefined && !/^\d{4}(0[1-9]|[1-2]\d|3[0-1])$/.test(String(class_code))) { ... }
```

- [ ] **Step 6: adminController.js — createTeacher / updateTeacher class_codes 正则收紧**

createTeacher (L212-L216)：

```js
// 改前
for (const cc of class_codes) {
  if (!/^\d{6}$/.test(cc)) {
    return res.status(400).json({ ..., message: `班级编码 ${cc} 不是 6 位数字` })
  }
}

// 改后
for (const cc of class_codes) {
  if (!/^\d{4}(0[1-9]|[1-2]\d|3[0-1])$/.test(cc)) {
    return res.status(400).json({ success: false, error: 'INVALID_CLASS_CODE', message: `班级编码 ${cc} 不是有效 6 位数字（格式 YYYYCC，CC 范围 01-31）` })
  }
}
```

updateTeacher (L320-L324) 同上改。

- [ ] **Step 7: 运行后端完整测试套件**

```powershell
cd d:\wenyanplatform\backend; C:\Users\19\AppData\Roaming\TRAE` SOLO` CN\ModularData\ai-agent\vm\tools\node\npm.cmd test
```

预期：全部 PASS（如有因为正则收紧导致测试用例里的学号/班级不合法——那是测试里用了非 8 位的假数据，需要把测试里的 student_id 改成 8 位）

- [ ] **Step 8: commit**

```powershell
cd d:\wenyanplatform; git add backend/src/controllers/authController.js backend/src/controllers/teacherController.js backend/src/controllers/adminController.js; git commit -m "refactor(auth): tighten student_id to 8 digits and class_code to 6 digits with CC range 01-31"
```

---

### Task 3: 教师注册改 pending + 登录加 pending 拒绝

**Files:**
- Modify: `backend/src/controllers/authController.js`

- [ ] **Step 1: teacherRegister 改写 pending 且不带 token 返回**

找到 authController.teacherRegister（L103-L177），核心改动：

```js
// 在 teacherRegister 内，改：
// 改前（L133）：`INSERT INTO teachers ... VALUES (?, ?, ?, ?, 'active', ?, ?)`
// 改后：
const result = await dbRun(
  `INSERT INTO teachers (phone, name, school_id, password_hash, status, must_reset_password, created_at, updated_at)
   VALUES (?, ?, ?, ?, 'pending', 0, ?, ?)`,
  [body.phone, body.name, body.school_id, passwordHash, now, now],
)

// 改前（L157-L173）：注册成功直接返回 token
// 改后：
res.status(201).json({
  success: true,
  message: '注册成功，等待管理员审批',
  data: {
    pending: true,
  },
})
// ← 不再签发 token，也不在响应里返回 user
```

注意：教师自设密码，所以 must_reset_password = 0（和管理员重置教师密码强制改密不同）。

- [ ] **Step 2: teacherLogin 加 pending 拒绝**

找到 authController.teacherLogin（L179-L238），在验证完密码后、检查 status 处新增：

```js
// 改前
if (teacher.status !== 'active') {
  return res.status(403).json({
    success: false,
    error: 'ACCOUNT_DISABLED',
    message: '账号已被禁用',
  })
}

// 改后
if (teacher.status === 'pending') {
  return res.status(403).json({
    success: false,
    error: 'ACCOUNT_PENDING',
    message: '账号待管理员审批，请联系学校管理员',
  })
}
if (teacher.status !== 'active') {
  return res.status(403).json({
    success: false,
    error: 'ACCOUNT_DISABLED',
    message: '账号已被禁用',
  })
}
```

- [ ] **Step 3: 更新后端 teacher-students.test.js 测试——admin 手工创建的教师默认 active**

检查测试中创建教师的路径（通过 admin 后台 `POST /api/admin/teachers` 创建）。adminController.createTeacher 里写入 status='active'（不变），所以 admin 创建的教师可以直接登录。而公开注册的教师是 pending。测试里应加一条：

```js
// 在 teacher-students.test.js 里新增一个 describe 块
describe('教师审批流程', () => {
  test('公开注册教师后 status=pending 不能登录', async () => {
    await request(app).post('/api/auth/teacher/register').send({
      phone: 'pending99',
      name: '待审批教师',
      school_id: 1,
      password: 'password123',
      class_codes: ['202403'],
    })
    const res = await request(app).post('/api/auth/teacher/login').send({
      phone: 'pending99', password: 'password123',
    })
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('ACCOUNT_PENDING')
  })
})
```

- [ ] **Step 4: 运行测试**

```powershell
cd d:\wenyanplatform\backend; C:\Users\19\AppData\Roaming\TRAE` SOLO` CN\ModularData\ai-agent\vm\tools\node\npm.cmd test
```

预期：全部 PASS。注意现有测试里创建教师时如果用了 admin 后台，status 仍然是 'active'，不受影响。

- [ ] **Step 5: commit**

```powershell
cd d:\wenyanplatform; git add backend/src/controllers/authController.js; git commit -m "feat(auth): teacher self-register writes status=pending, teacherLogin rejects pending accounts"
```

---

### Task 4: 管理员审批新端点 + listTeachers 状态过滤

**Files:**
- Modify: `backend/src/controllers/adminController.js`

- [ ] **Step 1: listTeachers 加 status 查询参数过滤**

找到 adminController.listTeachers（L19-L40）：

```js
// 改前：无条件返回所有教师
async function listTeachers(req, res) {
  try {
    const teachers = await dbAll(db, `SELECT t.id, t.phone, ...`)
    ...
  }
}

// 改后：支持 ?status=pending|active|disabled
async function listTeachers(req, res) {
  try {
    const { status } = req.query
    const conditions = []
    const params = []
    if (status) {
      if (!['pending', 'active', 'disabled'].includes(status)) {
        return res.status(400).json({ success: false, error: 'INVALID_STATUS', message: 'status 只能是 pending/active/disabled' })
      }
      conditions.push('t.status = ?')
      params.push(status)
    }
    let sql = `SELECT t.id, t.phone, t.name, t.school_id, t.status,
      t.created_at, s.name AS school_name
      FROM teachers t
      LEFT JOIN schools s ON s.id = t.school_id`
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }
    sql += ' ORDER BY t.created_at DESC'
    const teachers = await dbAll(db, sql, params)
    for (const t of teachers) {
      const classes = await dbAll(db,
        `SELECT class_code FROM teacher_classes WHERE teacher_id = ?`, [t.id])
      t.class_codes = classes.map((c) => c.class_code)
    }
    res.status(200).json({ success: true, data: teachers })
  } catch (err) {
    logger.error('[admin] 查教师列表失败:', err)
    res.status(500).json({ success: false, error: 'DATABASE_ERROR', message: '查询失败' })
  }
}
```

- [ ] **Step 2: 新增 approveTeacher 函数**

在 adminController.js 里新增：

```js
async function approveTeacher(req, res) {
  try {
    const { phone } = req.params
    const teacher = await dbGet(db, `SELECT id, status FROM teachers WHERE phone = ?`, [phone])
    if (!teacher) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: '教师不存在' })
    }
    if (teacher.status === 'active') {
      return res.status(400).json({ success: false, error: 'ALREADY_ACTIVE', message: '该教师已激活' })
    }
    await dbRun(db,
      `UPDATE teachers SET status = 'active', updated_at = ? WHERE phone = ?`,
      [new Date().toISOString(), phone])
    res.status(200).json({ success: true, message: '教师已审批通过' })
  } catch (err) {
    logger.error('[admin] 审批教师失败:', err)
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: '审批失败' })
  }
}
```

- [ ] **Step 3: 新增 resetTeacher 改调用**

找到现有的 resetTeacher（L107-L125），里面已经调的是 `resetTeacherPasswordByAdmin`，Task 1 里改了那个函数，这里不需要改调用代码。但把成功消息改一下：

```js
// 改前
message: '教师密码已重置，请将临时密码告知教师，首次登录后可自助改密'
// 改后（密码不再随机生成，固定 99999999）
message: '教师密码已重置为 99999999'
```

- [ ] **Step 4: 更新 module.exports**

```js
module.exports = {
  listTeachers,
  getTeacher,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  approveTeacher,           // ← 新增
  setTeacherStatus,
  listStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  resetStudent,
  resetTeacher,
  listPasswordResets,
}
```

- [ ] **Step 5: 运行测试确认通过**

```powershell
cd d:\wenyanplatform\backend; C:\Users\19\AppData\Roaming\TRAE` SOLO` CN\ModularData\ai-agent\vm\tools\node\npm.cmd test
```

- [ ] **Step 6: commit**

```powershell
cd d:\wenyanplatform; git add backend/src/controllers/adminController.js; git commit -m "feat(admin): add teacher approve endpoint and status filter on listTeachers"
```

---

### Task 5: server.js 路由废弃 + 新增

**Files:**
- Modify: `backend/src/routes/index.js`

- [ ] **Step 1: 废弃 5 个旧路由注册**

在 routes/index.js L139-L144，找到：

```js
// 改前
const legacyStudentAuth = [requireAuthMiddleware, requireRole(['teacher', 'admin'])]
app.get('/api/students', ...legacyStudentAuth, studentController.getStudentList)
app.get('/api/students/:studentId', ...legacyStudentAuth, studentController.getStudent)
app.post('/api/students', ...legacyStudentAuth, studentController.createStudent)
app.put('/api/students/:studentId', ...legacyStudentAuth, studentController.updateStudent)
app.delete('/api/students/:studentId', ...legacyStudentAuth, studentController.deleteStudent)
```

整段注释掉或删除（保留 `app.get('/api/students/:studentId/name', ...)` 不动——那是登录页公开回显）：

```js
// 改后：删除 L139-L144 这 5 行路由注册
// 旧 /api/students/* 路由已废弃，统一走 /api/teacher/students 和 /api/admin/students
```

同时更新 home 路径的 endpoints 列表（L56-L59），把旧的学生路由描述删或注释掉。

- [ ] **Step 2: 新增 approve 路由注册**

在 admin 路由块（L132 附近），在 `app.post('/api/admin/teachers', ...)` 之后新增：

```js
// 教师审批
app.post('/api/admin/teachers/:phone/approve', ...adminAuth, adminController.approveTeacher)
```

- [ ] **Step 3: 运行测试确认通过**

```powershell
cd d:\wenyanplatform\backend; C:\Users\19\AppData\Roaming\TRAE` SOLO` CN\ModularData\ai-agent\vm\tools\node\npm.cmd test
```

- [ ] **Step 4: commit**

```powershell
cd d:\wenyanplatform; git add backend/src/routes/index.js; git commit -m "refactor(routes): remove legacy /api/students/* routes, add teacher approve route"
```

---

### Task 6: 种子数据同步改密码

**Files:**
- Modify: `backend/src/config/database.js`（seedTestStudent）
- Modify: `backend/scripts/add-test-student.js`

- [ ] **Step 1: 修改 database.js seedTestStudent**

找到 `database.js` 中的 `seedTestStudent` 函数（搜索 "99999999" 或 "testStudent"），把插入记录里的密码哈希改成 `DEFAULT_STUDENT_PASSWORD` 对应的 bcrypt hash，或者改成用 `hashPassword` 动态生成（确保和 authService 的 DEFAULT 常量一致）。

具体改法：找到 seedTestStudent 里写死密码的地方，确保用 `await hashPassword('99999999')`。

- [ ] **Step 2: 修改 add-test-student.js**

同样找到写死密码的地方，改成 99999999 或复用 DEFAULT_STUDENT_PASSWORD 常量。

- [ ] **Step 3: 运行测试确认通过**

```powershell
cd d:\wenyanplatform\backend; C:\Users\19\AppData\Roaming\TRAE` SOLO` CN\ModularData\ai-agent\vm\tools\node\npm.cmd test -- database.test.js seed-production.test.js
```

- [ ] **Step 4: commit**

```powershell
cd d:\wenyanplatform; git add backend/src/config/database.js backend/scripts/add-test-student.js; git commit -m "chore(seed): sync test student password to 99999999"
```

---

### Task 7: 前端校验收紧

**Files:**
- Modify: `src/services/studentService.ts`
- Modify: `src/components/StudentFormModal.vue`
- Modify: `src/stores/auth.ts`

- [ ] **Step 1: studentService.ts — 学号校验**

找到学号校验函数，改前类似：

```ts
// 改前
export function validateStudentId(id: string): string | null {
  if (!id) return '学号不能为空'
  if (!/^\d+$/.test(id)) return '学号必须为纯数字'
  if (id.length < 4) return '学号长度不能少于 4 位'
  return null
}

// 改后
export function validateStudentId(id: string): string | null {
  if (!id) return '学号不能为空'
  if (!/^\d{8}$/.test(id)) return '学号必须为 8 位纯数字（格式 YYYYNNNN）'
  return null
}
```

- [ ] **Step 2: StudentFormModal.vue — 表单校验**

找到学号输入框的校验规则（Vee-Validate、Element-Plus rules 或内联校验函数），同步收紧到 8 位纯数字，提示文案改成"请输入 8 位学号"。

- [ ] **Step 3: auth.ts — 登录后处理 ACCOUNT_PENDING**

找到 auth.ts 中 teacher login 的错误处理分支，新增：

```ts
// 在 teacher login 的 catch/if 分支里
if (error?.response?.data?.error === 'ACCOUNT_PENDING') {
  ElMessage.warning('账号待管理员审批，请联系学校管理员')
  return
}
```

- [ ] **Step 4: 运行 type-check 确认通过**

```powershell
cd d:\wenyanplatform; C:\Users\19\AppData\Roaming\TRAE` SOLO` CN\ModularData\ai-agent\vm\tools\node\npx.cmd vue-tsc --noEmit -p tsconfig.json
```

- [ ] **Step 5: 运行 eslint**

```powershell
cd d:\wenyanplatform; C:\Users\19\AppData\Roaming\TRAE` SOLO` CN\ModularData\ai-agent\vm\tools\node\npx.cmd eslint src/services/studentService.ts src/components/StudentFormModal.vue src/stores/auth.ts
```

- [ ] **Step 6: commit**

```powershell
cd d:\wenyanplatform; git add src/services/studentService.ts src/components/StudentFormModal.vue src/stores/auth.ts; git commit -m "refactor(frontend): tighten student_id validation to 8 digits and handle ACCOUNT_PENDING error"
```

---

### Task 8: 一次性清理脚本

**Files:**
- Create: `backend/scripts/cleanup-before-login-redesign.js`

- [ ] **Step 1: 写清理脚本**

新建文件，内容如下：

```js
/**
 * 登录系统三层角色切换前的数据清理脚本
 *
 * 作用：
 *   1. 预览/删除所有不符合 8 位格式的学生记录
 *   2. 重置所有教师密码为 99999999
 *
 * 用法：
 *   NODE_ENV=production node cleanup-before-login-redesign.js --dry-run
 *   NODE_ENV=production node cleanup-before-login-redesign.js --execute
 */

process.env.DB_PATH = process.env.DB_PATH || process.argv.includes('--prod')
  ? '/path/to/production.db'   // 实际部署时填入生产 DB 路径
  : ':memory:'

const { db, initAllTables } = require('../src/config/database')
const { dbRun, dbAll } = require('../src/utils/dbPromise')
const {
  getDefaultPasswordHash,
  DEFAULT_TEACHER_PASSWORD,
} = require('../src/services/authService')

async function main() {
  const isDryRun = !process.argv.includes('--execute')
  await initAllTables()

  // 1. 预览不符合 8 位学号的学生
  const badStudents = await dbAll(db,
    `SELECT student_id, student_name, class_code FROM students
     WHERE length(student_id) != 8 OR student_id NOT GLOB '[0-9]*'`)
  console.log(`\n[清理预览] 不符合 8 位学号的学生：${badStudents.length} 条`)
  badStudents.forEach(s => console.log(`  - ${s.student_id} ${s.student_name} ${s.class_code}`))

  if (isDryRun) {
    console.log('\n[DRY RUN] 未做任何修改。加 --execute 来真正执行。')
    await new Promise(r => setTimeout(r, 200))
    process.exit(0)
  }

  // 2. 真正删除
  if (badStudents.length > 0) {
    const r = await dbRun(db,
      `DELETE FROM students WHERE length(student_id) != 8 OR student_id NOT GLOB '[0-9]*'`)
    console.log(`[执行] 已删除 ${r.changes} 条非 8 位学号的学生`)
  }

  // 3. 重置教师密码
  const teacherCount = await dbAll(db, `SELECT COUNT(*) AS c FROM teachers`)
  const newHash = await getDefaultPasswordHash()
  await dbRun(db,
    `UPDATE teachers SET password_hash = ?, updated_at = datetime('now')`,
    [newHash])
  console.log(`[执行] 已将 ${teacherCount[0].c} 位教师密码重置为 ${DEFAULT_TEACHER_PASSWORD}`)

  console.log('\n清理完成。')
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
```

- [ ] **Step 2: 在测试服务器上 dry-run**

```powershell
cd d:\wenyanplatform\backend; node scripts/cleanup-before-login-redesign.js --dry-run
```

预期：打印不符合 8 位学号的学生条数。dry-run 模式下不做任何修改。

- [ ] **Step 3: 确认影响范围后，在生产上执行（手动，非自动化）**

```powershell
cd d:\wenyanplatform\backend; node scripts/cleanup-before-login-redesign.js --execute
```

（此步由人工在服务器上执行，不在 CI 里自动跑）

- [ ] **Step 4: commit**

```powershell
cd d:\wenyanplatform; git add backend/scripts/cleanup-before-login-redesign.js; git commit -m "chore(scripts): add one-time cleanup script before auth redesign deploy"
```

---

## 执行顺序

```
Task 1 (密码常量) → Task 2 (正则收紧) → Task 3 (教师审批) → Task 4 (admin 端点) → Task 5 (路由)
  ↓
Task 6 (种子数据) + Task 7 (前端)  ← 可并行
  ↓
Task 8 (清理脚本)  ← 部署前手动
```

Task 1-5 必须按顺序（有依赖），Task 6-7 互不依赖可并行开发。Task 8 是部署前才手动执行的脚本。

## CI 通过标准

- `npm test`（backend）全部 PASS
- `vue-tsc --noEmit` 无类型错误
- `eslint` 无新增 error
- Git push 到 `feature-1` 后 GitHub Actions CI Checks 全部 green
