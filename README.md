# wenyan-platform 文言文学习平台

面向中学生与教师的文言文预习平台：按难度分级的预习题目、多角色朗读、字词注释、课文讲解与教师侧数据看板。前端为单页应用，后端提供 REST API 与 SQLite 持久化。

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Vue 3 + TypeScript + Vite 8、Pinia、Vue Router、手写视频/音频播放器 |
| 后端 | Node.js + Express 4、SQLite（sqlite3）、JWT Bearer、zod、multer |
| 测试 | Vitest 4（前端，happy-dom + @vue/test-utils）、Jest 29 + supertest（后端） |
| 工程 | oxlint + ESLint + Prettier、GitHub Actions、PM2、阿里云 OSS |

## 目录结构

```
wenyan-platform/
├── src/                    # 前端源码（views / components / composables / stores / services / adapters）
├── tests/                  # 前端存量测试（*.spec.ts）
├── public/                 # 静态资源与 public/data 题库 JSON
├── backend/                # Express 后端（server.js、src/、tests/）
├── data-pipeline/          # Excel → JSON 数据流水线（python/ + source/）
├── figma-plugin/           # Figma 插件（资源同步用）
├── internal-dashboard/     # 内部数据看板页面
├── scripts/                # 同步、校验、OSS 上传等脚本
├── docs/                   # 项目文档（见下方索引）
└── .github/workflows/      # CI 与部署流水线
```

## 本地开发

先决条件：Node.js `^20.19.0 || >=22.12.0`。

### 前端

```bash
npm install
cp .env.example .env.development   # 按需填写，至少确认 VITE_API_BASE_URL
npm run dev                        # http://localhost:5173
```

### 后端

```bash
cd backend
npm install
cp .env.example .env               # 填写 JWT_SECRET（生产环境缺失会拒绝启动）
npm run dev                        # nodemon 启动，默认 3000 端口
```

### 环境变量

- 前端：以根目录 `.env.example` 为模板，复制为 `.env.development` / `.env.production`。
- 后端：以 `backend/.env.example` 为模板，复制为 `backend/.env`。
- 任何真实密钥/口令都不得提交，规则见 [docs/SECURITY-CONFIG.md](docs/SECURITY-CONFIG.md)。

## 常用命令

前端（仓库根目录，以 `package.json` 为准）：

| 命令 | 作用 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run preview` | 预览构建产物 |
| `npm run type-check` | `vue-tsc --build` 类型检查 |
| `npm run test` | Vitest 单次运行（`src/**/*.test.ts` + `tests/**/*.spec.ts`） |
| `npm run test:coverage` | Vitest + v8 覆盖率（阈值 40/40/30/40） |
| `npm run lint` | oxlint + ESLint（会自动修复） |
| `npm run lint:ci` | oxlint + ESLint（不修复，CI 用） |
| `npm run format` | Prettier 格式化 `src/` |

后端（`backend/` 目录）：

| 命令 | 作用 |
|------|------|
| `npm start` / `npm run dev` | 启动 / nodemon 开发 |
| `npm test` | Jest 单次运行（`backend/tests/**/*.test.js`） |
| `npm run test:coverage` | Jest + 覆盖率 |

## 部署

后端由 PM2 托管进程，前端 `npm run build` 产物上传到阿里云 OSS；两者均由 `.github/workflows/` 中的流水线在推送分支后自动执行。

## 分支模型

- `main`：生产分支，推送后触发生产部署。
- `feature-1`：测试集成分支，推送后触发测试环境部署。
- `feature/<父分支>/<子主题>`：功能分支，从目标分支切出，合回目标分支前需通过 `type-check`、`test`、`lint:ci`。

提交信息遵循 Conventional Commits，详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 文档索引

| 文档 | 内容 |
|------|------|
| [docs/environment-overview.md](docs/environment-overview.md) | 环境总览、GitHub Secrets、端口与流水线 |
| [docs/MAINTENANCE_GUIDE.md](docs/MAINTENANCE_GUIDE.md) | 日常维护、发布、回滚与故障处理 |
| [docs/test-environment-deployment-guide.md](docs/test-environment-deployment-guide.md) | 测试环境部署手册 |
| [docs/SECURITY-CONFIG.md](docs/SECURITY-CONFIG.md) | 密钥配置与禁止事项 |
| [docs/DATA_ADAPTER_GUIDE.md](docs/DATA_ADAPTER_GUIDE.md) | 前端数据适配层约定 |
| [docs/CODE_WIKI.md](docs/CODE_WIKI.md) | 代码结构与模块说明 |

## 许可与安全

- 许可证：[MIT](LICENSE)
- 漏洞披露与已知风险：[SECURITY.md](SECURITY.md)
