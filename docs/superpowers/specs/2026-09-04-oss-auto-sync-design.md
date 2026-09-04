# Figma 上传 OSS 后的前端资源自动同步清单 — 设计文档

- 日期：2026-09-04
- 状态：待审阅
- 归属：文言文预习平台（wenyan-platform）

## 1. 背景与目标

Figma 插件（`figma-plugin/`）在 Figma 内手动点「同步」后，把 `Export Assets`（图片）和 `文字资源_*`（文字 JSON）上传到后端 `/api/assets/upload`，后端经 MD5 去重后写入 OSS（public-read）。

目标：在插件上传成功后，**手动触发一次**自动化，识别本次新增/变更的资源，校验其 OSS 可读，做二次分类：

- 能贴合现有前端消费结构（data 目录、images/audio/video）且能被既有组件读取的 → **放行**（确认可读即可，前端实时读 OSS，无需重建）。
- 与现有组件不匹配、或视觉/样式改动过大、或属于 `styles/` 这类无现存消费者路径的 → 不处理，**追加到「新增组件清单」**（存 OSS JSON）。

**边界（已与需求方确认）：**
- 触发方式：手动按需，不轮询、不事件回调。
- 「投放」含义：直接把资源放 OSS 供前端代码读取，**不下发本地开发环境、不触发整站重新部署**。
- 清单存储：OSS 上的 JSON，前端/人工均可读。
- 清单写入通道：复用后端上传接口（X-API-Key 鉴权），不暴露 OSS 主 key。

## 2. 现状事实（探索结论）

- 插件上传入口是 Figma 内手动点击，上传不触发任何 GitHub Actions。
- 前端已通过 `/api/assets/version` 的时间戳做 CDN 失效，并实时从 OSS 读取 `data/...json`、`images/...`、`audio/...`、`video/...`（`src/utils/asset.ts` 的 `getDataUrl` / `getAssetUrl`）。
- 后端 `validateUpload`（`backend/src/controllers/assetController.js`）已用路径白名单约束上传：
  - JSON 白名单：`data/culture_cards`、`data/text_basic_info`、`data/level1_quiz`、`data/texts`、`data/word_list`、`styles`
  - 媒体根目录：`images/`、`audio/`、`video/`
  - 不在白名单 → 400 拒绝。因此成功上传到 OSS 的资源本身已在「能通过工作流同步」范围内。
- 公开只读能力：`GET /api/assets/version`（返回 `{ assets: {ossPath:{md5,size,type,updatedAt}}, lastSyncAt }`，无需鉴权）。
- 写 OSS 的唯一合规通道：`POST /api/assets/upload`（`assetAuthMiddleware` 校验 `X-API-Key` 与 `ASSET_SYNC_TOKEN` 一致；未配置令牌时仅放行本机回环）。
- 现状没有「新增组件清单」文件，也没有"把样式/文字/json 二次分类投放"的环节。

## 3. 方案（已选定）

「NPM 脚本 + 后端白名单小改造 + 手动触发的自动化任务」

### 3.1 总体数据流

```
手动触发(自动化任务) → node scripts/oss-auto-sync.js [--env test|prod] [--dry-run]

  1. GET {api}/api/assets/version                 # 当前全部已上传清单含 updatedAt（公开）
  2. GET OSS  data/sync_watch/last_state.json     # 上次已处理快照（公开）
  3. Diff：本次待处理集 = 路径不存在于快照 或 updatedAt > 快照记录
  4. 分类：
       ├─ 命中"已知消费者"且 JSON schema 合法 → 放行：GET 公开 URL 校验可读
       └─ styles/ 资源 / 未知路径 / schema 不匹配 / 视觉改动过大 → 进「新增组件清单」
  5. 读 OSS 清单 data/sync_watch/new_components.json → 追加去重新项
  6. POST {api}/api/assets/upload (X-API-Key)
        → 把 new_components.json、last_state.json 写回 OSS
  7. 输出汇总：识别数 / 放行数 / 进清单数 + 清单可读 URL
```

### 3.2 交付物

1. **`scripts/oss-auto-sync.js`**——主脚本：
   - 读公开 `version` 清单；
   - 维护 `last_state.json`（避免每次都把全部历史再处理一遍）；
   - 分类与可读性校验；
   - 通过上传接口把 `last_state.json` 与 `new_components.json` 写回 OSS；
   - 支持 `--env test|prod`（对应不同 API base + 不同 OSS 桶）与 `--dry-run`（只算不改）。
