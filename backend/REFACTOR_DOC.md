# 后端模块化重构文档

## 一、重构概述

### 1.1 重构背景
原项目后端代码全部集中在单一的 `server.js` 文件中，代码量超过1300行，存在以下问题：
- 代码耦合度高，难以维护和测试
- 职责不清晰，调试困难
- 难以进行功能扩展和团队协作

### 1.2 重构目标
- **高内聚低耦合**: 将功能相关的代码组织到独立模块中
- **清晰的接口定义**: 定义明确的模块接口和调用方式
- **可测试性**: 便于编写单元测试和集成测试
- **可扩展性**: 便于后续功能扩展和维护

### 1.3 重构原则
1. **单一职责原则**: 每个模块只负责一个业务领域
2. **依赖倒置原则**: 高层模块不依赖低层模块，两者都依赖抽象
3. **接口隔离原则**: 接口应该细化，不强迫依赖不需要的接口
4. **开闭原则**: 对扩展开放，对修改封闭

---

## 二、模块划分

### 2.1 目录结构

```
backend/
├── src/                        # 源代码目录
│   ├── config/                 # 配置模块
│   │   ├── app.js              # 应用配置（端口、CORS、JWT等）
│   │   └── database.js         # 数据库配置（连接、表初始化）
│   ├── controllers/            # 控制器层（处理HTTP请求）
│   │   ├── studentController.js
│   │   ├── textsController.js
│   │   ├── answerController.js
│   │   └── authController.js
│   ├── services/               # 服务层（业务逻辑）
│   │   ├── studentService.js
│   │   ├── textsService.js
│   │   └── answerService.js
│   ├── routes/                 # 路由配置
│   │   └── index.js
│   ├── middleware/             # 中间件
│   │   └── errorHandler.js
│   ├── utils/                  # 工具函数
│   │   ├── jsonReader.js
│   │   └── token.js
│   ├── app.js                  # Express应用入口
│   └── models/                 # 数据模型（预留）
├── server.js                   # 服务器启动入口
├── database/                   # SQLite数据库文件
├── public/                     # 静态资源
└── tests/                      # 测试文件
```

### 2.2 模块职责说明

| 模块 | 职责 | 文件 |
|------|------|------|
| **config** | 管理应用配置和数据库连接 | `app.js`, `database.js` |
| **controllers** | 处理HTTP请求，参数校验，调用服务层 | `*Controller.js` |
| **services** | 实现业务逻辑，数据访问 | `*Service.js` |
| **routes** | 注册路由，映射URL到控制器 | `index.js` |
| **middleware** | 处理中间件逻辑（错误处理、日志等） | `errorHandler.js` |
| **utils** | 通用工具函数（JSON读取、JWT生成等） | `jsonReader.js`, `token.js` |

---

## 三、模块接口定义

### 3.1 配置模块 (`src/config/`)

#### `app.js` - 应用配置
```javascript
const config = {
  server: { port, host },
  cors: { origin, methods, allowedHeaders },
  jsonParser: { limit },
  jwt: { secret, expiresIn },
  data: { basePath },
  testMode: boolean
};
```

#### `database.js` - 数据库配置
```javascript
exports = {
  db,           // SQLite数据库连接实例
  dbPath,       // 数据库文件路径
  initTables()  // 初始化数据库表（Promise）
};
```

### 3.2 工具模块 (`src/utils/`)

#### `jsonReader.js`
| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `safeParse(str)` | `str: string` | `any` | 安全解析JSON，失败返回原字符串 |
| `readJsonFile(filePath)` | `filePath: string` | `object\|null` | 读取JSON文件 |
| `getDataFilePath(dirName, fileName)` | `dirName: string, fileName: string` | `string` | 构建数据文件路径 |
| `getCorrectAnswerFromJson(questionId, wenId)` | `questionId: string, wenId: string` | `any\|null` | 从JSON获取正确答案 |
| `processAnswerValue(value)` | `value: any` | `any` | 处理答案值格式 |

#### `token.js`
| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `generateToken(studentId, username)` | `studentId: string, username: string` | `string` | 生成JWT令牌 |
| `verifyToken(token)` | `token: string` | `object\|null` | 验证JWT令牌 |

### 3.3 服务模块 (`src/services/`)

#### `studentService.js`
| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `getStudentById(studentId)` | `studentId: string` | `Promise<object\|null>` | 获取学生信息 |
| `createOrUpdateStudent(studentId, name, class)` | `studentId: string, name: string, class?: number` | `Promise<object>` | 创建或更新学生 |
| `getStudentList(classNum)` | `classNum?: number` | `Promise<Array>` | 获取学生列表 |
| `updateStudent(studentId, name, class)` | `studentId: string, name: string, class?: number` | `Promise<object>` | 更新学生信息 |
| `deleteStudent(studentId)` | `studentId: string` | `Promise<object>` | 删除学生 |

