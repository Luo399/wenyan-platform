/**
 * 文言文预习平台 - Figma 资源同步插件
 *
 * 架构说明：
 *   - 通用组件文件：一个 Figma 文件，Export Assets 内放 images/general/ 等全局资源
 *   - 按课文分文件：每个课文一个 Figma 文件，每个文件包含 Export Assets + 文字资源_ Frame
 *   - 插件通用：同一个插件可在任意课文/通用文件中使用
 *
 * 功能：
 * 1. 扫描当前文件顶层 Frame：Export Assets（图片）和 文字资源_（文字）
 * 2. 子 Frame 命名决定 OSS 路径，导出 PNG/SVG
 * 3. 读取文字资源 TextNode.characters 生成 JSON
 * 4. 提取视觉属性：颜色、字体、边框、圆角、尺寸等
 * 5. 显示变更列表，发送到后端 API
 *
 * 使用方式：
 *   在 Figma 中打开任意课文文件/通用文件 → 运行插件 → 自动扫描 → 确认同步
 *
 * OSS 路径规则（与现有生产前端消费路径对齐）：
 *   - 图片：Export Assets → 子 Frame 名即为 OSS 路径（如 images/culture_cards/WEN_01/card_1.png）
 *   - 文字：文字资源_{标题} Frame → data/text_basic_info/<WEN>.json + data/word_list/<WEN>.json
 *   - 样式：styles/{Frame名}.json
 *   - 版本：version.json（sync_time / files / placeholders）
 */

// ============ 日志工具 ============
// 在 Figma 中通过 Plugins → Development → Open Console 查看日志
const LOG_PREFIX = '[文言文同步]'

function logDebug(...args: any[]) {
  console.log(LOG_PREFIX, '[调试]', ...args)
}

function logInfo(...args: any[]) {
  console.log(LOG_PREFIX, '[信息]', ...args)
}

function logWarn(...args: any[]) {
  console.warn(LOG_PREFIX, '[警告]', ...args)
}

function logError(...args: any[]) {
  console.error(LOG_PREFIX, '[错误]', ...args)
}

// 后端 API 地址（可在插件 UI 中配置）
const DEFAULT_API_BASE = 'https://api.classicalab.cn'

// 导出超时时间（毫秒）：单个资源导出超过 30 秒视为失败
const EXPORT_TIMEOUT_MS = 30000

// ============ 错误码定义 ============
// 错误码系统：用于统一标识和排查插件运行时错误
// 错误码 1：net::ERR_FAILED - 后端 API 不可达或返回 502/503
//   触发场景：生产环境 API 服务宕机或网络不可达，所有上传请求均失败
//   排查方向：检查后端服务是否正常运行（pm2 status），检查 API 域名 DNS 解析
// 错误码 2：API 域名不在 manifest.json allowedDomains 中
//   触发场景：Figaa 安全策略拦截了向未声明域名的请求
//   排查方向：将 API 域名添加到 manifest.json 的 networkAccess.allowedDomains
const ERROR_CODES = {
  /** 错误码 1：后端 API 不可达（net::ERR_FAILED / 502 / 503） */
  API_UNREACHABLE: { code: 1, label: 'API_UNREACHABLE', message: '后端 API 不可达' },
  /** 错误码 2：API 域名不在 manifest.json allowedDomains 中 */
  DOMAIN_NOT_ALLOWED: { code: 2, label: 'DOMAIN_NOT_ALLOWED', message: 'API 域名不在 allowedDomains 白名单中' },
  /** 错误码 3：请求超时（超过 FETCH_TIMEOUT_MS） */
  REQUEST_TIMEOUT: { code: 3, label: 'REQUEST_TIMEOUT', message: '网络请求超时' },
  /** 错误码 4：上传数据校验失败（后端返回 400 校验错误） */
  VALIDATION_FAILED: { code: 4, label: 'VALIDATION_FAILED', message: '上传数据校验失败' },
  /** 错误码 5：Figma 节点导出失败 */
  NODE_EXPORT_FAILED: { code: 5, label: 'NODE_EXPORT_FAILED', message: 'Figma 节点导出失败' },
  /** 错误码 6：未知错误 */
  UNKNOWN: { code: 6, label: 'UNKNOWN', message: '未知错误' },
  /**
   * 错误码 7：接口不存在 / 无权限（后端返回 404/403）
   * 触发场景：后端未部署该路由、或部署的是旧版本后端、或接口被权限策略拦截
   * 排查方向：确认后端已部署最新代码；测试环境常见于只部署了前端未部署后端新接口
   */
  ENDPOINT_NOT_FOUND: { code: 7, label: 'ENDPOINT_NOT_FOUND', message: '接口不存在或无访问权限（HTTP 404/403）' },
} as const

/**
 * 根据错误信息推断错误码
 * 通过关键词匹配识别已知错误类型
 */
function inferErrorCode(err: unknown): number {
  const msg = String(err)
  if (/Failed to fetch|net::ERR_FAILED|502|503/.test(msg)) return ERROR_CODES.API_UNREACHABLE.code
  if (/not in the list of allowed domains|allowedDomains/.test(msg)) return ERROR_CODES.DOMAIN_NOT_ALLOWED.code
  if (/404|403/.test(msg)) return ERROR_CODES.ENDPOINT_NOT_FOUND.code
  if (/超时|timeout|AbortError/.test(msg)) return ERROR_CODES.REQUEST_TIMEOUT.code
  if (/400|VALIDATION|校验|不合法/.test(msg)) return ERROR_CODES.VALIDATION_FAILED.code
  if (/导出失败|exportAsync|exportSingleNode/.test(msg)) return ERROR_CODES.NODE_EXPORT_FAILED.code
  return ERROR_CODES.UNKNOWN.code
}

/**
 * 获取错误码对应的描述信息
 */
function getErrorCodeInfo(code: number): { code: number; label: string; message: string } {
  for (const key of Object.keys(ERROR_CODES)) {
    const ec = (ERROR_CODES as any)[key]
    if (ec.code === code) return ec
  }
  return ERROR_CODES.UNKNOWN
}

// 资源类型枚举
const ASSET_TYPE = {
  IMAGE: 'image',
  TEXT: 'text',
  STYLE: 'style',
}

// 扫描结果
interface AssetItem {
  ossPath: string
  fileName: string
  type: string
  nodeId: string
  // 文本内容（仅文字资源）
  content?: string
  // 图片二进制数据（仅图片资源，由 code.ts 导出后发往 UI 线程上传）
  data?: Uint8Array
  // 样式属性（仅样式资源）
  styleData?: Record<string, any>
  // 变更状态（placeholder 表示缺失资源生成的占位符）
  status: 'new' | 'changed' | 'unchanged' | 'placeholder'
}

