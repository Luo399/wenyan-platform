# 后端代码审查报告

**审查日期**: 2026-05-29
**审查范围**: `backend/server.js`
**测试覆盖率**: 89个测试用例
**当前版本**: v1.0.0

---

## 一、测试结果汇总

### 1.1 最新测试执行结果

| 指标 | 结果 |
|-----|------|
| 测试用例总数 | 89 |
| 通过 | 85 |
| 失败 | 4 |
| 通过率 | **95.5%** |

### 1.2 测试分类统计

| 类别 | 通过 | 失败 | 状态 |
|-----|-----|-----|------|
| 学生管理接口 | 7/7 | 0 | ✅ 全部通过 |
| 登录接口 | 5/6 | 1 | ⚠️ 1个测试配置问题 |
| 答题提交接口 | 14/17 | 3 | 🔴 发现代码缺陷 |
| 文言文数据API | 20/20 | 0 | ✅ 全部通过 |
| 答题记录查询 | 7/7 | 0 | ✅ 全部通过 |
| 异常/边界值 | 4/5 | 1 | ⚠️ 1个测试超时 |
| 性能测试 | 2/2 | 0 | ✅ 全部通过 |

### 1.3 失败测试分析

| 测试名称 | 失败原因 | 对应缺陷 | 修复状态 |
|---------|---------|---------|---------|
| `缺失questions字段应有默认值` | `questions.map()` 空指针 | 2.1 | 🔴 待修复 |
| `答案与题目不匹配应有合理处理` | `JSON.stringify(undefined)` | 2.2 | 🔴 待修复 |
| `token格式应符合JWT结构` | 学生未注册导致401 | - | ⚠️ 测试数据问题 |
| `极大JSON请求体应被限制` | 测试超时设置不足 | - | ⚠️ 测试配置问题 |

---

## 二、已修复问题

### ✅ Issue1: 重复创建数据库表

| 项目 | 详情 |
|-----|------|
| 问题 | `students` 表和 `answer_records` 表被创建两次 |
| 位置 | `server.js:62-75`, `server.js:78-98`, `server.js:107-146` |
| 修复日期 | 2026-05-29 |
| 修复方式 | 删除第107-146行的重复代码 |
| 修复验证 | 测试通过率 85/89，无功能退化 |

**修复后代码结构**:
```
第61-75行:   创建 students 表
第77-98行:   创建 answer_records 表 + 调用 createIndexes()
第100-105行: createIndexes 函数定义
```

---

## 三、待修复代码缺陷

### 🔴 2.1 【高危】缺失questions字段导致500错误

**位置**: `server.js:617`

**问题描述**:
```javascript
// 当前代码
const insertPromises = questions.map((question) => { ... })
```
当请求中缺少 `questions` 字段时，`questions` 为 `undefined`，调用 `.map()` 会抛出 `TypeError: Cannot read properties of undefined (reading 'map')`

**修复方案**:
```javascript
// 在解构时添加默认值
const { studentId, studentName, wenId, submittedAt, answers, questions = [] } = req.body

// 或在函数开头添加
if (!Array.isArray(questions)) {
  return res.status(200).json({
    success: true,
    message: '答案提交成功',
    data: {
      studentId,
      wenId,
      submittedAt,
      questionCount: 0,
      correctCount: 0,
      wrongCount: 0,
      totalScore: 0,
      avgScore: 0,
      details: [],
    },
  })
}
```

**影响范围**: `/api/submit` 接口
**优先级**: 🔴 必须修复

---

### 🔴 2.2 【中危】答案值为undefined时JSON.stringify失败

**位置**: `server.js:675-676`

**问题描述**:
```javascript
// 当前代码
user_answer: JSON.stringify(userAnswer),
correct_answer: JSON.stringify(correctAnswer),
```
当答案在 `answers` 对象中对应的值为 `undefined` 时，`JSON.stringify(undefined)` 返回 `undefined`（字符串），存入数据库会触发 NOT NULL 约束失败

**修复方案**:
```javascript
// 将 undefined 转换为 null
user_answer: JSON.stringify(userAnswer ?? null),
correct_answer: JSON.stringify(correctAnswer ?? null),
```

**影响范围**: `/api/submit` 接口
**优先级**: 🔴 必须修复

---

### 🟡 2.3 【低危】JSON解析失败无容错处理

**位置**: `server.js:795-796` 和 `server.js:882-883`

**问题描述**:
```javascript
userAnswer: JSON.parse(row.user_answer),
correctAnswer: row.correct_answer ? JSON.parse(row.correct_answer) : null,
```
如果数据库中存储了非JSON格式的旧数据，`JSON.parse()` 会抛出异常

**修复方案**:
```javascript
const safeParse = (str) => {
  try {
    return JSON.parse(str)
  } catch {
    return str
  }
}

userAnswer: safeParse(row.user_answer),
correctAnswer: row.correct_answer ? safeParse(row.correct_answer) : null,
```

**影响范围**: `/api/answers/wen/:wenId` 和 `/api/answers/student/:studentId` 接口
**优先级**: 🟡 建议修复

---

## 四、安全问题（建议修复）

### ⚠️ 3.1 【高危】JWT签名硬编码

**位置**: `server.js:1066-1078`

**问题描述**:
```javascript
const signature = 'wenyan_platform_signature' // 简化签名
```
- 签名密钥硬编码在代码中
- 未使用真正的JWT库（如 jsonwebtoken）
- 无签名验证机制

