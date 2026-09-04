# OSS 资源自动同步清单（oss-auto-sync）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Figma 插件上传 OSS 后手动触发一次，识别新增/变更资源，校验 OSS 可读，贴合现有前端的放行、不匹配/样式改动过大的记入 OSS「新增组件清单」。

**Architecture:** 一个纯逻辑核心模块（可单测）+ 一个 CLI 编排脚本。CLI 读公开 `/api/assets/version` 得清单，与 OSS 上 `last_state.json` 做 diff 得到待处理集，逐条分类：命中已知消费者（data 目录 + images/audio/video）且 JSON 可解析 → 校验公开 URL 可读后放行；`styles/`、未知路径、schema 解析失败 → 进 `new_components.json`。完成后经后端上传接口（X-API-Key）把 `new_components.json` 与 `last_state.json` 写回 OSS。下发给本地、不触发前端重建。

**Tech Stack:** Node 20+（内置 `fetch`），纯 ESM 脚本，vitest（root `tests/**/*.spec.ts` 已被现有 CI/提交钩子纳入）。

**关键环境事实（已核实）：**
- test：API `https://test-api.classicalab.cn`，OSS 公开基 `https://test.classicalab.cn`
- prod：API `https://api.classicalab.cn`，OSS 公开基 `https://www.classicalab.cn`（必须带 www）
- `GET {api}/api/assets/version`（公开）→ `{ data: { assets: {ossPath:{md5,size,type,updatedAt}}, lastSyncAt } }`
- OSS 公开 URL 拼接：`{ossPublicBase}/{ossPath}`
- 写 OSS 通道：`POST {api}/api/assets/upload`，鉴权头 `X-API-Key`，JSON body `{ files:[{ossPath,type:'text',content,encoding}] }`，content 为 base64 时 `encoding:'base64'`
- 后端 `validateUpload` 白名单 `ALLOWED_JSON_DIRS` 需新增 `data/sync_watch` 才能落盘清单

---

## File Structure

| 文件 | 职责 |
|---|---|
| Create `scripts/oss-auto-sync-core.js` | 纯逻辑：参数解析、env 默认值、分类、diff、清单构建、上传体构建（无网络，可单测） |
| Create `tests/oss-auto-sync-core.spec.ts` | 覆盖 core 纯逻辑的 vitest 测试 |
| Create `scripts/oss-auto-sync.js` | CLI 编排：fetch version/last_state、校验可读、上传写回、打印汇总（薄层，只调 core） |
| Modify `backend/src/controllers/assetController.js` | `ALLOWED_JSON_DIRS` 增加 `data/sync_watch` |
| （执行期）Schedule 自动化任务 | 手动按需触发，`message` 指向脚本用法 |

---

### Task 1: 核心纯逻辑模块 + 测试（TDD）

**Files:**
- Create: `scripts/oss-auto-sync-core.js`
- Test: `tests/oss-auto-sync-core.spec.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/oss-auto-sync-core.spec.ts`（顶部 `// @ts-nocheck` 规避 vue-tsc 对 import 纯 JS 的类型告警）：

