# 数据收集方案

## 一、现状分析（基于实际代码）

### 1.1 已完成的埋点基础设施

| 层级 | 文件 | 状态 |
|------|------|------|
| 前端核心工具 | `src/utils/tracking.ts` | 已完成 |
| Vue Composable | `src/composables/useTracking.ts` | 已完成 |
| 后端路由 | `POST /api/track` (routes/index.js) | 已完成 |
| 后端 Controller | `backend/src/controllers/trackingController.js` | 已完成 |
| 后端 Service | `backend/src/services/trackingService.js` | 已完成 |
| 数据库表 | `tracking_events` (database.js) | 已完成 |
| 数据库索引 | 6 个索引（event_type, user_id, session_id, step_id, timestamp） | 已完成 |

### 1.2 已定义的 5 种事件类型

所有事件统一通过 `POST /api/track` 发送，body 格式为 `{ events: [...] }`，每条事件包含：

```json
{
  "event_type": "step_enter | step_exit | interaction | search_word | quiz_submit",
  "user_id": "学号（登录态自动填充，未登录为空）",
  "session_id": "s_xxxx_xxxx（localStorage 持久化，跨标签页独立）",
  "step_id": "stepone_1 / steptwo_2 / detail_1 / home 等",
  "properties": { /* 不同事件类型携带不同字段 */ },
  "page_url": "/stepone/1",
  "timestamp": "2026-08-03T12:00:00.000Z"
}
```

### 1.3 各视图的埋点接入情况

| 视图文件 | 接入方式 | 自动事件 | 主动事件 | 实际调用情况 |
|---------|---------|---------|---------|------------|
| `HomeView.vue` | 手动 `track('step_enter', 'home', {})` | step_enter | 无 | 仅 onMounted 触发一次 |
| `DetailView.vue` | `useTracking('detail', articleId)` | step_enter / step_exit | 无 | 正常 |
| `RuleVideoView.vue` | `useTracking(props.navKey, poemId)` | step_enter / step_exit | trackInteraction | **解构但未调用** |
| `StepOneView.vue` | `useTracking('stepone', poemId)` | step_enter / step_exit | trackInteraction, trackSearchWord | **解构但未调用** |
| `StepTwoView.vue` | `useTracking('steptwo', poemId)` | step_enter / step_exit | trackQuizSubmit | 提交时正常调用 |
| `StepThreeView.vue` | `useTracking('stepthree', poemId)` | step_enter / step_exit | trackQuizSubmit | 提交时正常调用 |

### 1.4 关键发现

1. **`trackInteraction` 和 `trackSearchWord` 处于"解构未调用"状态**：`StepOneView.vue` 和 `RuleVideoView.vue` 虽然从 `useTracking()` 解构了这两个方法，但模板和脚本中没有任何地方实际调用它们。
2. **`step_enter` 和 `step_exit` 已自动覆盖 4 个视图**：通过 `onMounted`/`onUnmounted` 自动注入，无需手动调用。
3. **`quiz_submit` 已正常接入**：`StepTwoView` 和 `StepThreeView` 在提交答案时都会调用 `trackQuizSubmit`。
4. **`HomeView` 手动埋点**：仅触发 `step_enter`，没有 `step_exit`（因为首页是入口，不会 unmount）。
5. **后端无分析查询 API**：`trackingService.js` 虽提供了 `getEventsByType` 和 `getEventsBySession`，但未暴露到路由层，没有对应的分析看板。
6. **`session_id` 机制已就绪**：`tracking.ts` 已实现 `localStorage` 持久化 + `generateSessionId()` 惰性生成，`resetSessionId()` 已预留但未在登录/登出流程中调用。

---

## 二、数据收集方案（分阶段实施）

### 阶段一：补全前端埋点调用（修复"解构未调用"问题）

#### 2.1 StepOneView.vue —— 补全 interaction 和 search_word

**需要修改的文件**：`src/views/StepOneView.vue`

**需要补充的埋点位置**：

| 交互场景 | 调用方法 | 关键字段 |
|---------|---------|---------|
| 用户点击"朗读"播放按钮 | `trackInteraction('朗读', '播放', duration)` | module_type=朗读, action=播放, cost_time=实际播放时长 |
| 用户暂停朗读 | `trackInteraction('朗读', '暂停', costTime)` | action=暂停 |
| 用户点击字词卡片 | `trackInteraction('卡片', '翻转', 0)` | action=翻转 |
| 用户查询字词发音 | `trackSearchWord(word, true)` | word=查询的字词, is_audio=true |
| 用户查看字词释义 | `trackSearchWord(word, false)` | word=查询的字词, is_audio=false |

#### 2.2 RuleVideoView.vue —— 补全 interaction

**需要修改的文件**：`src/views/RuleVideoView.vue`

