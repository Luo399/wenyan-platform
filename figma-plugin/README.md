# 文言文资源同步 - Figma 插件

扫描 Figma 文件中的资源节点，导出并上传到后端/OSS，实现设计稿资源到前端的一键同步。

## 功能

- **图片资源同步**：扫描 `Export Assets` Frame，按子 Frame 名称映射 OSS 路径，导出 PNG/SVG 并上传
- **文字资源同步**：扫描 `文字资源_` Frame，读取 TextNode 文本内容，生成 JSON 并上传
- **样式资源同步**：扫描 `样式_` Frame 与文件内的本地共享样式/变量，把圆角（含直角 `0px`）、颜色与渐变、描边、阴影/模糊、自动布局/Grid、字体字号字重行高等换算成 CSS 声明块，生成 `styles/**.json` 并上传
- **变更预览**：在插件 UI 中展示待同步资源列表，支持按状态筛选
- **版本戳管理**：上传后自动更新 `version.json`，前端通过版本戳刷新缓存

## 架构

```
┌──────────────┐     postMessage      ┌──────────────┐     HTTP      ┌──────────────┐
│  code.ts     │ ◄──────────────────► │  ui.html     │ ────────────► │  后端 API    │
│ (主线程)     │   节点数据 / 结果     │ (UI 线程)     │  FormData    │  /api/assets │
│  Figma API   │                      │  浏览器 API   │  / JSON      └──────────────┘
└──────────────┘                      └──────────────┘
```

- **主线程**（code.ts）：负责 Figma 节点遍历、导出（`node.exportAsync`）与本地样式/变量读取，通过 `postMessage` 传递二进制数据
- **UI 线程**（ui.html）：负责网络请求，图片用 `FormData`/`Blob` 上传，文字与样式用 JSON 上传
- **纯逻辑**（core.ts）：扫描、路径解析、CSS 换算全部集中在此，不引用 `figma` 全局，可单测

## 使用方式

1. 在 Figma 中打开插件（Plugins → 文言文资源同步）
2. 插件自动扫描当前文件中的 `Export Assets`、`文字资源_`、`样式_` Frame，以及文件内的本地共享样式与变量
3. 查看资源列表，点击"开始同步"
4. 监控上传进度，查看同步结果

### Frame 命名规则（Naming Rules）

> 完整规范见 `docs/naming-convention.md`（美术与前端共同参照的唯一事实源）。
> Full spec: see `docs/naming-convention.md` (single source of truth for designers & frontend).

| Frame 名称 | 说明 | 导出路径 | English note |
|-----------|------|---------|--------------|
| `Export Assets` | 图片资源容器，名称固定 | 子 Frame 名即为 OSS 路径 | Fixed image container |
| `Export Assets / images/general/` | 通用图片目录 | `images/general/xxx.png` | Child Frame → OSS dir |
| `文字资源_xxx` | 文字资源容器，前缀固定 | `data/texts/文字资源_xxx.json` | Fixed text prefix; legacy: `data/texts/` |
| `文字资源_culture_cards/WEN_01` | 按目录组织（含 `/`） | `data/culture_cards/WEN_01.json` | New format: suffix → relative dir |
| `样式_Button` | 样式资源容器，前缀固定 | `styles/Button.json` | Fixed style prefix → CSS 参数 JSON |
| `样式_components/Button` | 按目录组织（含 `/`） | `styles/components/Button.json` | Suffix → relative dir |
| （文件内本地共享样式 / 变量） | 无需 Frame，扫描时自动汇总 | `styles/_shared.json` | Local styles & variables |

## 开发

```bash
# 安装依赖
npm install

# 编译
npm run build

# 单元测试
npm run test

# 类型检查（watch 模式）
npm run type-check
npm run watch
```

### 项目结构

```
figma-plugin/
├── code.ts              # 主线程：Figma API 调用 + 主/UI 线程通信
├── core.ts              # 纯逻辑：扫描 / 路径解析 / CSS 换算（可单测，不引用 figma 全局）
├── code.js              # esbuild 产物，Figma 实际加载的文件（改 code.ts/core.ts 后必须 npm run build）
├── ui.html              # UI 线程（资源列表 + 上传）
├── manifest.json        # Figma 插件配置
├── tsconfig.json        # TypeScript 配置
├── vitest.config.ts     # 单测配置
├── __tests__/
│   ├── core.test.ts     # core.ts 单元测试（含样式提取）
│   └── mock-test.ts     # 模拟测试（验证扫描逻辑）
└── docs/
    ├── naming-convention.md       # 命名规范（唯一事实源）
    ├── figma-plugin-manual.md     # 插件使用说明书
    └── figma-pipeline-plan.md     # JSON 数据流方案
```

## 配置

在插件 UI 中配置：

- **API 地址**：后端服务地址（默认 `https://api.classicalab.cn`）
- **同步令牌**：`ASSET_SYNC_TOKEN`，作为 `X-API-Key` 请求头，用于后端资源上传接口鉴权（等同插件内的验证码）

> **令牌职责区分（勿混用）**
> - `ASSET_SYNC_TOKEN`：后端 `/api/assets/upload` 的 `X-API-Key` 鉴权令牌，由后端 `.env` 注入，随 `pm2 reload` 生效。**在插件 UI 中填写**，等同"验证码"。
> - `ASSET_SYNC_REPO_TOKEN`：GitHub Actions 用于操作 `Luo399/wenyan-asset-sync` 仓库的 PAT（需 `repo` + `PR` 权限）。**仅供 CI 使用，不在插件 UI 中填写**。
> - 两者职责独立，改动一边不影响另一边。

## 关键注意事项

1. **异步 API**：`manifest.json` 中 `"documentAccess": "dynamic-page"`，必须使用 `await figma.getNodeByIdAsync()`
2. **环境分隔**：主线程无 `FormData`/`Blob`，网络请求全部在 UI 线程完成
3. **网络权限**：`manifest.json` 中 `networkAccess.allowedDomains` 已配置为 `["https://api.classicalab.cn"]`，必须包含 scheme（`https://`）
4. **节点 ID**：Figma 节点 ID 格式为 `"123:456"`，非文件名，通过 `selection[0].id` 获取
5. **产物内禁止时间戳与随机值**：后端靠 MD5 比对做增量跳过，一旦写入 `generatedAt` 每次同步都会被判成"变更"并重复上传，污染生产桶。样式 JSON 的键顺序、`tokens` 排序（次数降序、同值按字符串升序）都是为字节稳定服务的
6. **样式 JSON 体积**：后端单个 JSON 上限 500KB，插件按 480KB 自我约束——先去掉 `raw`（`meta.withRaw=false`），再裁剪节点（`meta.truncated=true`），单 Frame 另有 300 节点 / 6 层深度上限
7. **改 code.ts / core.ts 必须重跑 `npm run build`**：CI 会断言 `code.js` 与源码同步，不一致直接失败