```ts
// @ts-nocheck
import { describe, it, expect } from 'vitest'
import {
  getEnvDefaults,
  classifyPath,
  computePending,
  dedupeItems,
  makeNewComponentsJson,
  makeLastStateJson,
  buildUploadBody,
} from '../scripts/oss-auto-sync-core.js'

describe('oss-auto-sync-core', () => {
  it('getEnvDefaults 返回测试/生产两组域名', () => {
    expect(getEnvDefaults('test')).toEqual({
      apiBase: 'https://test-api.classicalab.cn',
      ossPublicBase: 'https://test.classicalab.cn',
    })
    expect(getEnvDefaults('prod')).toEqual({
      apiBase: 'https://api.classicalab.cn',
      ossPublicBase: 'https://www.classicalab.cn',
    })
  })

  it('classifyPath 放行已知 data 目录与媒体目录', () => {
    expect(classifyPath('data/culture_cards/WEN_01.json').decision).toBe('release')
    expect(classifyPath('images/general/home_bg.png').decision).toBe('release')
    expect(classifyPath('audio/WEN_01.mp3').decision).toBe('release')
  })

  it('classifyPath 把 styles/ 与未知路径进新增组件清单', () => {
    const s = classifyPath('styles/hero_card.json')
    expect(s.decision).toBe('component')
    expect(s.reason).toContain('样式')
    expect(classifyPath('foo/bar.json').decision).toBe('component')
  })

  it('computePending 只返回新增或 updatedAt 更晚的路径', () => {
    const assets = {
      a: { updatedAt: '2026-09-01T00:00:00Z' },
      b: { updatedAt: '2026-09-03T00:00:00Z' },
      c: { updatedAt: '2026-09-02T00:00:00Z' },
    }
    const processed = { a: '2026-09-01T00:00:00Z', b: '2026-09-02T00:00:00Z' }
    // c 已存在但更老 → 不算; b 更新 → 算; a 相同时间且已处理 → 不算
    expect(computePending(assets, processed)).toEqual(['b'])
  })

  it('dedupeItems 按 ossPath 去重，已存在项跳过', () => {
    const existing = [{ ossPath: 'styles/x.json', reason: 'r' }]
    const incoming = [{ ossPath: 'styles/x.json', reason: 'again' }, { ossPath: 'styles/y.json', reason: 'new' }]
    expect(dedupeItems(incoming, existing)).toEqual([
      { ossPath: 'styles/x.json', reason: 'r' },
      { ossPath: 'styles/y.json', reason: 'new' },
    ])
  })

  it('makeNewComponentsJson 与 makeLastStateJson 结构正确', () => {
    const items = [{ ossPath: 'styles/x.json', type: 'style', wen: 'general', reason: 'r', firstSeenAt: 'T' }]
    expect(makeNewComponentsJson(items, 'NOW')).toEqual({ updatedAt: 'NOW', items })
    const assets = { a: { updatedAt: 'U1' } }
    expect(makeLastStateJson(assets, 'NOW')).toEqual({ lastProcessedAt: 'NOW', processed: { a: 'U1' } })
  })

  it('buildUploadBody 生成 base64 上传体', () => {
    const body = buildUploadBody([{ ossPath: 'data/sync_watch/new_components.json', jsonObject: { updatedAt: 'T', items: [] } }])
    expect(body.files[0].ossPath).toBe('data/sync_watch/new_components.json')
    expect(body.files[0].type).toBe('text')
    expect(body.files[0].encoding).toBe('base64')
    expect(() => Buffer.from(body.files[0].content, 'base64').toString('utf-8')).not.toThrow()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/oss-auto-sync-core.spec.ts`
Expected: FAIL（模块不存在/`Cannot find module '../scripts/oss-auto-sync-core.js'`）。

- [ ] **Step 3: 实现核心模块**

创建 `scripts/oss-auto-sync-core.js`（ESM；本项目 `"type":"module"`）：

