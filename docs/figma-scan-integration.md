# Figma 扫描资产接入说明（2026-10-29）

## 一、结论

Figma 插件扫描并上传到 OSS 的 `images/screens/**` 已经进入前端消费链路：

- **目录层**：`src/config/figmaScreenCatalog.ts` 把生产 OSS 清单里的 6,049 个扫描文件
  折叠成 37 篇课文、775 条「篇目 × 角色」记录；
- **读取层**：`src/config/figmaAssets.ts` 提供 `getWenScreenTitleUrl()` /
  `getWenScreenRoleUrl()` / `getWenScreenOptionUrl()` / `getWenScreenTextBoxUrl()` /
  `getWenScreenAvatarUrl()` / `getWenScreenCharacterCardUrl()`，全部走
  `VITE_OSS_BASE_URL/images/screens/...`，不经过后端；
- **渲染层**：课文详情页标题、测验选项底图已经直接显示扫描图；
- **兜底**：图片 `@error` 时回退文字或纯 CSS，目录未登记的篇目不会 404 白屏。

生产桶实测（HEAD 200）：

```
WEN_01/explanation/article_title_01_01.png
WEN_02/summary/article_title_WEN_02.png
WEN_02/quiz/option_a_01.png
WEN_02/quiz/btn_next.png
```

## 二、已接入的位置

| 位置 | 角色 | OSS 路径示例 | 体积 |
| --- | --- | --- | --- |
| `DetailView` 课文标题 | `title` | `images/screens/WEN_02/summary/article_title_WEN_02.png` | 17–29KB |
| `AdaptQuiz` 选项 A–D 底图 | `options.A–D` | `images/screens/WEN_02/quiz/option_a_01.png` | 4–10KB |

`DetailView` 在有标题图时把 `h1` 收进 `.sr-only`，读屏与 SEO 仍能拿到篇名；
图片加载失败则恢复可见的文字标题。

## 三、目录为什么折叠

插件按组件切图，同一篇课文在不同页面里重复上传同一张图。例如 WEN_02 的
`article_title_WEN_02_*.png` 有 11 份，WEN_01 的 `btn_back_*.png` 有 32 份。
浏览器不能列 OSS 目录，所以生成脚本按角色保留一张：

- 标题图优先「无页码后缀」的整篇版本，否则取页码最小的一张；
- 按钮/文本框取无后缀或 `_01`；
- 头像、立绘、背景按角色名归档（`avatar_chen_sheng`、`bg_war` 等），每类一张；
- 每条记录保留 OSS 原始路径与字节数，便于判断能不能直接上屏。

重新生成（扫描清单来自 `GET https://api.classicalab.cn/api/assets/oss-list`）：

```bash
curl -s https://api.classicalab.cn/api/assets/oss-list -o oss-list.json
node scripts/gen-figma-screen-catalog.mjs oss-list.json
```

## 四、暂不直接渲染的素材及原因

不是遗漏，是当前桶不具备条件：

- **场景背景 / 文章背景**（`bg_*`、`article_bg`，单张 2.8–18MB）：直接上屏会把首屏拖到几十 MB，
  且该桶**未开启 OSS 图片处理**，`?x-oss-process=image/resize` 参数实测无效；
  需要先在本地用 sharp 生成 WebP 衍生图再上传到新前缀。
- **角色立绘**（`avatar_*`，单张 0.4–3MB）：同样需要衍生图；另外对话组件的 `icon_dialog` 目前全空，
  发言人中文名到 `avatar_<拼音>` 的映射还没有事实源。
- **按钮/提交/完成图**（13–22KB，但文字已烘焙进图）：换成图片会与现有按钮文案重复，
  作为纯装饰反而不如现有 CSS 清晰。
- **`card_bamboo`**（6080×3420，20.8MP）：单张 282KB 但解码内存高，对话卡片不适合逐张铺。
- **`summary_text_box` / `proverb_text_box`**（4K×900）：目录已登记，但当前没有独立的总结页组件消费，
  等总结页 schema 定下来再接。

## 五、扩展方式

新增消费点时不需要再写路径拼接：

```ts
import { getWenScreenRoleUrl, getWenScreenCharacterCardUrl } from '@/config/figmaAssets'

const nextBtn = getWenScreenRoleUrl('WEN_02', 'btnNext') // string | null
const chenSheng = getWenScreenCharacterCardUrl('WEN_02', 'chen_sheng')
```

- 组件拿到 `null` 时必须回退 CSS 或文字，不允许把 `null` 拼进 `url()`；
- 不要新增 `fetch('/images/screens/...')` 或列目录逻辑；
- 重新扫描后只更新目录文件，不动消费组件。