#### `textsService.js`
| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `getBasicInfo(textId)` | `textId: string` | `object\|null` | 获取课文基础信息 |
| `getWordList(textId)` | `textId: string` | `object\|null` | 获取字词注释 |
| `getMultiRoleReading(textId)` | `textId: string` | `object\|null` | 获取多角色朗读数据 |
| `getLevel1Quiz(textId)` | `textId: string` | `object\|null` | 获取一级测验 |
| `getLevel2Dialog(textId)` | `textId: string` | `object\|null` | 获取二级对话 |
| `getLevel2Quiz(textId)` | `textId: string` | `object\|null` | 获取二级测验 |
| `getLevel3ScenarioText(textId)` | `textId: string` | `object\|null` | 获取三级情景文本 |
| `getLevel3AdaptiveQuiz(textId)` | `textId: string` | `object\|null` | 获取三级自适应测验 |
| `getTextList(page, pageSize)` | `page?: number, pageSize?: number` | `object` | 获取课文列表（分页） |
| `getTextsBatch(textIds)` | `textIds: Array` | `Array` | 批量获取课文数据 |

#### `answerService.js`
| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `submitAnswers(data)` | `data: object` | `Promise<object>` | 提交答题记录 |
| `getAnswersByWenId(wenId)` | `wenId: string` | `Promise<object>` | 按课文查询答题情况 |
| `getAnswersByStudentId(studentId)` | `studentId: string` | `Promise<object>` | 按学生查询答题情况 |

### 3.4 控制器模块 (`src/controllers/`)

#### `studentController.js`
| 方法 | 路由 | HTTP方法 | 说明 |
|------|------|----------|------|
| `getStudent(req, res)` | `/api/students/:studentId` | GET | 获取单个学生 |
| `getStudentList(req, res)` | `/api/students` | GET | 获取学生列表 |
| `createStudent(req, res)` | `/api/students` | POST | 学生注册 |
| `updateStudent(req, res)` | `/api/students/:studentId` | PUT | 更新学生信息 |
| `deleteStudent(req, res)` | `/api/students/:studentId` | DELETE | 删除学生 |

#### `textsController.js`
| 方法 | 路由 | HTTP方法 | 说明 |
|------|------|----------|------|
| `getBasicInfo(req, res)` | `/api/texts/:textId/basic-info` | GET | 获取课文基础信息 |
| `getWordList(req, res)` | `/api/texts/:textId/word-list` | GET | 获取字词注释 |
| `getMultiRoleReading(req, res)` | `/api/texts/:textId/multi-role-reading` | GET | 获取多角色朗读数据 |
| `getLevel1Quiz(req, res)` | `/api/texts/:textId/level1-quiz` | GET | 获取一级测验 |
| `getLevel2Dialog(req, res)` | `/api/texts/:textId/level2-dialog` | GET | 获取二级对话 |
| `getLevel2Quiz(req, res)` | `/api/texts/:textId/level2-quiz` | GET | 获取二级测验 |
| `getLevel3ScenarioText(req, res)` | `/api/texts/:textId/level3-scenario-text` | GET | 获取三级情景文本 |
| `getLevel3AdaptiveQuiz(req, res)` | `/api/texts/:textId/level3-adaptive-quiz` | GET | 获取三级自适应测验 |
| `getTextList(req, res)` | `/api/texts` | GET | 获取课文列表 |
| `getTextsBatch(req, res)` | `/api/texts/batch` | POST | 批量获取课文数据 |

#### `answerController.js`
| 方法 | 路由 | HTTP方法 | 说明 |
|------|------|----------|------|
| `submitAnswers(req, res)` | `/api/submit` | POST | 提交答题记录 |
| `getAnswersByWenId(req, res)` | `/api/answers/wen/:wenId` | GET | 按课文查询答题 |
| `getAnswersByStudentId(req, res)` | `/api/answers/student/:studentId` | GET | 按学生查询答题 |

#### `authController.js`
| 方法 | 路由 | HTTP方法 | 说明 |
|------|------|----------|------|
| `login(req, res)` | `/api/auth/login` | POST | 学生登录 |

---

## 四、依赖关系

### 4.1 模块依赖图