```js
// oss-auto-sync 核心纯逻辑（无网络依赖，可单测）
// 职责：参数解析、env 域名默认值、资源分类、diff、清单构建、上传体构建

// 已知 JSON 数据目录（前端 getDataUrl 消费），命中即『放行』
export const KNOWN_JSON_DIRS = [
  'data/culture_cards',
  'data/text_basic_info',
  'data/level1_quiz',
  'data/texts',
  'data/word_list',
]

// 已知媒体根目录（前端 getAssetUrl 消费），命中即『放行』
export const KNOWN_MEDIA_PREFIXES = ['images/', 'audio/', 'video/']

// 样式目录：当前业务无现存样式消费者（样式走 Figma 静态资源 + design-tokens），默认进清单
export const STYLES_PREFIX = 'styles/'

// 按环境返回 API 与 OSS 公开基（值已与前端 .env 对齐）
export function getEnvDefaults(env) {
  if (env === 'test') {
    return { apiBase: 'https://test-api.classicalab.cn', ossPublicBase: 'https://test.classicalab.cn' }
  }
  return { apiBase: 'https://api.classicalab.cn', ossPublicBase: 'https://www.classicalab.cn' }
}

// 解析 CLI 参数
// @returns {{ env:'test'|'prod', dryRun:boolean, apiKey:string, apiBase:string, ossPublicBase:string }}
export function parseArgs(argv) {
  const args = argv.slice()
  const flag = (names) => {
    const idx = args.findIndex((a) => names.includes(a))
    return idx >= 0 ? args[idx + 1] : undefined
  }
  const env = flag(['--env']) === 'test' ? 'test' : 'prod'
  const dryRun = args.includes('--dry-run')
  const defaults = getEnvDefaults(env)
  return {
    env,
    dryRun,
    apiKey: flag(['--api-key']) || process.env.OSS_SYNC_API_KEY || process.env.ASSET_SYNC_TOKEN || '',
    apiBase: flag(['--api-base']) || defaults.apiBase,
    ossPublicBase: flag(['--oss-base']) || defaults.ossPublicBase,
  }
}

// 资源分类：命中已知消费者放行，否则进新增组件清单
// @returns {{ decision:'release' } | { decision:'component', reason:string }}
export function classifyPath(ossPath) {
  const isKnownJson = KNOWN_JSON_DIRS.some((d) => ossPath.startsWith(`${d}/`))
  const isKnownMedia = KNOWN_MEDIA_PREFIXES.some((p) => ossPath.startsWith(p))
  if (isKnownJson || isKnownMedia) {
    return { decision: 'release' }
  }
  if (ossPath.startsWith(STYLES_PREFIX)) {
    return { decision: 'component', reason: '无现存样式消费者（样式走 Figma 静态资源 + design-tokens）' }
  }
  return { decision: 'component', reason: '未知路径，未匹配任何现有消费者' }
}

// 是否需要做 JSON schema 校验（仅 JSON 文本需要）
export function needsSchemaCheck(ossPath) {
  return /\.json$/i.test(ossPath)
}

// 计算待处理路径：不存在于快照，或 updatedAt 比快照更晚
// @returns {string[]}
export function computePending(assets, processed) {
  const prev = processed || {}
  return Object.entries(assets || {})
    .filter(([ossPath, info]) => {
      const before = prev[ossPath]
      if (!before) return true
      return (info.updatedAt || '') > before
    })
    .map(([ossPath]) => ossPath)
    .sort()
}

// 合并清单项（按 ossPath 去重，已存在项保留原值）
export function dedupeItems(incoming, existing) {
  const merged = new Map((existing || []).map((it) => [it.ossPath, it]))
  for (const item of incoming || []) {
    if (!merged.has(item.ossPath)) merged.set(item.ossPath, item)
  }
  return [...merged.values()]
}

// 构建 new_components.json 结构
export function makeNewComponentsJson(items, nowIso) {
  return { updatedAt: nowIso, items: items || [] }
}

// 构建 last_state.json 结构（记录每个路径的更新时间，作为下次 diff 快照）
export function makeLastStateJson(assets, nowIso) {
  const processed = {}
  for (const [ossPath, info] of Object.entries(assets || {})) {
    processed[ossPath] = info.updatedAt || nowIso
  }
  return { lastProcessedAt: nowIso, processed }
}

// 构建上传接口 JSON body（content 用 base64）
export function buildUploadBody(files) {
  return {
    files: files.map((f) => ({
      ossPath: f.ossPath,
      type: 'text',
      content: Buffer.from(JSON.stringify(f.jsonObject), 'utf-8').toString('base64'),
      encoding: 'base64',
    })),
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/oss-auto-sync-core.spec.ts`
Expected: PASS（6 个用例全绿）。

- [ ] **Step 5: 提交**

```bash
git add scripts/oss-auto-sync-core.js tests/oss-auto-sync-core.spec.ts
git commit -m "feat: add oss-auto-sync core classification logic"
```