/** 扫描阶段：当前正在进行的扫描类型 */
type ScanPhase = 'scanning' | 'exporting' | 'idle'

/**
 * 带超时的 Promise 包装器
 * 如果指定时间内未完成，则 reject
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`操作超时: ${label} (超过 ${ms}ms)`))
    }, ms)
    promise.then(
      (val) => {
        clearTimeout(timer)
        resolve(val)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

/**
 * 提取节点视觉属性：颜色、字体、边框、圆角、尺寸等
 * 跳过视频和音频节点
 */
function extractNodeStyle(node: SceneNode): Record<string, any> {
  const style: Record<string, any> = {
    nodeId: node.id,
    nodeName: node.name,
    nodeType: node.type,
    visible: node.visible,
    locked: node.locked,
    // 位置与尺寸
    x: 'x' in node ? (node as any).x : undefined,
    y: 'y' in node ? (node as any).y : undefined,
    width: 'width' in node ? (node as any).width : undefined,
    height: 'height' in node ? (node as any).height : undefined,
    rotation: 'rotation' in node ? (node as any).rotation : undefined,
    opacity: 'opacity' in node ? (node as BlendMixin).opacity : undefined,
  }

  // 清理 undefined 值
  for (const key of Object.keys(style)) {
    if (style[key] === undefined) delete style[key]
  }

  // 填充颜色（仅读取 solid 类型的纯色）
  if ('fills' in node) {
    const fills = (node as GeometryMixin).fills
    if (fills && typeof fills !== 'symbol') {
      style.fills = (fills as Paint[])
        .map((f) => {
          const fill: Record<string, any> = { type: f.type, visible: f.visible, opacity: f.opacity }
          if (f.type === 'SOLID' && 'color' in f) {
            fill.color = f.color
            // RGB 百分比转十六进制
            fill.hex = rgbToHex(f.color.r, f.color.g, f.color.b)
          }
          return fill
        })
        .filter((f) => f.visible !== false)
    }
  }

  // 描边
  if ('strokes' in node) {
    const strokes = (node as GeometryMixin).strokes as Paint[]
    if (strokes && strokes.length > 0) {
      style.strokes = strokes
        .map((s) => {
          const stroke: Record<string, any> = { type: s.type, visible: s.visible }
          if (s.type === 'SOLID' && 'color' in s) {
            stroke.color = s.color
            stroke.hex = rgbToHex(s.color.r, s.color.g, s.color.b)
          }
          return stroke
        })
        .filter((s) => s.visible !== false)
    }
  }

  // 描边宽度
  if ('strokeWeight' in node) {
    const sw = (node as GeometryMixin).strokeWeight
    if (sw !== figma.mixed) {
      style.strokeWeight = sw
    }
  }

  // 描边对齐
  if ('strokeAlign' in node) {
    style.strokeAlign = (node as GeometryMixin).strokeAlign
  }

  // 约束（缩放/固定）
  if ('constraints' in node) {
    style.constraints = (node as ConstraintMixin).constraints
  }

  // 圆角
  if ('cornerRadius' in node) {
    const cr = (node as any).cornerRadius
    if (typeof cr === 'number') {
      style.cornerRadius = cr
    }
  }

  if ('topLeftRadius' in node) {
    const r = node as RectangleCornerMixin
    if (r.topLeftRadius !== undefined) {
      style.cornerRadii = {
        topLeft: r.topLeftRadius,
        topRight: r.topRightRadius,
        bottomRight: r.bottomRightRadius,
        bottomLeft: r.bottomLeftRadius,
      }
    }
  }

  // 效果（阴影、模糊等）
  if ('effects' in node) {
    const effects = (node as BlendMixin).effects
    if (effects && effects.length > 0) {
      style.effects = effects
        .map((e) => {
          const effect: Record<string, any> = { type: e.type, visible: e.visible }
          // radius 存在于部分效果类型
          if ('radius' in e) effect.radius = (e as any).radius
          // 阴影偏移和颜色
          if (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') {
            const shadow = e as DropShadowEffect
            effect.offset = { x: shadow.offset.x, y: shadow.offset.y }
            effect.color = shadow.color
          }
          return effect
        })
        .filter((e) => e.visible !== false)
    }
  }

  // 自动布局
  if ('layoutMode' in node) {
    const autoLayout = node as AutoLayoutMixin
    style.layoutMode = autoLayout.layoutMode
    if (autoLayout.layoutMode !== 'NONE') {
      style.paddingLeft = autoLayout.paddingLeft
      style.paddingRight = autoLayout.paddingRight
      style.paddingTop = autoLayout.paddingTop
      style.paddingBottom = autoLayout.paddingBottom
      style.itemSpacing = autoLayout.itemSpacing
      style.primaryAxisAlignItems = autoLayout.primaryAxisAlignItems
      style.counterAxisAlignItems = autoLayout.counterAxisAlignItems
      // 补充：主轴/交叉轴尺寸模式（固定/自适应）
      style.primaryAxisSizingMode = autoLayout.primaryAxisSizingMode
      style.counterAxisSizingMode = autoLayout.counterAxisSizingMode
      // 补充：最小/最大宽高限制（通过 any 访问，Figma 类型定义可能不全）
      const anyNode = autoLayout as any
      style.minWidth = anyNode.minWidth
      style.maxWidth = anyNode.maxWidth
      style.minHeight = anyNode.minHeight
      style.maxHeight = anyNode.maxHeight
    }
  }

  // 混合模式
  if ('blendMode' in node) {
    style.blendMode = (node as BlendMixin).blendMode
  }

  // 裁切内容
  if ('clipsContent' in node) {
    style.clipsContent = (node as any).clipsContent
  }

  // 单独描边宽度（左/右/上/下）
  if ('strokeTopWeight' in node) {
    const sw = node as IndividualStrokesMixin
    style.strokeWeights = {
      top: sw.strokeTopWeight,
      right: sw.strokeRightWeight,
      bottom: sw.strokeBottomWeight,
      left: sw.strokeLeftWeight,
    }
  }

  // 文本属性
  if (node.type === 'TEXT') {
    const textNode = node as TextNode
    // 字号（可能为混合值）
    const fontSize = textNode.getRangeFontSize(0, 1)
    if (fontSize !== figma.mixed) style.fontSize = fontSize

    // 字体名称
    const fontName = textNode.getRangeFontName(0, 1)
    if (fontName !== figma.mixed) {
      style.fontFamily = fontName.family
      style.fontStyle = fontName.style
    }

    // 字重
    const fontWeight = textNode.getRangeFontWeight(0, 1)
    if (fontWeight !== figma.mixed) style.fontWeight = fontWeight

    // 行高
    const lineHeight = textNode.getRangeLineHeight(0, 1)
    if (lineHeight !== figma.mixed) {
      style.lineHeight = lineHeight
    }

    // 字间距
    const letterSpacing = textNode.getRangeLetterSpacing(0, 1)
    if (letterSpacing !== figma.mixed) {
      style.letterSpacing = letterSpacing
    }

    // 文本对齐
    style.textAlignHorizontal = textNode.textAlignHorizontal
    style.textAlignVertical = textNode.textAlignVertical

    // 文本颜色
    const textFills = textNode.getRangeFills(0, 1)
    if (textFills !== figma.mixed && textFills.length > 0) {
      style.textFills = textFills.map((f) => {
        const fill: Record<string, any> = { type: f.type }
        if (f.type === 'SOLID' && 'color' in f) {
          fill.color = f.color
          fill.hex = rgbToHex(f.color.r, f.color.g, f.color.b)
        }
        return fill
      })
    }

    // 文本自动尺寸调整（宽度/高度行为）
    style.textAutoResize = textNode.textAutoResize

    // 文本装饰（下划线/删除线）
    const textDecoration = textNode.getRangeTextDecoration(0, 1)
    if (textDecoration !== figma.mixed) {
      style.textDecoration = textDecoration
    }

    // 文本大小写
    const textCase = textNode.getRangeTextCase(0, 1)
    if (textCase !== figma.mixed) {
      style.textCase = textCase
    }

    // 段落间距
    const paragraphSpacing = textNode.getRangeParagraphSpacing(0, 1)
    if (paragraphSpacing !== figma.mixed && paragraphSpacing !== 0) {
      style.paragraphSpacing = paragraphSpacing
    }

    // 段落缩进
    const paragraphIndent = textNode.getRangeParagraphIndent(0, 1)
    if (paragraphIndent !== figma.mixed && paragraphIndent !== 0) {
      style.paragraphIndent = paragraphIndent
    }

    // 列表间距
    const listSpacing = textNode.getRangeListSpacing(0, 1)
    if (listSpacing !== figma.mixed && listSpacing !== 0) {
      style.listSpacing = listSpacing
    }

    // 悬挂标点（Figma API 类型为 boolean，运行时值可能为字符串）
    const hangingPunct = (textNode as any).hangingPunctuation
    if (hangingPunct && hangingPunct !== 'NONE') {
      style.hangingPunctuation = hangingPunct
    }

    // 连字符（Figma API 类型未直接暴露，尝试通过 any 访问）
    const anyTextNode = textNode as any
    if (anyTextNode.getRangeHyphenation) {
      const hyphenation = anyTextNode.getRangeHyphenation(0, 1)
      if (hyphenation !== figma.mixed) {
        style.hyphenation = hyphenation
      }
    }
  }

  return style
}