| 交互场景 | 调用方法 | 关键字段 |
|---------|---------|---------|
| 用户播放视频 | `trackInteraction('视频', '播放', 0)` | module_type=视频, action=播放 |
| 用户暂停视频 | `trackInteraction('视频', '暂停', currentTime)` | action=暂停, cost_time=当前播放位置 |
| 视频播放结束 | `trackInteraction('视频', '完成', duration)` | action=完成 |

#### 2.3 HomeView —— 补充退出事件

**需要修改的文件**：`src/views/HomeView.vue`

虽然首页不会 unmount，但用户点击进入 rules 或 detail 页面时，可在 `handleGoNext` 等导航函数中补充 `track('step_exit', 'home', { duration, next_step_id })`。

---

### 阶段二：后端分析 API（新增）

#### 2.4 新增 `trackingAnalysisController.js`

**文件路径**：`backend/src/controllers/trackingAnalysisController.js`

提供以下 API 端点：

| 端点 | 用途 | 查询逻辑 |
|------|------|---------|
| `GET /api/tracking/funnel` | 步骤漏斗分析 | 统计每个 step_id 的 `step_enter` 次数、`step_exit` 次数、退出率（有 enter 无 exit 的 session 占比） |
| `GET /api/tracking/interaction` | 模块交互渗透率 | 按 `module_type` 分组统计 `interaction` 事件次数，计算各模块的点击渗透率 |
| `GET /api/tracking/search-trend` | 字词查询趋势 | 按 `step_id` 统计 `search_word` 事件次数，按时间范围聚合，识别异常暴涨 |
| `GET /api/tracking/quiz-performance` | 闯关成绩分布 | 按 `step_id` 统计 `quiz_submit` 的得分均值、中位数、分布 |
| `GET /api/tracking/session-path` | 会话路径分析 | 按 `session_id` 聚合 `step_enter` 事件序列，统计后退次数、完整路径占比 |
| `GET /api/tracking/active-users` | 活跃用户统计 | 按 `user_id` 去重统计日活/周活 |

#### 2.5 核心 SQL 查询示例

**漏斗分析 SQL**：
```sql
-- 每个 step 的进入次数
SELECT step_id, COUNT(*) AS enter_count
FROM tracking_events
WHERE event_type = 'step_enter'
  AND timestamp >= ?
  AND timestamp <= ?
GROUP BY step_id
ORDER BY enter_count DESC;

-- 每个 step 的退出次数（有 exit 无后续 enter 的同 session）
SELECT e.step_id, COUNT(*) AS exit_count
FROM tracking_events e
WHERE e.event_type = 'step_exit'
  AND e.timestamp >= ?
  AND e.timestamp <= ?
  AND NOT EXISTS (
    SELECT 1 FROM tracking_events e2
    WHERE e2.session_id = e.session_id
      AND e2.event_type = 'step_enter'
      AND e2.id > e.id
  )
GROUP BY e.step_id;
```

**模块交互渗透率 SQL**：
```sql
SELECT
  step_id,
  JSON_EXTRACT(properties, '$.module_type') AS module_type,
  JSON_EXTRACT(properties, '$.action') AS action,
  COUNT(*) AS action_count
FROM tracking_events
WHERE event_type = 'interaction'
  AND timestamp >= ?
  AND timestamp <= ?
GROUP BY step_id, module_type, action
ORDER BY action_count DESC;
```

**字词查询异常诊断 SQL**：
```sql
SELECT
  step_id,
  JSON_EXTRACT(properties, '$.word') AS word,
  COUNT(*) AS query_count
FROM tracking_events
WHERE event_type = 'search_word'
  AND timestamp >= ?
  AND timestamp <= ?
GROUP BY step_id, word
HAVING query_count > (
  SELECT AVG(cnt) + 3 * STDDEV(cnt)
  FROM (
    SELECT COUNT(*) AS cnt
    FROM tracking_events
    WHERE event_type = 'search_word'
    GROUP BY step_id, JSON_EXTRACT(properties, '$.word')
  )
)
ORDER BY query_count DESC;
```

---

### 阶段三：埋点分析看板（前端）

#### 2.6 新增 `tracking-dashboard.html`

**文件路径**：`backend/public/tracking-dashboard.html`

参考现有 `dashboard.html` 的架构（纯 HTML + JS + CSS，无框架依赖），新增埋点分析看板，包含：

| 看板区域 | 展示内容 | 数据来源 |
|---------|---------|---------|
| 概览卡片 | 总上报事件数、活跃用户数（日/周）、平均停留时长 | `GET /api/tracking/funnel` + `GET /api/tracking/active-users` |
| 步骤漏斗图 | 各步骤的 enter → exit 转化率，标注退出率高的步骤 | `GET /api/tracking/funnel` |
| 模块交互热力图 | 各步骤中朗读/AI/卡片的交互次数，配色深浅表示渗透率 | `GET /api/tracking/interaction` |
| 字词查询排行榜 | 各 step 查询量最多的前 10 个字词，异常波动用红色标记 | `GET /api/tracking/search-trend` |
| 成绩分布直方图 | 各 step 的得分分布（0-59/60-79/80-100 区间） | `GET /api/tracking/quiz-performance` |
| 会话路径表 | 最近 100 条 session 的完整页面路径，标注后退次数 | `GET /api/tracking/session-path` |