2. **后端 1 处小改造**——`backend/src/controllers/assetController.js` 的 `ALLOWED_JSON_DIRS` 增加 `data/sync_watch`（放清单与 last_state，非前端业务数据）。
3. **自动化任务**——手动按需触发；`message` 写明脚本用法与执行约束。

### 3.3 脚本依赖的配置

- 运行参数：`--env test|prod`、`--dry-run`。
- 环境变量/参数：写清单用的 `X-API-Key`（每次触发时提供，或本机未提交的本地 `.env`；**不落仓库**）。
- 读接口走公开 URL，无需密钥；`apiBase` 与 `ossPublicBase` 按 `--env` 取默认值（`test-api.classicalab.cn` + test 桶；`api.classicalab.cn` + prod 桶），可被参数覆盖。

### 3.4 数据契约（OSS 内文件）

`data/sync_watch/last_state.json`：

```json
{
  "lastProcessedAt": "2026-09-04T00:00:00.000Z",
  "processed": { "ossPath": "ISO8601 updatedAt", "..." }
}
```

`data/sync_watch/new_components.json`：

```json
{
  "updatedAt": "2026-09-04T00:00:00.000Z",
  "items": [
    {
      "ossPath": "styles/xxx.json",
      "type": "style",
      "wen": "WEN_xx | general",
      "reason": "无现存样式消费者/视觉改动过大/schema 不匹配/校验失败",
      "firstSeenAt": "2026-09-04T00:00:00.000Z"
    }
  ]
}
```

### 3.5 已知消费者基线（脚本内置，可扩展）

放行（可读即可）：
- `data/culture_cards/`、`data/text_basic_info/`、`data/level1_quiz/`、`data/texts/`、`data/word_list/`
- `images/`、`audio/`、`video/`

进清单：
- `styles/` 下任何资源（当前业务样式走 Figma 静态资源 + design-tokens，无现存 style 消费者）；
- 不在上述任何前缀之下的未知路径；
- JSON schema 与现有消费者预期不符、或视觉/样式改动过大被判别为无法匹配既有组件的。

> 分类规则基于前缀 + schema 校验，具体阈值在实现时以"能否被现有数据读取器消费"为判据；无法判定的，宁进清单不误放行。

## 4. 错误处理

- 读 `version` / 公开清单失败（网络、超时、非 200）→ 中止，**不更新 last_state**（避免误判为已处理）。
- 写清单失败（白名单未命中 → 400、鉴权 → 401）→ 报错并保留内存中清单供重试，不落盘。
- 单项公开 URL 校验不可读（403/404/超时）→ 该项标记 `reason: 校验失败` 进清单，保证"放行的必可读"。
- 幂等：基于 `last_state` + MD5/updatedAt 判定，重复触发不会重复追加清单项（按 `ossPath` 去重）。

## 5. 测试与验收

1. test 环境 `--dry-run`：确认 diff 分类、清单内容、不落盘无副作用。
2. test 环境真实执行一次：确认清单与 last_state 成功写回 OSS 且公开可读。
3. 生产 `--dry-run` → 真实执行一次。
4. 验收标准：每次手动触发后输出「识别数 / 放行数 / 进清单数 / 清单可读 URL」；清单 JSON 可被前端或人工访问；重复触发无重复项。

## 6. 部署与分支流程

- 后端白名单改动走 `trae/agent-*` 开发 → 合并 `feature-1`（触发测试部署）→ 单独 PR 合入 `main`（触发生产部署），并**等待并轮询 Actions 直至 success**（遵循 `project-workflow.md`）。
- 脚本仅在本仓库内，随分支推送即可，不依赖后端部署。
- `.env` 类密钥不 commit；脚本所需 X-API-Key 由触发时提供或本机本地 `.env`（未跟踪）。

## 7. 明确不做（避免蔓延）

- 不做事件回调/Webhook 实时触发。
- 不触发前端整站重新构建与部署。
- 不把资源拉到本地开发环境。
- 不做自动生成新前端组件代码（只记录「新增组件清单」供后续人工/新会话处理）。