/**
 * RGB 0-1 值转十六进制颜色字符串
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * 已知前端组件名清单（占位符判断 & 未知组件提示的依据）
 * 前端已定义的组件，新增组件时需要在此登记，否则同步时给出提示。
 */
const KNOWN_COMPONENTS: string[] = ['Navigation']

// ============ 篇目映射（标题 → WEN_xx） ============
// 与前端 src/utils/wenUtils.ts 的 poemMap 保持一致（37 篇部编版顺序）
// 插件通过文字资源 Frame 名（去掉"文字资源_"前缀 = 标题）反推 wenId
const TITLE_TO_WEN_ID: Record<string, string> = {
  陈涉世家: 'WEN_01',
  马说: 'WEN_02',
  岳阳楼记: 'WEN_03',
  庄子与惠子: 'WEN_04',
  论语十二章: 'WEN_05',
  诫子书: 'WEN_06',
  陋室铭: 'WEN_07',
  爱莲说: 'WEN_08',
  孟子三章: 'WEN_09',
  虽有嘉肴: 'WEN_10',
  大道之行: 'WEN_11',
  鱼我所欲也: 'WEN_12',
  送东阳马生序: 'WEN_13',
  出师表: 'WEN_14',
  三峡: 'WEN_15',
  答谢中书书: 'WEN_16',
  记承天寺夜游: 'WEN_17',
  与朱元思书: 'WEN_18',
  桃花源记: 'WEN_19',
  小石潭记: 'WEN_20',
  核舟记: 'WEN_21',
  醉翁亭记: 'WEN_22',
  湖心亭看雪: 'WEN_23',
  孙权劝学: 'WEN_24',
  卖油翁: 'WEN_25',
  周亚夫军细柳: 'WEN_26',
  唐雎不辱使命: 'WEN_27',
  曹刿论战: 'WEN_28',
  邹忌讽齐王纳谏: 'WEN_29',
  穿井得一人: 'WEN_30',
  杞人忧天: 'WEN_31',
  愚公移山: 'WEN_32',
  北冥有鱼: 'WEN_33',
  咏雪: 'WEN_34',
  陈太丘与友期行: 'WEN_35',
  狼: 'WEN_36',
  活板: 'WEN_37',
}

/** 提取标题 → wenId；未收录返回空串 */
function resolveWenIdByTitle(title: string): string {
  return TITLE_TO_WEN_ID[title] || ''
}

/** 是否属于 01-04 已在生产上线的篇目（用于保护现网文件不被覆盖） */
function isLegacyWenId(wenId: string): boolean {
  const seq = Number(wenId.replace('WEN_', ''))
  return seq >= 1 && seq <= 4
}

// ============ 文字/词表文件名约定 ============
// 与现有生产前端对齐（src/composables/useDataLoader 消费路径）：
//   data/text_basic_info/<WEN>.json   课文基础信息（text_id/title/author/dynasty/original_text）
//   data/word_list/<WEN>.json         课文字词列表（text_id/word/basic_meaning/follow_up_questions）
const DATA_DIR_TEXT_BASIC_INFO = 'data/text_basic_info'
const DATA_DIR_WORD_LIST = 'data/word_list'

/** 文字资源 Frame 内的固定字段节点命名（美术按此组织，勿改名） */
const TEXT_FRAME_NAMES = {
  ORIGINAL: '原文', // 课文原文
  AUTHOR: '作者', // 作者（新版本结构：美术在 Frame 内新增）
  DYNASTY: '朝代', // 朝代（新版本结构：美术在 Frame 内新增）
  WORD: '词', // 注释词组
  GLOSS: '注释', // 注释解释
}

