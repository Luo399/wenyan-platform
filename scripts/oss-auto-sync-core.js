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
    return {
      apiBase: 'https://test-api.classicalab.cn',
      ossPublicBase: 'https://test.classicalab.cn',
    }
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
    apiKey:
      flag(['--api-key']) || process.env.OSS_SYNC_API_KEY || process.env.ASSET_SYNC_TOKEN || '',
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
    return {
      decision: 'component',
      reason: '无现存样式消费者（样式走 Figma 静态资源 + design-tokens）',
    }
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
