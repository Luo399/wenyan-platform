# Figma 插件命名规范（Naming Convention）

> 本文件是美术与前端共同参照的唯一事实源。所有 Frame / 图层命名必须符合下表，插件据此决定资源类型与 OSS 路径，前端再据此消费。
> This file is the single source of truth shared by designers and frontend. All Frame / layer names MUST follow the rules below; the plugin derives asset type and OSS path from names, and the frontend consumes them accordingly.

---

## 1. 核心原则（Core Rules）

| # | 规则 | 说明 / English note |
|---|------|---------------------|
| 1 | **约定优于配置** | 命名即路径，无需额外配置文件。*Name equals path; no extra config.* |
| 2 | **区分大小写** | `Export Assets` 与 `export assets` 不同，必须完全一致。*Case-sensitive; must match exactly.* |
| 3 | **英文小写** | 图片文件一律 `.png` / `.svg` 等小写扩展名，路径小写。*Image paths and extensions are lower-case.* |
| 4 | **禁止空格与中文** | 图片路径不得含空格、中文、特殊符号；用 `_` 与 `/` 分隔。*Use `_` and `/` only; no spaces / Chinese / special chars in paths.* |
| 5 | **文字字段名** | 文字 JSON 字段名沿用 Figma 图层名（可含中文，如 `knowledge_text`）。*Text field keys reuse the layer name (may contain Chinese).* |

---

## 2. 图片资源（Image Assets）

### 2.1 Frame 结构（Frame Hierarchy）

```
Page 1
└── Export Assets（顶层 Frame，名称固定 / fixed top-level name）
    └── <OSS 目录>/（子 Frame，名称 = OSS 目录 / child Frame name = OSS dir）
        ├── <文件名>.png    （图层名 = 文件名 / layer name = filename）
        └── <文件名>.svg
```

### 2.2 命名规则（Naming Rules for Images）

| 项 | 规则 | 示例 | English note |
|----|------|------|--------------|
| 顶层 Frame | 固定为 `Export Assets` | `Export Assets` | Fixed name, mandatory |
| 子 Frame（目录） | `images/<module>/<article>/`，末尾可带 `/`（自动去除） | `images/general/`、`images/culture_cards/WEN_01/` | Child Frame → OSS dir |
| 图层（文件） | `{文件名}.{扩展名}`，扩展名 ∈ png/jpg/jpeg/gif/webp/svg | `home_bg.png`、`card_1.svg` | Layer → filename |
| 隐藏图层 | `visible = false` 自动跳过 | — | Hidden layers skipped |
| 非法类型 | TEXT/LINE/STAR/POLYGON 等不可导出类型跳过 | — | Non-exportable types skipped |

### 2.3 目录 → OSS 路径映射

| 子 Frame 名 | OSS 路径 | 备注 / Note |
|-------------|----------|-------------|
| `images/general/` | `images/general/<name>.png` | 全局资源：首页/登录背景、通用按钮等 |
| `images/cover/` | `images/cover/<name>.png` | 封面图 |
| `images/culture_cards/WEN_01/` | `images/culture_cards/WEN_01/<name>.png` | 某课文化卡片 |
| `images/screens/WEN_19/dialogue/` | `images/screens/WEN_19/dialogue/<name>.png` | 某课某场景子目录 |

---

## 3. 文字资源（Text Assets）

### 3.1 Frame 结构

```
Page 1
└── 文字资源_<路径>（顶层 Frame，前缀固定 / fixed prefix）
    ├── <字段名>         （TEXT 节点，name = JSON key）
    └── <子组名>/         （子 Frame，name = JSON 子对象 key）
        └── <子字段名>     （TEXT 节点）
```

### 3.2 命名规则

| 项 | 规则 | 示例 | English note |
|----|------|------|--------------|
| 顶层 Frame 前缀 | 固定以 `文字资源_` 开头 | `文字资源_culture_cards_WEN_01` | Fixed prefix |
| 文字字段节点 | TEXT 节点名 = JSON 字段 key | `knowledge_text`、`card_name` | Text node name → JSON key |
| 子 Frame | 子 Frame 名 = JSON 子对象 key，其下 TEXT 为嵌套字段 | `sub_data` → `{ "sub_data": {...} }` | Child Frame → nested object |

