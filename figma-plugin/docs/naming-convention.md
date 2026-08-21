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

## 4. 图层 / 节点属性要求（Node/Attribute Requirements）

| 属性 | 要求 | English note |
|------|------|--------------|
| 图片图层可见性 | 必须 `visible != false` | Must be visible |
| 文字图层 | 必须为 `TEXT` 类型 | Must be TextNode |
| 图片文件命名 | 必须含合法扩展名，否则跳过 | Must include valid extension |
| JSON 字段顺序 | 按图层顺序输出，子组内递归 | Output order follows layer order |

---

## 5. 前端消费路径对照（Frontend Consumption）

| 资源类型 | OSS 路径 | 前端取用方式 |
|----------|----------|--------------|
| 通用图片 | `images/general/xxx.png` | `getAssetUrl('images', 'xxx.png')` |
| 课文图片 | `images/screens/WEN_xx/...` | 按 `WEN_xx` + 场景拼地址 |
| 文字资源 | `data/<module>/WEN_xx.json` | 走 `utils/` / `useDataLoader` 封装加载 |

> 404 排查提示：插件导出路径必须与前端 `getAssetUrl`/数据加载封装**逐字一致**（含大小写与目录层级）。
> Troubleshooting: plugin export paths MUST byte-for-byte match the frontend asset/data loader paths (case + hierarchy), otherwise assets 404.