// ============ 预期资源清单与占位符 ============
/** 1x1 白色 PNG（占位图），base64 编码，用于缺失资源 */
const PLACEHOLDER_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

/**
 * 预期图片清单（占位符判断依据）
 *
 * 与现有生产前端 `getAssetUrl('images', fileName)` 的 `images/*` 路径约定对齐：
 *   - 通用页面图：home_bg / home_title / login_bg（HomeView / LoginView 引用）
 *   - 每篇配图背景：WEN_xx_illus_bg.png（对应 text_basic_info 的 illustration 字段）
 *
 * 范围只覆盖「通用资源 + WEN_05~WEN_37」；WEN_01~04 为生产已上线篇目，
 * 现网文件已存在，绝不作占位（buildVersionAndPlaceholders 中另有 isLegacyKey 兜底）。
 * 若某篇新增自定义图片（如对话图标），请在 FIXED_IMAGE_KEYS 中追加。
 */
const FIXED_IMAGE_KEYS: string[] = [
  'images/home_bg.png',
  'images/home_title.png',
  'images/login_bg.png',
]
const START_WEN_SEQ = 5
const END_WEN_SEQ = 37

/** 动态生成 通用 + WEN_05~WEN_37 的预期图片 key（避免硬编码 33 行） */
function buildExpectedImageKeys(): string[] {
  const keys: string[] = [...FIXED_IMAGE_KEYS]
  for (let seq = START_WEN_SEQ; seq <= END_WEN_SEQ; seq++) {
    const wenId = `WEN_${String(seq).padStart(2, '0')}`
    keys.push(`images/${wenId}_illus_bg.png`)
  }
  return keys
}

const EXPECTED_IMAGE_KEYS: string[] = buildExpectedImageKeys()

/** base64 字符串解码为 Uint8Array */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * 生成缺失资源的占位符资产 + 汇总 version.json
 *
 * 说明：01-04 为生产已上线篇目，其文件已在 OSS 上存在，绝不对其生成占位图覆盖。
 * EXPECTED_IMAGE_KEYS 清单只覆盖「通用资源 + WEN_05~WEN_37」。
 *
 * @param scanned - 已扫描到的所有资产
 * @returns { assets, placeholders } placeholders 为缺失的图片占位资产列表
 */
function buildVersionAndPlaceholders(
  scanned: AssetItem[],
): { placeholders: AssetItem[] } {
  // 收集已存在图片的 OSS Key
  const scannedImageKeys = new Set(
    scanned.filter((a) => a.type === ASSET_TYPE.IMAGE).map((a) => a.ossPath),
  )

  // 是否属于 01-04 的 OSS Key（如 images/culture_cards/WEN_01/xxx.png）
  const isLegacyKey = (key: string): boolean =>
    /\/WEN_0[1-4]\//.test(key)

  const placeholders: AssetItem[] = []
  for (const key of EXPECTED_IMAGE_KEYS) {
    if (isLegacyKey(key)) {
      logWarn(`[占位] "${key}" 命中 01-04 已上线篇目，跳过占位以免覆盖现网文件`)
      continue
    }
    if (!scannedImageKeys.has(key)) {
      const fileName = key.split('/').pop() || `${key.replace(/\//g, '_')}.png`
      placeholders.push({
        ossPath: key,
        fileName,
        type: ASSET_TYPE.IMAGE,
        nodeId: '',
        data: base64ToUint8Array(PLACEHOLDER_PNG_BASE64),
        status: 'placeholder',
      })
      logWarn(`[占位] 缺失资源 "${key}"，将上传占位图`)
    }
  }

  return { placeholders }
}

/**
 * 生成 version.json 资产（新格式：sync_time / files / placeholders）
 *
 * @param allAssets - 全部待同步资产（含占位符）
 */
function buildVersionAsset(allAssets: AssetItem[]): AssetItem {
  const files = allAssets
    .filter((a) => a.status !== 'placeholder')
    .map((a) => ({ key: a.ossPath, type: a.type }))
  const placeholders = allAssets
    .filter((a) => a.status === 'placeholder')
    .map((a) => ({ key: a.ossPath, reason: 'missing' }))

  const content = JSON.stringify(
    { sync_time: new Date().toISOString(), files, placeholders },
    null,
    2,
  )

  return {
    ossPath: 'version.json',
    fileName: 'version.json',
    type: ASSET_TYPE.TEXT,
    nodeId: '',
    content,
    status: 'new',
  }
}

/**
 * 扫描样式资源（适用于 样式_{组件} 顶层 Frame）
 *
 * 结构约定：
 *   样式_Navigation（顶层 Frame，组件名 = 去掉 "样式_" 前缀）
 *   ├── Default（状态 Frame，必选）
 *   │   ├── Background（图层，背景色）
 *   │   ├── Text（TEXT，文字样式）
 *   │   └── Icon（图层，图标）
 *   ├── Active（状态 Frame，可选）
 *   └── Hover（可选）
 *
 * 产出（OSS: styles/{组件名}.json）：
 *   { "component": "Navigation", "states": { "default": {...}, "active": {...} } }
 */
function scanStyleFrames(page: PageNode): AssetItem[] {
  const assets: AssetItem[] = []
  logDebug('scanStyleFrames: 扫描 样式_ 顶层 Frame')

  // 只扫描以 "样式_" 开头的顶层 Frame
  const styleFrames = page.findAll(
    (node) => node.type === 'FRAME' && node.name.startsWith('样式_'),
  ) as FrameNode[]

  logInfo(`找到 ${styleFrames.length} 个样式 Frame: ${styleFrames.map((f) => f.name).join(', ')}`)

  for (const frame of styleFrames) {
    const componentName = frame.name.replace(/^样式_/, '').replace(/\/+$/, '')
    const states: Record<string, any> = {}

    // 遍历直接子 Frame，子 Frame 名称即状态名
    for (const child of frame.children || []) {
      if (child.type !== 'FRAME') continue
      states[child.name] = extractStateStyle(child)
      logDebug(`  [状态] "${child.name}" for "${componentName}"`)
    }

    // 未知组件提示：前端未定义该组件时警告
    if (!KNOWN_COMPONENTS.includes(componentName)) {
      logWarn(
        `组件 "${componentName}" 前端未定义（KNOWN_COMPONENTS 中不存在），请确认是否新增组件`,
      )
    }

    const content = JSON.stringify({ component: componentName, states }, null, 2)
    assets.push({
      ossPath: `styles/${componentName}.json`,
      fileName: `${componentName}.json`,
      type: ASSET_TYPE.STYLE,
      nodeId: frame.id,
      content,
      styleData: { component: componentName, stateCount: Object.keys(states).length },
      status: 'new',
    })
    logDebug(`  [样式] "${componentName}" → ${Object.keys(states).length} 个状态`)
  }

  logInfo(`scanStyleFrames 完成: 共 ${assets.length} 个样式文件`)
  return assets
}