---

### Task 2: CLI 编排脚本

**Files:**
- Create: `scripts/oss-auto-sync.js`

- [ ] **Step 1: 实现 CLI**

创建 `scripts/oss-auto-sync.js`（ESM、Node 20+ 内置 fetch）。职责：读 version → 读 last_state → diff → 分类 → 校验 OSS 可读 → 构建清单 → 上传写回。`--dry-run` 只算不改不读网（可读性校验属只读，真实执行再做）。

```js
// oss-auto-sync CLI：Figma 上传 OSS 后的前端资源自动同步清单
// 用法：node scripts/oss-auto-sync.js [--env test|prod] [--dry-run] [--api-key x]
// 只通过公开接口读取，写清单走后端上传接口（X-API-Key），不暴露 OSS 主 key。
import {
  parseArgs,
  classifyPath,
  computePending,
  dedupeItems,
  makeNewComponentsJson,
  makeLastStateJson,
  buildUploadBody,
  needsSchemaCheck,
} from './oss-auto-sync-core.js'

const SYNC_DIR = 'data/sync_watch'
const LAST_STATE_PATH = `${SYNC_DIR}/last_state.json`
const NEW_COMPONENTS_PATH = `${SYNC_DIR}/new_components.json`

// 读取公开 OSS JSON；404 视为初始空态
async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`读取失败 ${res.status}: ${url}`)
  return res.json()
}

// 校验公开 URL 可读：优先 HEAD；不支持 HEAD(405/403) 时回退 GET 只读首字节判 200
async function checkReadable(url) {
  try {
    const head = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15000) })
    if (head.ok) return true
    if (head.status !== 405 && head.status !== 403) return head.status === 200
  } catch {
    // 继续走 GET 回退
  }
  const get = await fetch(url, { signal: AbortSignal.timeout(15000) })
  await get.body?.cancel?.()
  return get.ok
}

// 从公开 URL 读取 JSON 文本并校验 schema（可解析对象）
async function fetchAndValidateJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`schema 校验读取失败 ${res.status}: ${url}`)
  const parsed = await res.json()
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('JSON 顶层必须是对象')
  }
  return true
}

async function uploadTextFiles(apiBase, apiKey, files) {
  const res = await fetch(`${apiBase}/api/assets/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify(buildUploadBody(files)),
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`上传失败 ${res.status}: ${text || res.statusText}`)
  }
  return res.json()
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (!opts.apiKey) {
    console.error('缺少写入凭据：请用 --api-key 或环境变量 ASSET_SYNC_TOKEN / OSS_SYNC_API_KEY 提供。')
    process.exit(2)
  }

  const stateUrl = `${opts.ossPublicBase}/${LAST_STATE_PATH}`
  const componentsUrl = `${opts.ossPublicBase}/${NEW_COMPONENTS_PATH}`
  const versionUrl = `${opts.apiBase}/api/assets/version`

  console.log(`[oss-auto-sync] env=${opts.env} dry-run=${opts.dryRun} api=${opts.apiBase}`)

  // 1. 读当前已上传清单
  const versionRes = await fetchJson(versionUrl)
  const assets = versionRes?.data?.assets || {}
  console.log(`已上传资源总数: ${Object.keys(assets).length}`)

  // 2. 读上次快照与既有清单（可能不存在）
  const lastState = (await fetchJson(stateUrl)) || { lastProcessedAt: null, processed: {} }
  let existingList = (await fetchJson(componentsUrl))?.items || []
  console.log(`上次处理时间: ${lastState.lastProcessedAt || '（无）'}，既有清单项: ${existingList.length}`)

  // 3. diff 出待处理集
  const pending = computePending(assets, lastState.processed)
  console.log(`本次待处理: ${pending.length} 项`)

  // 4. 分类
  const release = []
  const componentItems = []
  for (const ossPath of pending) {
    const type = assets[ossPath]?.type || 'image'
    const wen = /WEN_\d{2}/i.test(ossPath) ? ossPath.match(/WEN_\d{2}/i)[0] : 'general'
    const cls = classifyPath(ossPath)

    if (cls.decision === 'release') {
      const url = `${opts.ossPublicBase}/${ossPath}`
      let ok = false
      let schemaReason = ''
      if (!opts.dryRun) {
        try {
          if (needsSchemaCheck(ossPath) && type !== 'image') {
            await fetchAndValidateJson(url)
          }
          ok = await checkReadable(url)
        } catch (err) {
          schemaReason = err.message
        }
      } else {
        ok = true // dry-run 不做网络，仅预览分类
      }
      if (ok) {
        release.push(ossPath)
      } else {
        componentItems.push({
          ossPath,
          type,
          wen,
          reason: schemaReason || 'schema 校验失败或 OSS 不可读',
          firstSeenAt: new Date().toISOString(),
        })
      }
    } else {
      componentItems.push({
        ossPath,
        type,
        wen,
        reason: cls.reason,
        firstSeenAt: new Date().toISOString(),
      })
    }
  }

  // 5. 合并去重清单
  const mergedItems = dedupeItems(componentItems, existingList)
  const nowIso = new Date().toISOString()

  console.log(`放行（OSS 可读）: ${release.length} 项`)
  console.log(`进入新增组件清单: ${mergedItems.length - existingList.length} 项（累计 ${mergedItems.length} 项）`)
  if (componentItems.length > 0) {
    console.log('新增清单项预览:')
    componentItems.forEach((it) => console.log(`  - ${it.ossPath} (${it.reason})`))
  }

  if (opts.dryRun) {
    console.log(`[dry-run] 未落盘。待写: ${SYNC_DIR}/new_components.json + last_state.json`)
    return
  }

  // 6. 写回 OSS（上传接口，apply 白名单 data/sync_watch）
  const nextState = makeLastStateJson(assets, nowIso)
  await uploadTextFiles(opts.apiBase, opts.apiKey, [
    { ossPath: NEW_COMPONENTS_PATH, jsonObject: makeNewComponentsJson(mergedItems, nowIso) },
    { ossPath: LAST_STATE_PATH, jsonObject: nextState },
  ])
  console.log('已写回:')
  console.log(`  - ${opts.ossPublicBase}/${NEW_COMPONENTS_PATH}`)
  console.log(`  - ${opts.ossPublicBase}/${LAST_STATE_PATH}`)
  console.log('完成。')
}