### 3.3 路径解析（Path Resolution）

| 命名形态 | 目标 OSS 路径 | 说明 / Note |
|----------|---------------|-------------|
| `文字资源_relative/path`（含 `/`） | `data/relative/path.json` | 新命名：剩余部分即相对目录。*New format with `/`.* |
| `文字资源_姓名`（不含 `/`） | `data/texts/文字资源_姓名.json` | 旧格式兼容。*Legacy compatibility.* |

#### 示例（Examples）

```
文字资源_culture_cards_WEN_01        → data/culture_cards/WEN_01.json
文字资源_论语·学而篇                 → data/texts/文字资源_论语·学而篇.json
文字资源_word_list_WEN_05            → data/word_list/WEN_05.json
文字资源_text_basic_info_WEN_05      → data/text_basic_info/WEN_05.json
```

---

## 4. 样式资源（Style Assets）

### 4.1 Frame 结构

```
Page 1
└── 样式_<路径>（顶层 Frame，前缀固定 / fixed prefix）
    ├── <图层>            （任意可见图层，path = 图层名）
    └── <子 Frame>
        └── <图层>         （path 用 / 连接层级，如 card/bg）
```

### 4.2 命名规则

| 项 | 规则 | 示例 | English note |
|----|------|------|--------------|
| 顶层 Frame 前缀 | 固定以 `样式_` 开头，前缀后不能为空 | `样式_Button` | Fixed prefix; empty remainder is skipped |
| 剩余部分 | 即 OSS 相对路径，`/` 分层，空格自动转 `_` | `样式_components/Button` | Remainder → path |
| 子图层 | **名称不参与路径以外的语义**，任意可见图层都会被提取样式 | — | Unlike text/image, layer names carry no field meaning |
| 同名图层 | 路径自动追加 `#nodeId` 去重 | `bg`、`bg#1:5` | Duplicate names get node-id suffix |
| 隐藏图层 | `visible = false` 自动跳过并计数 | — | Hidden layers skipped |
| 规模上限 | 单 Frame ≤ 300 节点 / 深度 ≤ 6 层，超限截断并置 `meta.truncated` | — | Capped to stay under the 500KB JSON limit |

### 4.3 路径解析（Path Resolution）

| 命名形态 | 目标 OSS 路径 | 说明 / Note |
|----------|---------------|-------------|
| `样式_Button` | `styles/Button.json` | 组件级样式 |
| `样式_components/Button` | `styles/components/Button.json` | 按模块分目录 |
| `样式_`（前缀后为空） | —（跳过并告警） | Empty remainder skipped |
| 文件内的本地共享样式 / 变量 | `styles/_shared.json` | 不由 Frame 命名决定，扫描时自动汇总 |

#### 示例（Examples）

```
样式_Button                    → styles/Button.json
样式_components/Button         → styles/components/Button.json
样式_pages/WEN_01/card         → styles/pages/WEN_01/card.json
样式_首页 Hero                 → styles/首页_Hero.json（空格转 _；路径仍建议用英文小写）
```

### 4.4 提取的样式参数（What Gets Extracted）