```
┌─────────────────────────────────────────────────────────────────┐
│                        server.js                              │
│                              │                                │
│                              ▼                                │
│                        src/app.js                             │
│                              │                                │
│          ┌───────────────────┼───────────────────┐            │
│          ▼                   ▼                   ▼            │
│   src/config/          src/routes/         src/middleware/    │
│   (配置)               (路由)              (中间件)           │
│          │                   │                   │            │
│          │                   ▼                   │            │
│          │            src/controllers/            │            │
│          │            (控制器层)                   │            │
│          │                   │                   │            │
│          │                   ▼                   │            │
│          │            src/services/               │            │
│          │            (服务层)                    │            │
│          │                   │                   │            │
│          │           ┌───────┴───────┐           │            │
│          ▼           ▼               ▼           ▼            │
│   src/config/    src/utils/    src/services/   (错误处理)     │
│   database.js    (工具函数)    studentService.js               │
│                              textsService.js                   │
│                              answerService.js                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 依赖说明

| 模块 | 依赖模块 | 说明 |
|------|---------|------|
| `app.js` | `config/app`, `config/database`, `routes`, `middleware` | 创建Express应用 |
| `routes/index.js` | 所有controllers | 注册路由 |
| `controllers/*` | 对应的services | 调用服务层 |
| `services/studentService.js` | `config/database` | 数据库操作 |
| `services/textsService.js` | `utils/jsonReader` | JSON文件读取 |
| `services/answerService.js` | `config/database`, `utils/jsonReader`, `services/studentService` | 数据库操作和JSON读取 |
| `utils/token.js` | `config/app` | JWT配置 |

---

## 五、API接口总览

### 5.1 学生管理接口

| HTTP方法 | 路径 | 功能 | 所属控制器 |
|---------|------|------|-----------|
| GET | `/api/students` | 获取学生列表 | `studentController` |
| GET | `/api/students/:studentId` | 获取单个学生 | `studentController` |
| POST | `/api/students` | 学生注册 | `studentController` |
| PUT | `/api/students/:studentId` | 更新学生信息 | `studentController` |
| DELETE | `/api/students/:studentId` | 删除学生 | `studentController` |

### 5.2 课文数据接口

| HTTP方法 | 路径 | 功能 | 所属控制器 |
|---------|------|------|-----------|
| GET | `/api/texts` | 获取课文列表 | `textsController` |
| POST | `/api/texts/batch` | 批量获取课文数据 | `textsController` |
| GET | `/api/texts/:textId/basic-info` | 获取课文基础信息 | `textsController` |
| GET | `/api/texts/:textId/word-list` | 获取字词注释 | `textsController` |
| GET | `/api/texts/:textId/multi-role-reading` | 获取多角色朗读数据 | `textsController` |
| GET | `/api/texts/:textId/level1-quiz` | 获取一级测验 | `textsController` |
| GET | `/api/texts/:textId/level2-dialog` | 获取二级对话 | `textsController` |
| GET | `/api/texts/:textId/level2-quiz` | 获取二级测验 | `textsController` |
| GET | `/api/texts/:textId/level3-scenario-text` | 获取三级情景文本 | `textsController` |
| GET | `/api/texts/:textId/level3-adaptive-quiz` | 获取三级自适应测验 | `textsController` |

### 5.3 答题接口

| HTTP方法 | 路径 | 功能 | 所属控制器 |
|---------|------|------|-----------|
| POST | `/api/submit` | 提交答题记录 | `answerController` |
| GET | `/api/answers/wen/:wenId` | 按课文查询答题情况 | `answerController` |
| GET | `/api/answers/student/:studentId` | 按学生查询答题情况 | `answerController` |

### 5.4 认证接口

| HTTP方法 | 路径 | 功能 | 所属控制器 |
|---------|------|------|-----------|
| POST | `/api/auth/login` | 学生登录 | `authController` |

---

## 六、使用方法

### 6.1 启动服务

```bash
# 开发模式（热重载）
cd backend
npm run dev

# 生产模式
cd backend
npm start

# 运行测试
cd backend
npm test
```

### 6.2 调用示例

#### 获取课文基础信息
```bash
curl http://localhost:3000/api/texts/WEN_01/basic-info
```

#### 学生注册
```bash
curl -X POST http://localhost:3000/api/students \
  -H "Content-Type: application/json" \
  -d '{"studentId": "90001", "name": "张三", "class": 9}'
```

#### 提交答题记录
```bash
curl -X POST http://localhost:3000/api/submit \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "90001",
    "wenId": "WEN_01",
    "submittedAt": "2024-01-01T12:00:00Z",
    "answers": {"Q1": 1},
    "questions": [{"id": "Q1", "correctAnswer": 1}]
  }'
```

---

## 七、重构收益

### 7.1 代码组织改进
- 代码结构清晰，职责明确
- 便于团队协作和代码审查
- 降低维护成本

### 7.2 可测试性提升
- 每个模块可独立测试
- 便于编写单元测试和集成测试
- 支持测试驱动开发

### 7.3 可扩展性增强
- 新增功能只需添加新模块
- 模块间接口清晰，便于扩展
- 支持渐进式重构

### 7.4 性能优化
- 模块级别的代码复用
- 便于性能分析和优化
- 支持按需加载（动态导入）

---

## 八、注意事项

### 8.1 循环依赖处理
- 使用动态导入避免循环依赖（如 `answerService.js` 中导入 `studentService.js`）
- 模块间依赖应保持单向，避免循环

### 8.2 错误处理
- 所有异步操作应使用 try-catch
- 错误应统一处理并返回标准格式
- 日志记录应完整

### 8.3 测试覆盖
- 每个服务模块应有对应的单元测试
- 控制器层应有集成测试
- 测试覆盖率应达到80%以上

---

**文档版本**: 1.0  
**创建日期**: 2026-06-03  
**适用项目**: wenyan-platform