main().catch((err) => {
  console.error('[oss-auto-sync] 出错，未更新 last_state：', err.message)
  process.exit(1)
})
```

- [ ] **Step 2: 语法/格式自检**

Run: `npx prettier --check scripts/oss-auto-sync.js scripts/oss-auto-sync-core.js`
Expected: 无告警（如报错则 `npx prettier --write` 后重跑）。

- [ ] **Step 3: 提交**

```bash
git add scripts/oss-auto-sync.js
git commit -m "feat: add oss-auto-sync cli runner"
```

---

### Task 3: 后端白名单新增 `data/sync_watch`

**Files:**
- Modify: `backend/src/controllers/assetController.js:16-23`

- [ ] **Step 1: 修改白名单**

在 `ALLOWED_JSON_DIRS` 数组增加一行（见 `assetController.js` 顶部常量区）：

```js
const ALLOWED_JSON_DIRS = [
  'data/culture_cards',
  'data/text_basic_info',
  'data/level1_quiz',
  'data/texts',
  'data/word_list',
  'styles',  // Figma 插件视觉属性提取（颜色、字体、边框、圆角、自动布局等）
  'data/sync_watch', // 自动化清单与同步状态（非前端业务数据，仅 oss-auto-sync 写入）
]
```

- [ ] **Step 2: 提交**

```bash
git add backend/src/controllers/assetController.js
git commit -m "feat: allow data/sync_watch in asset upload whitelist"
```

---

### Task 4: 端到端验证（测试环境优先）

**Files:** 无（只读验证）

- [ ] **Step 1: 后端本地可解析校验（启动自检）**

Run: `node -e "import('./scripts/oss-auto-sync-core.js').then(m=>console.log(m.getEnvDefaults('prod')))"`
Expected: 打印 `{ apiBase: 'https://api.classicalab.cn', ossPublicBase: 'https://www.classicalab.cn' }`。

- [ ] **Step 2: 测试环境 dry-run**

Run: `node scripts/oss-auto-sync.js --env test --api-key <测试令牌> --dry-run`
Expected: 打印资源总数、待处理数、分类；`[dry-run] 未落盘`，不产生副作用。

- [ ] **Step 3: 测试环境真实执行**

先确认后端已部署且 `ALLOWED_JSON_DIRS` 含 `data/sync_watch`（测试后端 test-api.classicalab.cn）。再运行：

Run: `node scripts/oss-auto-sync.js --env test --api-key <测试令牌>`
Expected: 输出放行/进清单数，并打印 `data/sync_watch/new_components.json` 与 `last_state.json` 的公开 URL；随后用浏览器或 `curl.exe` 验证两个 URL 返回 200 且内容为 JSON。

- [ ] **Step 4: 重复触发幂等**

重跑 Step 3 一次。
Expected: 待处理为 0（或仅新变化项），清单项数不再重复累加。

（生产 `--env prod` 验证在合并到 main 部署后由人工执行，遵循 `project-workflow.md` 等待 Actions。）

---

### Task 5: 创建手动按需触发的自动化任务

**Files:** 无（通过 Schedule 工具创建）

- [ ] **Step 1: 调用 Schedule 创建（action: create）**

配置：
- `name`：`oss-auto-sync 新增组件清单同步`
- `message`：写清从用户视角的执行说明，含：触发条件是"刚刚在 Figma 插件里点了同步并成功上传 OSS 后"；执行命令 `node scripts/oss-auto-sync.js --env {test|prod} --api-key <本轮由用户提供>`；只处理 `data/` 已知目录、`images/audio/video` 与能通过后端白名单/工作流上传同步的资源；`styles/` 和未知路径、schema 解析失败、OSS 不可读的项一律追加到 OSS `data/sync_watch/new_components.json` 而非处理；写清单走后端上传接口 X-API-Key，密钥不落仓库、由用户在运行时提供或从本机未跟踪的本地 `.env` 读取；执行 `--dry-run` 预览后再写；输出识别数/放行数/进清单数/清单公开 URL。
- `cron_expression`：本任务为**纯手动按需触发**，Schedule 需占位 cron；设置不干扰日常的值（如 `0 0 1 1 *`），实际只用 `action: trigger` 手动跑。创建时向用户说明"此任务不会自动按点运行，仅由你手动触发"。

- [ ] **Step 2: 向用户确认 cron 占位约定**

创建完成后告知用户：该自动化任务是手动触发型，Schedule 面板要求必有 cron 表达式，故填入一年一度的占位；正常使用请用「运行一次（trigger）」。

---

## Self-Review 记录

- 规格覆盖：规格 3.1 数据流、3.2 交付物、3.4 数据契约、3.5 分类基线、4 错误处理、5 测试验收、7 明确不做 —— 均已映射到 Task 1-5。无遗漏。
- 占位扫描：无 TBD/TODO；每个代码步骤都给出了完整代码。
- 类型一致：`classifyPath`/`computePending`/`dedupeItems`/`makeNewComponentsJson`/`makeLastStateJson`/`buildUploadBody`/`parseArgs`/`getEnvDefaults` 在 Task1 定义、Task2 引用，签名一致；`data/sync_watch` 常量在 Task1（buildUploadBody 用例）、Task2（SYNC_DIR）、Task3（白名单）三处一致。
- 已知风险：`checkReadable` 中 HEAD 回退逻辑有冗余分支，实现时按"HEAD ok → true；否则 GET 首字节判 200"简化即可（计划已提供可运行版本）。