| 类别 | Figma 来源 | 产出的 CSS |
|------|-----------|-----------|
| 圆角 / 直角 | `cornerRadius`、`rectangleCornerRadii`、四角分属性 | `border-radius`；**直角记为 `0px`**，与"没读到"区分 |
| 颜色 | 纯色填充（0~1 RGB）、图层透明度 | `background-color`（不透明给 `#rrggbb`，半透明给 `rgba()`） |
| 渐变 | `GRADIENT_LINEAR/RADIAL/ANGULAR` 的 stops 与矩阵 | `background-image`（矩阵近似换算成角度；原矩阵留在 `raw`） |
| 描边 | `strokes` + `strokeWeight` + `strokeAlign` | `border`；`INSIDE` 追加 `box-sizing: border-box` |
| 效果 | `DROP_SHADOW` / `INNER_SHADOW` / `LAYER_BLUR` / `BACKGROUND_BLUR` | `box-shadow`（inset 区分）/ `filter` / `backdrop-filter` |
| 自动布局 | `layoutMode` / `itemSpacing` / `padding*` / 对齐枚举 / `layoutWrap` | `display: flex` + `flex-direction` / `gap` / `padding` / `justify-content` / `align-items` / `flex-wrap` |
| Grid 布局 | `layoutMode = GRID` + `gridRowGap` / `gridColumnGap` | `display: grid` + `row-gap` / `column-gap` |
| 文本 | `fontName` / `fontSize` / `fontWeight` / `letterSpacing` / `lineHeight` / 对齐 / `textCase` / `textDecoration` / 文字填充 | `font-family` / `font-size` / `font-weight` / `letter-spacing` / `line-height` / `text-align` / `text-transform` / `text-decoration-line` / `color` |
| 几何与混合 | `width` / `height` / `rotation` / `opacity` / `blendMode` / `isMask` | `width` / `height` / `transform` / `opacity` / `mix-blend-mode`；`isMask` 只留 `raw` |

**产物结构**（顺序固定，同输入必同字节——后端靠 MD5 做增量跳过）：

```jsonc
{
  "kind": "figma-style-tokens",
  "schema": 1,
  "source": { "frame": "样式_Button", "nodeId": "1:1", "page": "设计稿" },
  "meta": { "nodeCount": 3, "truncated": false, "hiddenSkipped": 1, "withRaw": true },
  "self":   { "path": "@frame", "css": { "border-radius": "0px" } },  // Frame 本体样式
  "tokens": { "color": [], "radius": [], "spacing": [], "shadow": [], "font": [] }, // 按使用节点数排序
  "nodes":  { "bg": { "nodeId": "1:2", "nodeType": "RECTANGLE", "css": {}, "raw": {} } }
}
```

- `css` = 可直接抄进样式表的声明块；`raw` = Figma 原值（0~1 浮点、枚举名、mixed 标记、渐变矩阵），用于精确复现与排查。
- 超出 480KB 时先整体去掉 `raw`（`meta.withRaw=false`），再按需要裁剪节点（`meta.truncated=true`）。
- `tokens` 是写 `design-tokens.css` 的原料：每项含 `value` / `count` / `usedBy`（最多 3 个来源路径）。

---

## 5. 图层 / 节点属性要求（Node/Attribute Requirements）

| 属性 | 要求 | English note |
|------|------|--------------|
| 图片图层可见性 | 必须 `visible != false` | Must be visible |
| 文字图层 | 必须为 `TEXT` 类型 | Must be TextNode |
| 图片文件命名 | 必须含合法扩展名，否则跳过 | Must include valid extension |
| JSON 字段顺序 | 按图层顺序输出，子组内递归 | Output order follows layer order |
| 样式图层 | 任意可见图层；`mixed`（逐字符不一致）只标记不猜值 | Mixed values are flagged, never guessed |

---

## 6. 前端消费路径对照（Frontend Consumption）

| 资源类型 | OSS 路径 | 前端取用方式 |
|----------|----------|--------------|
| 通用图片 | `images/general/xxx.png` | `getAssetUrl('images', 'xxx.png')` |
| 课文图片 | `images/screens/WEN_xx/...` | 按 `WEN_xx` + 场景拼地址 |
| 文字资源 | `data/<module>/WEN_xx.json` | 走 `utils/` / `useDataLoader` 封装加载 |
| 样式资源 | `styles/**/*.json`、`styles/_shared.json` | 人工/脚本对齐 `src/assets/styles/design-tokens.css`，不进运行时请求 |

> 404 排查提示：插件导出路径必须与前端 `getAssetUrl`/数据加载封装**逐字一致**（含大小写与目录层级）。
> Troubleshooting: plugin export paths MUST byte-for-byte match the frontend asset/data loader paths (case + hierarchy), otherwise assets 404.