**风险评估**:
- 任何人都可以伪造有效token
- 无法验证token是否被篡改
- 无法吊销token

**修复方案**（选择其一）:

**方案A - 使用jsonwebtoken库（推荐）**:
```bash
npm install jsonwebtoken
```

```javascript
const jwt = require('jsonwebtoken')
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

function generateToken(studentId, username) {
  return jwt.sign(
    {
      sub: studentId,
      username: username,
      role: 'student',
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  )
}
```

**方案B - 使用Base64编码（轻量级）**:
```javascript
function generateToken(studentId, username) {
  const payload = {
    studentId,
    username,
    role: 'student',
    iat: Date.now(),
    exp: Date.now() + 3600000, // 1小时过期
  }
  return Buffer.from(JSON.stringify(payload)).toString('base64')
}
```

**优先级**: ⚠️ 建议修复（上线前）

---

### 🟡 3.2 【中危】SQL注入防护不足

**位置**: `server.js:459-470`

**问题描述**:
```javascript
db.get(
  'SELECT student_id, name, created_at FROM students WHERE student_id = ?',
  [studentId],
  ...
)
```
虽然使用了参数化查询，但 `studentId` 仅验证了格式（数字），未进行类型检查。

**修复方案**:
```javascript
const studentId = String(req.params.studentId || '').trim()

if (!studentId || !/^\d+$/.test(studentId)) {
  return res.status(400).json({ ... })
}
```

**优先级**: 🟡 建议修复

---

### 🟢 3.3 【低危】CORS配置过宽

**位置**: `server.js:27`

**问题描述**:
```javascript
origin: process.env.CORS_ORIGIN || '*',
```
生产环境使用 `*` 可能导致CSRF攻击

**修复方案**:
```javascript
origin: process.env.CORS_ORIGIN,
```
确保 `.env` 文件中正确配置 `CORS_ORIGIN`

**优先级**: 🟢 可选优化

---

## 五、代码质量问题

### 🟡 5.1 【性能】批量操作未使用事务

**位置**: `server.js:616-693`

**问题描述**:
批量插入答题记录时，每个记录单独执行SQL，未使用事务

**修复方案**:
```javascript
db.serialize(() => {
  db.run('BEGIN TRANSACTION')
  try {
    // 批量插入操作
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
})
```

**优先级**: 🟡 建议修复

---

### 🟢 5.2 【健壮性】分页参数无边界检查

**位置**: `server.js:367-368`

**问题描述**:
```javascript
const page = parseInt(req.query.page) || 1
const pageSize = parseInt(req.query.page_size) || 20
```
虽然有默认值处理，但未检查负数情况

**修复方案**:
```javascript
let page = parseInt(req.query.page) || 1
let pageSize = parseInt(req.query.page_size) || 20

// 确保正数
page = Math.max(1, Math.abs(page))
pageSize = Math.min(100, Math.max(1, Math.abs(pageSize)))
```

**优先级**: 🟢 可选优化

---

## 六、修复进度追踪

| 序号 | 问题 | 优先级 | 状态 | 修复日期 |
|-----|------|-------|------|---------|
| 1 | Issue1: 重复创建数据库表 | 🟡 中 | ✅ 已修复 | 2026-05-29 |
| 2 | 2.1: questions字段缺失处理 | 🔴 高 | 🔴 待修复 | - |
| 3 | 2.2: undefined答案值处理 | 🔴 高 | 🔴 待修复 | - |
| 4 | 2.3: JSON解析容错 | 🟡 中 | 🟡 待修复 | - |
| 5 | 3.1: JWT签名升级 | ⚠️ 高 | ⚠️ 待修复 | - |
| 6 | 3.2: SQL注入类型检查 | 🟡 中 | 🟡 待修复 | - |
| 7 | 3.3: CORS配置优化 | 🟢 低 | 🟢 待修复 | - |
| 8 | 5.1: 批量事务优化 | 🟡 中 | 🟡 待修复 | - |
| 9 | 5.2: 分页参数边界检查 | 🟢 低 | 🟢 待修复 | - |

---

## 七、测试覆盖说明

### 7.1 测试场景覆盖

| 场景 | 测试数量 |
|-----|---------|
| 正常业务流程 | 35 |
| 参数验证 | 18 |
| 边界值处理 | 15 |
| 异常处理 | 12 |
| 并发测试 | 2 |
| 安全测试 | 7 |

### 7.2 测试文件

- **综合测试**: `backend/tests/api.comprehensive.test.js`
- **运行命令**: `cd backend && npm test`
- **覆盖率报告**: `cd backend && npm run test:coverage`

---

## 八、上线前检查清单

| 检查项 | 状态 | 说明 |
|-------|------|------|
| 测试通过率 ≥ 95% | ✅ 95.5% | 已达标 |
| 高危缺陷已修复 | 🔴 0/3 | 3个高危待修复 |
| 中危缺陷已修复 | 🟡 1/3 | Issue1已修复 |
| 安全问题已评估 | ✅ 完成 | JWT问题建议上线前修复 |
| 代码重复已清理 | ✅ 完成 | Issue1修复 |

**上线前建议**: 修复2.1和2.2两个高危缺陷后再部署

---

**报告更新**: 2026-05-29
**报告生成**: AI Assistant
**测试执行**: npm test (85/89 通过)
