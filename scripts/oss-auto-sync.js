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
    console.error(
      '缺少写入凭据：请用 --api-key 或环境变量 ASSET_SYNC_TOKEN / OSS_SYNC_API_KEY 提供。',
    )
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
  console.log(
    `上次处理时间: ${lastState.lastProcessedAt || '（无）'}，既有清单项: ${existingList.length}`,
  )

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
  console.log(
    `进入新增组件清单: ${mergedItems.length - existingList.length} 项（累计 ${mergedItems.length} 项）`,
  )
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