/**
 * 提取单个状态 Frame 的归一化样式对象
 * 通过子图层名称（大小写不敏感）识别 Background / Text / Icon
 */
function extractStateStyle(stateFrame: FrameNode): Record<string, any> {
  const result: Record<string, any> = {}

  // 自动布局 / 内边距 / 间距
  const autoLayout = stateFrame as unknown as AutoLayoutMixin
  if (typeof autoLayout.paddingLeft === 'number') {
    result.paddingTop = autoLayout.paddingTop
    result.paddingRight = autoLayout.paddingRight
    result.paddingBottom = autoLayout.paddingBottom
    result.paddingLeft = autoLayout.paddingLeft
    result.itemSpacing = autoLayout.itemSpacing
  }
  // 圆角（cornerRadius 不在 RectangleCornerMixin 类型上，用 any 读取）
  const corner: any = stateFrame
  if (typeof corner.cornerRadius === 'number' && !isNaN(corner.cornerRadius)) {
    result.cornerRadius = corner.cornerRadius
  }

  for (const child of stateFrame.children || []) {
    const name = (child.name || '').toLowerCase()

    // 背景图层 → backgroundColor
    if (name.includes('background') || name.includes('bg')) {
      const bg = firstSolidFill(child)
      if (bg) result.backgroundColor = bg
    }

    // 文字图层 → 字体/字号/字重/字色
    if (child.type === 'TEXT') {
      const t = child as TextNode
      const fFamily = readTextFontFamily(t)
      const fSize = readTextFontSize(t)
      const fWeight = readTextFontWeight(t)
      const fColor = readTextColor(t)
      if (fFamily) result.fontFamily = fFamily
      if (fSize) result.fontSize = fSize
      if (fWeight) result.fontWeight = fWeight
      if (fColor) result.textColor = fColor
    }

    // 图标 → 记录宽高
    if (name.includes('icon')) {
      if ('width' in child) result.iconSize = child.width
    }
  }

  // 清理 undefined / NaN
  for (const key of Object.keys(result)) {
    const v = result[key]
    if (v === undefined || v === null || (typeof v === 'number' && isNaN(v))) {
      delete result[key]
    }
  }

  return result
}

/** 读取节点第一个可见纯色填充，返回十六进制颜色串 */
function firstSolidFill(node: SceneNode): string | undefined {
  if (!('fills' in node)) return undefined
  const fills = (node as GeometryMixin).fills
  if (!fills || typeof fills === 'symbol') return undefined
  const solid = (fills as Paint[]).find(
    (f) => f.type === 'SOLID' && f.visible !== false && 'color' in f,
  )
  if (!solid || !('color' in solid)) return undefined
  return rgbToHex(solid.color.r, solid.color.g, solid.color.b)
}

/** 读取文本字体族（仅对整段统一字号时） */
function readTextFontFamily(node: TextNode): string | undefined {
  try {
    const f = node.getRangeFontName(0, 1)
    if (f !== figma.mixed) return f.family
  } catch { /* 忽略 */ }
  return undefined
}

/** 读取文本字号 */
function readTextFontSize(node: TextNode): number | undefined {
  try {
    const s = node.getRangeFontSize(0, 1)
    if (s !== figma.mixed) return s
  } catch { /* 忽略 */ }
  return undefined
}

/** 读取文本字重 */
function readTextFontWeight(node: TextNode): number | undefined {
  try {
    const w = node.getRangeFontWeight(0, 1)
    if (w !== figma.mixed) return w
  } catch { /* 忽略 */ }
  return undefined
}

/** 读取文本颜色（十六进制） */
function readTextColor(node: TextNode): string | undefined {
  try {
    const fills = node.getRangeFills(0, 1)
    if (fills !== figma.mixed && fills.length > 0) {
      const solid = fills.find((f) => f.type === 'SOLID' && 'color' in f)
      if (solid && 'color' in solid) return rgbToHex(solid.color.r, solid.color.g, solid.color.b)
    }
  } catch { /* 忽略 */ }
  return undefined
}

/**
 * 主入口
 */
