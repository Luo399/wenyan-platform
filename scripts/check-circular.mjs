#!/usr/bin/env node
/**
 * 循环依赖门禁（CI 的 circular-check job 用；零依赖，只用 node 内置模块）
 *
 * 为什么仓库里自己写一个：原先 CI 装 `circular-dependency-scanner@3.0.1` 扫 `src/`，
 * 2026-10-30 实测它有两个致命问题——
 *   1. 调用时没加 `-t`，而该工具默认「发现环也 exit 0」。夹具里放一个环实测：
 *      不带 `-t` 退出码 0，带 `-t` 退出码 1。workflow 里那句注释
 *      「默认发现循环时 exit code 非零」是错的，`||` 分支永远走不到，
 *      等于这个 job 从建立起就不可能红。
 *   2. 它的别名解析只读**根** `tsconfig.json` 的 paths，本仓根文件是
 *      `{files: [], references: [...]}` 的 solution 形态，`@/*` 定义在
 *      `tsconfig.app.json`——所以 src 的 300 条静态边里 262 条（87%）`@/` 引入
 *      对它是不透明的。夹具验证：补一个带 paths 的 tsconfig.json 后它才看见别名环。
 * 本轮（#255/#257）拆掉的 `utils ↔ stores` 环不是它抓出来的，也不能靠它保证不回来。
 *
 * 口径：
 *   - 只把「加载期」依赖算进环：静态 `import` / `export ... from` / CommonJS `require`。
 *     动态 `import()` 不阻塞模块初始化，单独统计、不参与判环（否则路由懒加载会全红）。
 *   - `type` 只导入保留在图里当上界：类型环不产生运行时问题，但本项目实测 0 环，
 *     就高判更保守，也更接近「别拿 barrel 当运行时胶水」这条约定。
 *   - 静态资源（.css/.svg/图片/字体/.json 等）与 Vite 的 `?raw`/`?url` 后缀不进图，
 *     它们不可能反过来 import 代码。
 *   - 测试文件与被 tsconfig 排除的 `__tests__` 不进图（它们不属于交付产物）。
 *   - 第三方包（bare specifier）不解析、不参与。
 *   - 解析不到的本仓引入、或模块数低于下限，都判失败——门禁宁可红，不要假绿。
 *
 * 用法：
 *   node scripts/check-circular.mjs                     # 默认扫 src 与 backend/src
 *   node scripts/check-circular.mjs src                 # 只扫指定目录
 *   node scripts/check-circular.mjs src --min-modules 1 # 放开模块数下限（夹具测试用）
 *   发现环 / 图不完整 → exit 1；目录不存在或参数非法 → exit 2。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 扫描时跳过的目录名（测试与产物不属于应用依赖图） */
const SKIP_DIRS = new Set(['node_modules', '__tests__', 'dist', 'coverage', '.git'])
const TEST_FILE_RE = /(\.spec|\.test)\.[cm]?[jt]sx?$/
const EXTS = ['.ts', '.tsx', '.vue', '.js', '.mjs', '.cjs']

