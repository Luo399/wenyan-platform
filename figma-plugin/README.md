# 文言文资源同步 - Figma 插件

扫描 Figma 文件中的资源节点，导出并上传到后端/OSS，实现设计稿资源到前端的一键同步。

## 功能

- **图片资源同步**：扫描 `Export Assets` Frame，按子 Frame 名称映射 OSS 路径，导出 PNG/SVG 并上传
- **文字资源同步**：扫描 `文字资源_` Frame，读取 TextNode 文本内容，生成 JSON 并上传
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

- **主线程**（code.ts）：负责 Figma 节点遍历、导出（`node.exportAsync`），通过 `postMessage` 传递二进制数据
- **UI 线程**（ui.html）：负责网络请求，图片用 `FormData`/`Blob` 上传，文字用 JSON 上传

## 使用方式

1. 在 Figma 中打开插件（Plugins → 文言文资源同步）
2. 插件自动扫描当前文件中的 `Export Assets` 和 `文字资源_` Frame
3. 查看资源列表，点击"开始同步"
4. 监控上传进度，查看同步结果

### Frame 命名规则

| Frame 名称 | 说明 | 导出路径 |
|-----------|------|---------|
| `Export Assets` | 图片资源容器 | 子 Frame 名即为 OSS 路径 |
| `Export Assets / images/general/` | 通用图片目录 | `images/general/xxx.png` |
| `文字资源_xxx` | 文字资源容器 | `data/texts/文字资源_xxx.json` |
| `文字资源_culture_cards/WEN_01` | 按目录组织 | `data/culture_cards/WEN_01.json` |

## 开发

```bash
# 安装依赖
npm install

# 编译
npm run build

# 类型检查（watch 模式）
npm run type-check
npm run watch
```

### 项目结构

```
figma-plugin/
├── code.ts              # 主线程逻辑（节点扫描 + 导出）
├── ui.html              # UI 线程（资源列表 + 上传）
├── manifest.json        # Figma 插件配置
├── tsconfig.json        # TypeScript 配置
├── package.json         # 依赖管理
├── __tests__/
│   └── mock-test.ts     # 模拟测试（验证扫描逻辑）
└── docs/
    ├── figma-plugin-manual.md   # 插件使用说明书
    └── figma-pipeline-plan.md   # JSON 数据流方案
```

## 配置

在插件 UI 中配置：

- **API 地址**：后端服务地址（默认 `https://api.classicalab.cn`）
- **同步令牌**：`ASSET_SYNC_TOKEN`，用于接口鉴权

## 关键注意事项

1. **异步 API**：`manifest.json` 中 `"documentAccess": "dynamic-page"`，必须使用 `await figma.getNodeByIdAsync()`
2. **环境分隔**：主线程无 `FormData`/`Blob`，网络请求全部在 UI 线程完成
3. **网络权限**：`manifest.json` 中 `networkAccess.allowedDomains` 已配置为 `["https://api.classicalab.cn"]`，必须包含 scheme（`https://`）
4. **节点 ID**：Figma 节点 ID 格式为 `"123:456"`，非文件名，通过 `selection[0].id` 获取