async function main() {
  logInfo('===== 开始扫描 =====')
  logInfo('当前文件页面:', figma.currentPage.name)

  // 获取当前页面
  const page = figma.currentPage
  const allAssets: AssetItem[] = []

  // 通知 UI 开始扫描
  figma.ui.postMessage({ type: 'scan-phase', phase: 'scanning', message: '扫描 Export Assets...' })

  // 1. 扫描 Export Assets Frame
  logDebug('查找 Export Assets Frame...')
  const exportAssetsFrame = page.findOne(
    (node) => node.type === 'FRAME' && node.name === 'Export Assets',
  ) as FrameNode | null

  if (exportAssetsFrame) {
    logInfo('找到 Export Assets Frame，开始扫描子节点')
    const assets = scanExportAssetsFrame(exportAssetsFrame)
    logInfo(`Export Assets 扫描完成，找到 ${assets.length} 个图片资源`)
    allAssets.push(...assets)
  } else {
    logWarn('未找到 Export Assets Frame（如不需要图片资源可忽略）')
  }

  // 2. 扫描 文字资源_ Frame
  figma.ui.postMessage({ type: 'scan-phase', phase: 'scanning', message: '扫描文字资源...' })
  logDebug('查找文字资源 Frame...')
  const textFrames = page.findAll(
    (node) => node.type === 'FRAME' && node.name.startsWith('文字资源_'),
  ) as FrameNode[]

  if (textFrames.length > 0) {
    logInfo(
      `找到 ${textFrames.length} 个文字资源 Frame: ${textFrames.map((f) => f.name).join(', ')}`,
    )
    for (const frame of textFrames) {
      logDebug(`扫描文字资源 Frame: "${frame.name}"`)
      const textAssets = scanTextFrame(frame)
      logInfo(`文字资源 "${frame.name}" 扫描完成，导出 ${textAssets.length} 个 JSON`)
      allAssets.push(...textAssets)
    }
  } else {
    logWarn('未找到文字资源 Frame（如不需要文字资源可忽略）')
  }

  // 3. 扫描样式资源（样式_{组件} Frame）
  figma.ui.postMessage({ type: 'scan-phase', phase: 'scanning', message: '提取样式资源...' })
  logDebug('开始扫描样式资源...')
  const styleAssets = scanStyleFrames(page)
  logInfo(`样式资源扫描完成，生成 ${styleAssets.length} 个样式文件`)
  allAssets.push(...styleAssets)

  // 4. 如果没有找到任何资源，提示用户
  if (allAssets.length === 0) {
    logWarn('未找到任何资源，扫描结束')
    figma.ui.onmessage = () => {
      figma.closePlugin()
    }
    figma.ui.postMessage({
      type: 'no-assets',
      message:
        '未找到 Export Assets 或 文字资源_ Frame\n请在当前文件中创建以下 Frame：\n\n1. Export Assets（图片资源，子 Frame 名即 OSS 路径）\n2. 文字资源_{名称}（文字资源，导出为 JSON）',
    })
    return
  }

  // 5. 生成缺失图片占位符 + 汇总 version.json（始终最后上传）
  logDebug('生成占位符与 version.json...')
  const { placeholders } = buildVersionAndPlaceholders(allAssets)
  allAssets.push(...placeholders)
  const versionAsset = buildVersionAsset(allAssets)
  allAssets.push(versionAsset)
  logInfo(`占位符 ${placeholders.length} 个，version.json 已生成`)

  // 6. 汇总日志
  const imageCount = allAssets.filter((a) => a.type === 'image').length
  const textCount = allAssets.filter((a) => a.type === 'text').length
  const styleCount = allAssets.filter((a) => a.type === 'style').length
  const placeholderCount = allAssets.filter((a) => a.status === 'placeholder').length
  logInfo(
    `===== 扫描完成: 共 ${allAssets.length} 个资源（${imageCount} 图片 + ${textCount} 文字 + ${styleCount} 样式 + ${placeholderCount} 占位） =====`,
  )
  allAssets.forEach((a) =>
    logDebug(`  ${a.type === 'image' ? '图片' : a.type === 'text' ? '文字' : '样式'} ${a.ossPath}`),
  )

  // 7. 发送到 UI 显示变更列表
  figma.ui.postMessage({
    type: 'scan-result',
    assets: allAssets,
    total: allAssets.length,
  })
}

/**
 * 扫描 Export Assets Frame 下的图片资源
 *
 * 子 Frame 名称 = OSS 路径前缀，图层名称 = 文件名（可无扩展名，插件自动补 .png）
 * 命名规则必须与前端消费路径对齐：
 *
 * 图片资源路径映射（前端通过 getAssetUrl / ossBase 拼接消费）：
 *   子 Frame: images/culture_cards/WEN_01
 *   图层名: card_bg.png
 *   → OSS: images/culture_cards/WEN_01/card_bg.png
 *   → 前端: {ossBase}/images/culture_cards/WEN_01/card_bg.png
 *     ↑ 对应 CultureCards.vue 的 getCardImageUrl
 *
 *   子 Frame: images/general
 *   图层名: home_bg.png
 *   → OSS: images/home_bg.png（插件自动移除 general/ 前缀）
 *   → 前端: getAssetUrl('images', 'home_bg.png') = {ossBase}/images/home_bg.png
 *
 * 视频/音频路径映射（前端通过 ResourceUploadTool 上传，命名规则见 uploadAll）：
 *   video/{wenId}_rule_bg.mp4 → 前端: {ossBase}/video/{wenId}_rule_bg.mp4
 *     ↑ 对应 RuleVideoView.vue 的 videoUrl 拼接
 *   audio/{wenId}_reading.mp3 → 前端: {audioBaseUrl}/{wenId}_reading.mp3
 *     ↑ 对应 MultiRoleReading.vue 的 audio_file 字段
 *
 * 后端白名单见 backend/src/controllers/assetController.js 的 ALLOWED_MEDIA_DIRS
 */
function scanExportAssetsFrame(frame: FrameNode): AssetItem[] {
  const assets: AssetItem[] = []
  const totalChildren = frame.children?.length || 0
  logDebug(`scanExportAssetsFrame: 共 ${totalChildren} 个子节点`)

  if (!frame.children) {
    logWarn('Export Assets Frame 没有子节点')
    return assets
  }

  for (let i = 0; i < frame.children.length; i++) {
    const child = frame.children[i]
    if (child.type !== 'FRAME') {
      logDebug(`  [${i + 1}/${totalChildren}] 跳过非 Frame 节点: "${child.name}" (${child.type})`)
      continue
    }

    // 子 Frame 名称作为 OSS 路径
    // 移除 general/ 前缀，使路径与前端 getAssetUrl('images', 'home_bg.png') 一致
    // 前端期望路径: images/home_bg.png，而非 images/general/home_bg.png
    let ossPath = child.name.replace(/\/$/, '')
    if (ossPath === 'images/general') {
      ossPath = 'images'
    }
    const subChildrenCount = child.children?.length || 0
    logDebug(
      `  [${i + 1}/${totalChildren}] 处理目录 "${child.name}" → OSS "${ossPath}" (${subChildrenCount} 个子节点)`,
    )

    if (!child.children) {
      logDebug(`    → 空目录，跳过`)
      continue
    }

    let hitCount = 0
    let skipCount = 0
    // 记录当前目录已使用的文件名，避免"同一目录下图层名重复"
    const seenNames = new Set<string>()

    for (const leaf of child.children) {
      // 跳过非可视节点
      if (leaf.visible === false) {
        logDebug(`    → [跳过] 隐藏图层: "${leaf.name}"`)
        skipCount++
        continue
      }

      // 只处理可导出的图层类型
      const exportableTypes = [
        'RECTANGLE',
        'ELLIPSE',
        'VECTOR',
        'IMAGE',
        'INSTANCE',
        'COMPONENT',
        'FRAME',
        'GROUP',
      ]
      if (!exportableTypes.includes(leaf.type)) {
        logDebug(`    → [跳过] 不支持的图层类型(${leaf.type}): "${leaf.name}"`)
        skipCount++
        continue
      }

      // 文件名 = 图层名；无有效图片扩展名时自动补 .png（与美术命名约定一致）
      let fileName = (leaf.name || '').trim()
      if (!fileName) {
        logDebug(`    → [跳过] 图层名为空`)
        skipCount++
        continue
      }
      if (!/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(fileName)) {
        fileName = `${fileName}.png`
      }

      // 同一目录下图层名不能重复：重复则跳过并记录警告
      if (seenNames.has(fileName)) {
        logWarn(`    → [跳过] 目录 "${child.name}" 下图层名重复: "${fileName}"`)
        skipCount++
        continue
      }
      seenNames.add(fileName)

      const fullPath = `${ossPath}/${fileName}`
      logDebug(`    → [命中] ${leaf.type} → "${fullPath}"`)
      hitCount++

      assets.push({
        ossPath: fullPath,
        fileName,
        type: ASSET_TYPE.IMAGE,
        nodeId: leaf.id,
        status: 'new',
      })
    }

    logDebug(`    → 目录 "${child.name}" 处理完成: ${hitCount} 命中, ${skipCount} 跳过`)
  }

  logDebug(`scanExportAssetsFrame 完成: 共 ${assets.length} 个图片资源`)
  return assets
}