---

### 阶段四：session_id 生命周期管理

#### 2.7 现有机制验证

当前 `tracking.ts` 中的 `session_id` 已满足"无固定终端"的核心需求：

- **生成**：`generateSessionId()` 在首次访问时生成，写入 `localStorage`
- **持久化**：每个请求自动携带，跨页面/跨标签页独立
- **重置**：`resetSessionId()` 已预留，但未在登录/登出时调用

#### 2.8 需要补充的改动

| 改动位置 | 改动内容 | 目的 |
|---------|---------|------|
| `src/stores/auth.ts`（登录成功处） | 登录成功后调用 `resetSessionId()` | 切割会话：不同用户登录产生新的 session_id |
| `src/stores/auth.ts`（登出处） | 登出时调用 `resetSessionId()` | 切割会话：切换用户时重置 |
| `src/utils/tracking.ts` | 在 `getSessionId()` 中补充 `user_id` 变化检测 | 同 localStorage 但 user_id 变化时自动重置 |

---

## 三、数据质量保障措施

### 3.1 失焦剔除（停留时长精确性）

当前 `step_exit` 的 `duration` 计算方式：
```ts
// useTracking.ts
onUnmounted(() => {
  const duration = Date.now() - enterTimestamp.value
  track('step_exit', stepId, { duration, next_step_id: nextStepId.value })
})
```

**问题**：如果用户切换到其他标签页（页面未 unmount），`duration` 会包含失焦时间，导致停留时长虚高。

**改进方案**：在 `tracking.ts` 中监听 `visibilitychange` 事件，记录失焦/聚焦时间差，在 `step_exit` 时从 `duration` 中扣除失焦时长。

```ts
// 在 tracking.ts 中补充
let _totalBlurTime = 0
let _blurStart = 0

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    _blurStart = Date.now()
  } else if (_blurStart > 0) {
    _totalBlurTime += Date.now() - _blurStart
    _blurStart = 0
  }
})
```

### 3.2 事件去重

为避免同一事件因网络重试被重复记录，前端对同一事件的 `step_id` + `timestamp` + `event_type` 做 MD5 签名，服务端检查重复。

### 3.3 限流保护

`POST /api/track` 已无鉴权，需加限流：

```js
// 在 routes/index.js 中
app.post('/api/track', rateLimit({ windowMs: 60 * 1000, max: 300 }), trackingController.track)
```

单 IP 每分钟最多 300 条事件（正常用户每分钟埋点事件数通常 < 50），防止恶意刷库。

---

## 四、预期效果

### 4.1 数据收集规模预估

| 事件类型 | 每次触发次数 | 日均数据量（假设 100 活跃用户） |
|---------|------------|------------------------------|
| step_enter | 用户每次进入页面 | ~500 条/天 |
| step_exit | 用户每次离开页面 | ~500 条/天 |
| interaction | 每次播放/翻转/点击 | ~2000 条/天 |
| search_word | 每次字词查询 | ~500 条/天 |
| quiz_submit | 每次闯关提交 | ~200 条/天 |
| **合计** | | **~3700 条/天** |

SQLite 对 `tracking_events` 表的写入性能在 WAL 模式下可支撑 10 万+ 条/天，完全满足当前规模。

### 4.2 分析能力

| 分析维度 | 解决的问题 |
|---------|-----------|
| 步骤漏斗 | 发现哪个步骤退出率最高，定位教学流程的瓶颈 |
| 模块交互渗透率 | 了解 AI 对话、卡片、朗读等功能的实际使用率 |
| 字词查询趋势 | 某篇古文查询量异常暴涨 → 讲解不够清晰，需优化 |
| 成绩分布 | 各步骤的难易程度是否合理，是否需要调整测验 |
| 会话路径 | 用户是否频繁后退、是否跳步，评估导航设计 |
| 活跃用户 | 日活/周活趋势，评估平台运营效果 |

---

## 五、实施路线图

| 阶段 | 内容 | 预计工作量 | 优先级 |
|------|------|-----------|--------|
| 一 | 补全前端埋点调用（StepOneView, RuleVideoView, HomeView） | 小 | P0 |
| 二 | 后端分析 API（trackingAnalysisController + 路由注册） | 中 | P0 |
| 三 | 埋点分析看板（tracking-dashboard.html） | 中 | P1 |
| 四 | session_id 生命周期管理 + 失焦剔除 | 小 | P1 |
| 五 | 数据质量：去重、限流、监控告警 | 小 | P2 |