/** 读 tsconfig.app.json 的 compilerOptions.paths，得到别名前缀 → 目录 的映射 */
function loadAliases() {
  const file = path.join(PROJECT_ROOT, 'tsconfig.app.json')
  const fallback = [{ prefix: '@/', dir: path.join(PROJECT_ROOT, 'src') }]
  if (!fs.existsSync(file)) return fallback
  let config
  try {
    // tsconfig 是 JSONC：先剥注释再解析（只剥整行 // 与 /* */，避开值里的 https://）
    const src = fs
      .readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    config = JSON.parse(src)
  } catch (err) {
    console.warn(`! tsconfig.app.json 解析失败（${err.message}），别名退回 @/ → src/`)
    return fallback
  }
  const paths = config?.compilerOptions?.paths
  if (!paths || typeof paths !== 'object') {
    console.warn('! tsconfig.app.json 没有 compilerOptions.paths，别名退回默认的 @/ → src/')
    return fallback
  }
  const out = []
  for (const [key, targets] of Object.entries(paths)) {
    const target = Array.isArray(targets) ? targets[0] : undefined
    if (!target) continue
    const prefix = key.endsWith('*') ? key.slice(0, -1) : key
    const dir = target.replace(/^\.\//, '').replace(/\*$/, '')
    out.push({ prefix, dir: path.resolve(PROJECT_ROOT, dir) })
  }
  return out.length ? out : fallback
}

const ALIASES = loadAliases()

function walk(dir, acc) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, acc)
    else if (EXTS.some((ext) => entry.name.endsWith(ext)) && !TEST_FILE_RE.test(entry.name))
      acc.push(full)
  }
  return acc
}

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/** 静态引入：import 'x' / import a from 'x' / export * from 'x' / require('x') */
const STATIC_RES = [
  /(?:^|[\s;}])(?:import|export)\s(?:[^'"`]*?\sfrom\s)?['"]([^'"]+)['"]/g,
  /(?:^|[\s;}])(?:await\s+)?require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
]
/** 动态引入：只统计，不判环 */
const DYNAMIC_RES = [/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g, /import\s*\(\s*`([^`]+)`\s*\)/g]

function resolveFile(base) {
  // 只认代码模块：`./main.css` 这类资源虽然在磁盘上存在，但它不可能反过来 import 代码，
  // 收进图里只会污染边表，所以要求落点必须带 EXTS 里的扩展名。
  const isCode = (p) => EXTS.some((ext) => p.endsWith(ext))
  for (const ext of ['', ...EXTS]) {
    const candidate = base + ext
    if (isCode(candidate) && fs.existsSync(candidate) && fs.statSync(candidate).isFile())
      return candidate
  }
  for (const ext of EXTS) {
    const index = path.join(base, `index${ext}`)
    if (fs.existsSync(index)) return index
  }
  return null
}

function resolve(fromFile, spec) {
  const clean = spec.split('?')[0] // Vite 的 ?raw / ?url 后缀不影响落点
  if (clean.startsWith('.')) return resolveFile(path.resolve(path.dirname(fromFile), clean))
  for (const alias of ALIASES) {
    if (clean.startsWith(alias.prefix))
      return resolveFile(path.join(alias.dir, clean.slice(alias.prefix.length)))
  }
  return null
}

/** 静态资源不可能反向 import 代码，进不了环，所以不算「解析失败」 */
const ASSET_RE =
  /\.(css|scss|sass|less|styl|svg|png|jpe?g|gif|webp|avif|ico|mp4|webm|ogg|mp3|wav|woff2?|ttf|eot|json|txt|md|csv|raw|url)$/i

const relKey = (p) => path.relative(PROJECT_ROOT, p).split(path.sep).join('/')

function buildGraph(roots) {
  const files = []
  for (const root of roots) {
    const abs = path.resolve(PROJECT_ROOT, root)
    if (!fs.existsSync(abs)) {
      console.error(`x 目录不存在：${root}`)
      process.exit(2)
    }
    walk(abs, files)
  }
  const edges = new Map()
  const dynamic = new Map()
  const unresolved = []
  let aliasEdges = 0
  for (const file of files) {
    const src = stripComments(fs.readFileSync(file, 'utf8'))
    const from = relKey(file)
    const staticTargets = new Set()
    const dynamicTargets = new Set()
    for (const re of STATIC_RES) {
      for (const match of src.matchAll(re)) {
        const spec = match[1]
        const target = resolve(file, spec)
        if (target) {
          const key = relKey(target)
          if (
            !staticTargets.has(key) &&
            ALIASES.some((a) => spec.split('?')[0].startsWith(a.prefix))
          )
            aliasEdges++
          staticTargets.add(key)
        } else if (
          !ASSET_RE.test(spec.split('?')[0]) &&
          (spec.startsWith('.') || ALIASES.some((a) => spec.startsWith(a.prefix)))
        )
          unresolved.push({ from, spec })
      }
    }
    for (const re of DYNAMIC_RES) {
      for (const match of src.matchAll(re)) {
        const target = resolve(file, match[1])
        if (target) dynamicTargets.add(relKey(target))
      }
    }
    edges.set(from, staticTargets)
    dynamic.set(from, dynamicTargets)
  }
  return { edges, dynamic, unresolved, aliasEdges }
}

/** Tarjan 强连通分量；size 1 只在自引用时保留 */
function findCycles(edges) {
  let counter = 0
  const index = new Map()
  const lowlink = new Map()
  const onStack = new Set()
  const stack = []
  const components = []

  function strongconnect(v) {
    index.set(v, counter)
    lowlink.set(v, counter)
    counter++
    stack.push(v)
    onStack.add(v)
    for (const w of edges.get(v) || []) {
      if (!edges.has(w)) continue
      if (!index.has(w)) {
        strongconnect(w)
        lowlink.set(v, Math.min(lowlink.get(v), lowlink.get(w)))
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v), index.get(w)))
      }
    }
    if (lowlink.get(v) === index.get(v)) {
      const component = []
      let w
      do {
        w = stack.pop()
        onStack.delete(w)
        component.push(w)
      } while (w !== v)
      const selfLoop = component.length === 1 && (edges.get(v) || new Set()).has(v)
      if (component.length > 1 || selfLoop) components.push(component)
    }
  }

  for (const node of edges.keys()) if (!index.has(node)) strongconnect(node)
  return components
}

/** 在环内找一条具体路径回来，比平铺边表好定位 */
function cyclePath(component, edges) {
  const inside = new Set(component)
  let best = null
  for (const start of component) {
    const prev = new Map()
    const queue = [start]
    let closing = null
    while (queue.length && !closing) {
      const current = queue.shift()
      for (const next of edges.get(current) || []) {
        if (!inside.has(next)) continue
        if (next === start && current !== start) {
          closing = current
          break
        }
        if (!prev.has(next) && next !== start) {
          prev.set(next, current)
          queue.push(next)
        }
      }
    }
    if (!closing) continue
    const chain = [closing]
    while (chain[chain.length - 1] !== start) chain.push(prev.get(chain[chain.length - 1]))
    chain.reverse()
    chain.push(start)
    if (!best || chain.length < best.length) best = chain
  }
  return best || [...component, component[0]]
}

function main() {
  const argv = process.argv.slice(2)
  let minModules = 10
  const roots = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--min-modules') {
      minModules = Number(argv[++i])
      if (!Number.isFinite(minModules) || minModules < 1) {
        console.error('x --min-modules 需要一个正整数')
        process.exit(2)
      }
    } else if (!argv[i].startsWith('-')) roots.push(argv[i])
  }
  if (!roots.length) roots.push('src', 'backend/src')
  const { edges, dynamic, unresolved, aliasEdges } = buildGraph(roots)
  const staticEdgeCount = [...edges.values()].reduce((sum, set) => sum + set.size, 0)
  const dynamicEdgeCount = [...dynamic.values()].reduce((sum, set) => sum + set.size, 0)

  console.log(`扫描范围：${roots.join(', ')}`)
  console.log(
    `模块 ${edges.size} 个；静态边 ${staticEdgeCount} 条（其中别名边 ${aliasEdges} 条）；` +
      `动态 import() ${dynamicEdgeCount} 条（不参与判环）`,
  )

  if (edges.size < minModules) {
    console.error(`x 只解析出 ${edges.size} 个模块（下限 ${minModules}），图明显不完整，不给假绿`)
    process.exit(1)
  }
  if (unresolved.length) {
    console.error(`x 有 ${unresolved.length} 条本仓引入解析不到文件，图不完整，检查结果不可信：`)
    for (const item of unresolved.slice(0, 20)) console.error(`  ${item.from} -> '${item.spec}'`)
    process.exit(1)
  }

  const components = findCycles(edges)
  if (!components.length) {
    console.log('OK 无加载期循环依赖')
    return
  }
  console.error(`x 发现 ${components.length} 处循环依赖：`)
  for (const component of components) {
    const chain = cyclePath(component, edges)
    console.error(`\n  ${chain.length - 1} 个模块成环：`)
    console.error(`    ${chain.join('\n    -> ')}`)
  }
  process.exit(1)
}

main()