/**
 * 扫描文字资源 Frame（适用于 文字资源_{标题} 顶层 Frame）
 *
 * 结构约定（新版本，与现有生产端对齐）：
 *   文字资源_论语·学而篇（顶层 Frame，名 = 标题，用于映射 WEN_xx）
 *   ├── 原文（TEXT，固定名称）        → original_text
 *   ├── 作者（TEXT，固定名称）        → author
 *   ├── 朝代（TEXT，固定名称）        → dynasty
 *   ├── 注释词_1（Frame）
 *   │   ├── 词    （TEXT，固定名称）  → word
 *   │   └── 注释  （TEXT，固定名称）  → basic_meaning
 *   └── 注释词_2 ...
 *
 * 产出（与前端 data/text_basic_info、data/word_list 对齐）：
 *   data/text_basic_info/<WEN>.json：
 *     { "text_id": "WEN_05", "title": "论语·学而篇", "author": "…", "dynasty": "…", "original_text": "…" }
 *   data/word_list/<WEN>.json：
 *     [ { "text_id": "WEN_05", "word": "…", "basic_meaning": "…", "follow_up_questions": [] } ]
 *
 * 保护：01-04 为生产已上线篇目，保留现网文件，跳过生成；未收录标题的 Frame 跳过。
 * 缺失处理：缺「原文」→ original_text:""；缺「作者/朝代」→ 空串；
 * 缺词或注释的注释 Frame → 仍写入，空字段以空串占位。
 */
function scanTextFrame(frame: FrameNode): AssetItem[] {
  const assets: AssetItem[] = []
  // 标题 = 去掉 "文字资源_" 前缀（可用标题映射得到 wenId）
  const title = frame.name.replace(/^文字资源_/, '').replace(/\/+$/, '')
  const wenId = resolveWenIdByTitle(title)

  if (!wenId) {
    logWarn(`文字资源 "${title}" 未在篇目映射中找到对应 wenId，跳过`)
    return []
  }
  if (isLegacyWenId(wenId)) {
    logWarn(`[保留] "${title}" (${wenId}) 属于 01-04 已上线篇目，跳过生成以免覆盖现网文件`)
    return []
  }

  // 读取元数据
  const original = findTextByExactName(frame, TEXT_FRAME_NAMES.ORIGINAL)
  const author = findTextByExactName(frame, TEXT_FRAME_NAMES.AUTHOR)
  const dynasty = findTextByExactName(frame, TEXT_FRAME_NAMES.DYNASTY)

  // 遍历直接子 Frame（注释词_N），提取 词 + 注释
  const wordList: { text_id: string; word: string; basic_meaning: string; follow_up_questions: string[] }[] = []
  for (const child of frame.children || []) {
    if (child.type !== 'FRAME') continue
    const word = findTextByExactName(child, TEXT_FRAME_NAMES.WORD)
    const gloss = findTextByExactName(child, TEXT_FRAME_NAMES.GLOSS)
    wordList.push({
      text_id: wenId,
      word: word || '',
      basic_meaning: gloss || '',
      follow_up_questions: [],
    })
    logDebug(
      `  [注释] "${child.name}" word="${(word || '').substring(0, 20)}" basic_meaning="${(gloss || '').substring(0, 20)}${(gloss || '').length > 20 ? '...' : ''}"`,
    )
  }

  // data/text_basic_info/<WEN>.json
  const basicInfoContent = JSON.stringify(
    { text_id: wenId, title, author, dynasty, original_text: original },
    null,
    2,
  )
  assets.push({
    ossPath: `${DATA_DIR_TEXT_BASIC_INFO}/${wenId}.json`,
    fileName: `${wenId}.json`,
    type: ASSET_TYPE.TEXT,
    nodeId: frame.id,
    content: basicInfoContent,
    status: 'new',
  })
  logInfo(
    `  [产出] text_basic_info: "${DATA_DIR_TEXT_BASIC_INFO}/${wenId}.json" (${basicInfoContent.length} 字节, author="${author}", dynasty="${dynasty}")`,
  )

  // data/word_list/<WEN>.json
  const wordListContent = JSON.stringify(wordList, null, 2)
  assets.push({
    ossPath: `${DATA_DIR_WORD_LIST}/${wenId}.json`,
    fileName: `${wenId}.json`,
    type: ASSET_TYPE.TEXT,
    nodeId: frame.id,
    content: wordListContent,
    status: 'new',
  })
  logInfo(
    `  [产出] word_list: "${DATA_DIR_WORD_LIST}/${wenId}.json" (${wordListContent.length} 字节, ${wordList.length} 条注释)`,
  )

  return assets
}

/** 在指定 Frame 的直接子节点中，按精确名称查找 TEXT 节点并返回 characters */
function findTextByExactName(frame: FrameNode | SceneNode, exactName: string): string {
  if (!('children' in frame)) return ''
  for (const child of (frame as FrameNode).children || []) {
    if (child.type === 'TEXT' && child.name === exactName) {
      return (child as TextNode).characters
    }
  }
  return ''
}

/**
 * 导出单个图片节点，带超时保护
 * 返回 Uint8Array，失败时返回空数组
 */
async function exportSingleNode(nodeId: string, ossPath: string): Promise<Uint8Array> {
  try {
    const node = (await figma.getNodeByIdAsync(nodeId)) as SceneNode | null
    if (!node) {
      logError(`  节点不存在或不可访问: "${ossPath}" (nodeId: ${nodeId})`)
      return new Uint8Array(0)
    }

    // 检查节点是否仍在场景中（removed 为 true 表示已被删除）
    if ('removed' in node && (node as any).removed === true) {
      logError(`  节点已被删除: "${ossPath}"`)
      return new Uint8Array(0)
    }

    const isSvg = ossPath.toLowerCase().endsWith('.svg')
    const exportOptions: ExportSettings = isSvg
      ? { format: 'SVG' }
      : { format: 'PNG', constraint: { type: 'SCALE', value: 2 } }

    logDebug(`  → 正在导出: "${ossPath}" (${isSvg ? 'SVG' : 'PNG'})`)
    const rawData = await withTimeout(
      node.exportAsync(exportOptions),
      EXPORT_TIMEOUT_MS,
      `exportAsync(${ossPath})`,
    )
    logInfo(`  导出成功: "${ossPath}" (${rawData.byteLength} bytes)`)
    return new Uint8Array(rawData)
  } catch (err) {
    logError(`  导出失败: "${ossPath}"`, err)
    return new Uint8Array(0)
  }
}

/**
 * 导出所有图片节点，准备发往 UI 线程上传
 *
 * 架构说明：
 *   - 主线程（code.ts）负责 Figma API 调用（如导出节点）
 *   - UI 线程（ui.html）负责网络请求（支持 FormData / Blob 等浏览器 API）
 *   - 二进制数据通过 postMessage 结构化克隆传递
 */
async function prepareAssetsForUpload(assets: AssetItem[]): Promise<AssetItem[]> {
  logInfo(`===== 准备导出: ${assets.length} 个资源 =====`)
  const result: AssetItem[] = []

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i]
    logDebug(`[${i + 1}/${assets.length}] 处理: "${asset.ossPath}" (${asset.type})`)

    if (asset.type === ASSET_TYPE.IMAGE) {
      // 图片资源：在主线程导出节点，二进制数据发往 UI 线程上传
      const data = await exportSingleNode(asset.nodeId, asset.ossPath)
      result.push({ ...asset, data })
    } else {
      // 文字/样式资源：直接传递文本内容
      logDebug(`  → ${asset.type} 资源, 内容长度: ${asset.content?.length || 0} 字符`)
      result.push(asset)
    }
  }

  const imageCount = result.filter((a) => a.type === 'image' && a.data && a.data.length > 0).length
  const errorCount = result.filter(
    (a) => a.type === 'image' && (!a.data || a.data.length === 0),
  ).length
  logInfo(`===== 导出完成: ${imageCount} 图片, ${errorCount} 失败 =====`)

  return result
}

// ============ 初始化流程 ============

// 等待 UI 就绪的 Promise
let uiReadyResolve: () => void
const uiReady = new Promise<void>((resolve) => {
  uiReadyResolve = resolve
})

// 监听 UI 消息
figma.ui.onmessage = async (msg) => {
  try {
    // UI 就绪信号
    if (msg.type === 'ui-ready') {
      logInfo('UI 就绪，开始扫描')
      uiReadyResolve()
      return
    }

    if (msg.type === 'sync') {
      // 用户点击"同步"：在主线程导出图片节点，发往 UI 线程上传
      const apiBase = msg.apiBase || DEFAULT_API_BASE
      const apiToken = typeof msg.apiToken === 'string' ? msg.apiToken.trim() : ''
      const assets: AssetItem[] = msg.assets

      logInfo(`===== 收到同步请求: ${assets.length} 个资源, API: ${apiBase} =====`)
      logDebug(`令牌: ${apiToken ? '已配置（长度 ' + apiToken.length + '）' : '未配置'}`)

      figma.ui.postMessage({ type: 'sync-start', total: assets.length })

      try {
        // 导出所有图片节点，附加二进制数据
        const exportData = await prepareAssetsForUpload(assets)

        // 发往 UI 线程，由 UI 完成上传（UI 浏览器环境支持 FormData）
        figma.ui.postMessage({
          type: 'sync-data',
          apiBase,
          apiToken,
          assets: exportData,
        })
      } catch (err) {
        logError('prepareAssetsForUpload 失败:', err)
        figma.ui.postMessage({
          type: 'sync-error',
          error: String(err),
        })
      }
      return
    }

    if (msg.type === 'sync-done') {
      // UI 线程上传完成，将结果转发到 UI 显示（同时保留主线程日志）
      const verified = (msg as any).summary?.verified || 0
      logInfo(
        `===== 同步完成: ${(msg as any).summary.uploaded} 上传, ${verified} 已验证, ${(msg as any).summary.errors} 失败 =====`,
      )
      ;(msg as any).summary.errorDetails?.forEach((e: any) =>
        logError(`  失败 ${e.fileName}: ${e.error}`),
      )

      figma.ui.postMessage({
        type: 'sync-complete',
        results: msg.results,
        summary: msg.summary,
      })
      return
    }

    if (msg.type === 'retry') {
      // 用户点击重试：重新导出失败节点并上传
      const apiBase = msg.apiBase || DEFAULT_API_BASE
      const apiToken = typeof msg.apiToken === 'string' ? msg.apiToken.trim() : ''
      const failedAssets: AssetItem[] = msg.assets

      logInfo(`===== 收到重试请求: ${failedAssets.length} 个资源 =====`)
      figma.ui.postMessage({ type: 'sync-start', total: failedAssets.length })

      try {
        // 重新导出所有图片节点
        const exportData = await prepareAssetsForUpload(failedAssets)
        figma.ui.postMessage({
          type: 'sync-data',
          apiBase,
          apiToken,
          assets: exportData,
        })
      } catch (err) {
        logError('retry prepareAssetsForUpload 失败:', err)
        figma.ui.postMessage({
          type: 'sync-error',
          error: String(err),
        })
      }
      return
    }

    if (msg.type === 'cancel') {
      logInfo('用户取消同步')
      figma.closePlugin()
      return
    }
  } catch (err) {
    logError('消息处理异常:', err)
    try {
      figma.ui.postMessage({
        type: 'sync-error',
        error: `消息处理异常: ${String(err)}`,
      })
    } catch (_) {
      // 忽略发送错误
    }
  }
}

// 显示 UI（使用 themeColors 支持明暗主题）
figma.showUI(__html__, {
  width: 600,
  height: 500,
  themeColors: true,
})

// 等待 UI 就绪后启动扫描
uiReady.then(() => {
  main().catch((err) => {
    logError('主扫描流程异常:', err)
    try {
      figma.ui.postMessage({
        type: 'scan-error',
        error: String(err),
      })
    } catch (postErr) {
      logError('无法向 UI 发送错误消息:', postErr)
    }
  })
})
