/**
 * Figma 插件模拟测试 - 验证节点解析逻辑是否正确
 *
 * 运行方式：本地无 Figma 环境，此文件作为逻辑验证参考。
 * 可直接在浏览器 Console 或 Node.js 中运行（需移除 Figma 类型依赖）。
 *
 * 模拟场景：
 *   1. 通用组件文件：Export Assets → images/general/
 *   2. 课文文件：Export Assets + 文字资源_论语·学而篇
 *   3. 空文件：无任何 Frame
 *   4. 边界情况：隐藏图层、不支持的类型、缺失扩展名
 */

// ============ 模拟 Figma 节点类型 ============

interface MockSceneNode {
  id: string
  name: string
  type: string
  visible: boolean
  children?: MockSceneNode[]
  characters?: string
}

interface AssetItem {
  ossPath: string
  fileName: string
  type: string
  nodeId: string
  content?: string
  status: 'new' | 'changed' | 'unchanged'
}

const ASSET_TYPE = { IMAGE: 'image', TEXT: 'text' }

// ============ 模拟数据 ============

/** 场景 1：通用组件文件 */
const generalFileMock: MockSceneNode = {
  id: 'page_1',
  name: 'Page 1',
  type: 'PAGE',
  children: [
    {
      id: 'frame_export',
      name: 'Export Assets',
      type: 'FRAME',
      visible: true,
      children: [
        {
          id: 'sub_general',
          name: 'images/general/',
          type: 'FRAME',
          visible: true,
          children: [
            { id: 'layer_bg', name: 'home_bg.png', type: 'RECTANGLE', visible: true },
            { id: 'layer_login', name: 'login_bg.png', type: 'RECTANGLE', visible: true },
            { id: 'layer_icon', name: 'logo.svg', type: 'VECTOR', visible: true },
            // 应被跳过的图层
            { id: 'layer_hidden', name: 'hidden.png', type: 'RECTANGLE', visible: false },
            { id: 'layer_text', name: '说明文字', type: 'TEXT', visible: true, characters: '说明' },
            { id: 'layer_noext', name: 'no_ext_file', type: 'RECTANGLE', visible: true },
            { id: 'layer_line', name: 'divider_line', type: 'LINE', visible: true },
          ],
        },
        {
          id: 'sub_cover',
          name: 'images/cover/',
          type: 'FRAME',
          visible: true,
          children: [
            { id: 'layer_cover', name: 'cover_main.png', type: 'RECTANGLE', visible: true },
          ],
        },
        {
          id: 'sub_audio',
          name: 'audio/',
          type: 'FRAME',
          visible: true,
          children: [
            // 音频文件不应通过 Figma 导出（大文件直接上传 OSS）
            { id: 'layer_bgm', name: 'bgm.mp3', type: 'RECTANGLE', visible: true },
          ],
        },
      ],
    },
    // 通用文件不应有文字资源 Frame
  ],
}

/** 场景 2：课文文件（论语·学而篇） */
const lessonFileMock: MockSceneNode = {
  id: 'page_lesson',
  name: '论语·学而篇',
  type: 'PAGE',
  children: [
    {
      id: 'frame_export_lesson',
      name: 'Export Assets',
      type: 'FRAME',
      visible: true,
      children: [
        {
          id: 'sub_culture',
          name: 'images/culture_cards/WEN_01/',
          type: 'FRAME',
          visible: true,
          children: [
            { id: 'layer_card_bg', name: 'card_bg.png', type: 'RECTANGLE', visible: true },
            { id: 'layer_card_1', name: 'card_1.png', type: 'RECTANGLE', visible: true },
            { id: 'layer_card_2', name: 'card_2.svg', type: 'VECTOR', visible: true },
          ],
        },
        {
          id: 'sub_cover_lesson',
          name: 'images/cover/',
          type: 'FRAME',
          visible: true,
          children: [
            { id: 'layer_cover_lesson', name: 'cover_lesson.png', type: 'RECTANGLE', visible: true },
          ],
        },
      ],
    },
    {
      id: 'frame_text',
      name: '文字资源_论语·学而篇',
      type: 'FRAME',
      visible: true,
      children: [
        { id: 'text_knowledge', name: 'knowledge_text', type: 'TEXT', visible: true, characters: '论语是儒家经典...' },
        { id: 'text_card_name', name: 'card_name', type: 'TEXT', visible: true, characters: '孔子' },
        { id: 'text_card_desc', name: 'card_desc', type: 'TEXT', visible: true, characters: '名丘，字仲尼...' },
        {
          id: 'sub_data',
          name: 'sub_data',
          type: 'FRAME',
          visible: true,
          children: [
            { id: 'text_sub_1', name: 'sub_field_1', type: 'TEXT', visible: true, characters: '子字段内容1' },
            { id: 'text_sub_2', name: 'sub_field_2', type: 'TEXT', visible: true, characters: '子字段内容2' },
          ],
        },
      ],
    },
  ],
}

/** 场景 3：空文件（无任何资源） */
const emptyFileMock: MockSceneNode = {
  id: 'page_empty',
  name: '空页面',
  type: 'PAGE',
  children: [
    { id: 'some_frame', name: '其他 Frame', type: 'FRAME', visible: true, children: [] },
    { id: 'some_text', name: '其他文本', type: 'TEXT', visible: true, characters: '无关内容' },
  ],
}

/** 场景 4：边界情况 - 无 Export Assets，只有文字资源 */
const textOnlyFileMock: MockSceneNode = {
  id: 'page_text_only',
  name: '仅文字页面',
  type: 'PAGE',
  children: [
    {
      id: 'frame_text_only',
      name: '文字资源_劝学',
      type: 'FRAME',
      visible: true,
      children: [
        { id: 'text_author', name: 'author', type: 'TEXT', visible: true, characters: '荀子' },
        { id: 'text_content', name: 'content', type: 'TEXT', visible: true, characters: '君子曰：学不可以已...' },
      ],
    },
  ],
}

// ============ 核心扫描逻辑（与 Figma 插件一致） ============

function scanExportAssetsFrame(frame: MockSceneNode): AssetItem[] {
  const assets: AssetItem[] = []
  console.log(`\n  [扫描] Export Assets Frame，子节点数: ${frame.children?.length || 0}`)

  if (!frame.children) return assets

  for (const child of frame.children) {
    if (child.type !== 'FRAME') {
      console.log(`  [跳过] 非 Frame 节点: ${child.name} (${child.type})`)
      continue
    }

    // 子 Frame 名称作为 OSS 路径
    const ossPath = child.name.replace(/\/$/, '')
    console.log(`  [目录] 子 Frame: "${child.name}" → OSS 路径: "${ossPath}"`)

    if (!child.children) {
      console.log(`  [跳过] 空目录: ${child.name}`)
      continue
    }

    for (const leaf of child.children) {
      // 跳过非可视节点
      if (leaf.visible === false) {
        console.log(`  [跳过] 隐藏图层: ${leaf.name}`)
        continue
      }

      // 只处理可导出的图层类型
      const exportableTypes = [
        'RECTANGLE', 'ELLIPSE', 'VECTOR', 'IMAGE',
        'INSTANCE', 'COMPONENT', 'FRAME', 'GROUP',
      ]
      if (!exportableTypes.includes(leaf.type)) {
        console.log(`  [跳过] 不支持的类型(${leaf.type}): ${leaf.name}`)
        continue
      }

      // 文件名 = 图层名（必须包含扩展名）
      const fileName = leaf.name
      if (!/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(fileName)) {
        console.log(`  [跳过] 无有效扩展名: ${leaf.name}`)
        continue
      }

      const fullPath = `${ossPath}/${fileName}`
      console.log(`  [命中] ${leaf.type} → "${fullPath}"`)
      assets.push({
        ossPath: fullPath,
        fileName,
        type: ASSET_TYPE.IMAGE,
        nodeId: leaf.id,
        status: 'new',
      })
    }
  }

  return assets
}

function scanTextFrame(frame: MockSceneNode): AssetItem[] {
  const assets: AssetItem[] = []
  console.log(`\n  [扫描] 文字资源 Frame: "${frame.name}"`)

  const jsonData: Record<string, any> = {}

  if (!frame.children) {
    console.log(`  [跳过] 空文字 Frame`)
    return assets
  }

  for (const child of frame.children) {
    if (child.type === 'TEXT') {
      const fieldName = child.name
      const textContent = child.characters || ''
      jsonData[fieldName] = textContent
      console.log(`  [字段] TEXT "${fieldName}" = "${textContent.substring(0, 30)}${textContent.length > 30 ? '...' : ''}"`)
    } else if (child.type === 'FRAME') {
      console.log(`  [子组] 子 Frame: "${child.name}"`)
      const subData: Record<string, any> = {}

      if (child.children) {
        for (const subChild of child.children) {
          if (subChild.type === 'TEXT') {
            const subText = subChild.characters || ''
            subData[subChild.name] = subText
            console.log(`    [字段] TEXT "${subChild.name}" = "${subText.substring(0, 30)}${subText.length > 30 ? '...' : ''}"`)
          }
        }
      }

      if (Object.keys(subData).length > 0) {
        jsonData[child.name] = subData
      }
    }
  }

  if (Object.keys(jsonData).length > 0) {
    const jsonFileName = `${frame.name}.json`
    const jsonContent = JSON.stringify(jsonData, null, 2)
    const ossPath = `data/texts/${jsonFileName}`
    console.log(`  [产出] JSON 文件: "${ossPath}"`)
    console.log(`  [内容] ${jsonContent}`)

    assets.push({
      ossPath,
      fileName: jsonFileName,
      type: ASSET_TYPE.TEXT,
      nodeId: frame.id,
      content: jsonContent,
      status: 'new',
    })
  }

  return assets
}

function main(rootNode: MockSceneNode, scenarioName: string) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`测试场景: ${scenarioName}`)
  console.log(`${'='.repeat(60)}`)

  const allAssets: AssetItem[] = []

  // 1. 扫描 Export Assets Frame
  const exportAssetsFrame = rootNode.children?.find(
    (node) => node.type === 'FRAME' && node.name === 'Export Assets',
  ) || null

  if (exportAssetsFrame) {
    console.log(`\n>> 找到 Export Assets Frame`)
    const assets = scanExportAssetsFrame(exportAssetsFrame)
    allAssets.push(...assets)
  } else {
    console.log(`\n>> 未找到 Export Assets Frame`)
  }

  // 2. 扫描 文字资源_ Frame
  const textFrames = rootNode.children?.filter(
    (node) => node.type === 'FRAME' && node.name.startsWith('文字资源_'),
  ) || []

  if (textFrames.length > 0) {
    console.log(`\n>> 找到 ${textFrames.length} 个文字资源 Frame`)
    for (const frame of textFrames) {
      const textAssets = scanTextFrame(frame)
      allAssets.push(...textAssets)
    }
  } else {
    console.log(`\n>> 未找到文字资源 Frame`)
  }

  // 3. 输出最终结果
  console.log(`\n${'-'.repeat(40)}`)
  console.log(`扫描结果: ${allAssets.length} 个资源`)
  console.log(`${'-'.repeat(40)}`)

  const images = allAssets.filter((a) => a.type === 'image')
  const texts = allAssets.filter((a) => a.type === 'text')

  if (images.length > 0) {
    console.log(`\n图片资源 (${images.length}):`)
    images.forEach((a) => console.log(`  🖼  ${a.ossPath}`))
  }

  if (texts.length > 0) {
    console.log(`\n文字资源 (${texts.length}):`)
    texts.forEach((a) => console.log(`  📝 ${a.ossPath}`))
  }

  // 4. 预期结果验证
  console.log(`\n${'-'.repeat(40)}`)
  console.log('预期验证:')
  console.log(`${'-'.repeat(40)}`)

  const expectedCounts: Record<string, number> = {
    '通用组件文件': 4,  // 3 images/general + 1 images/cover (跳过音频/hidden/text/noext/line/mp3)
    '课文文件': 5,      // 3 culture_cards + 1 cover + 1 text
    '空文件': 0,
    '仅文字文件': 1,    // 1 text
  }

  const expected = expectedCounts[scenarioName] || 0
  if (allAssets.length === expected) {
    console.log(`  ✅ 通过: 预期 ${expected} 个资源，实际 ${allAssets.length} 个`)
  } else {
    console.log(`  ❌ 失败: 预期 ${expected} 个资源，实际 ${allAssets.length} 个`)
    console.log(`  ⚠️  请检查扫描逻辑是否正确过滤了不支持的节点`)
  }
}

// ============ 运行所有测试场景 ============

console.log(`
╔══════════════════════════════════════════════════╗
║      Figma 插件 - 节点解析逻辑模拟测试          ║
║      Mock Figma Node Tree Parser Test           ║
╚══════════════════════════════════════════════════╝
`)

main(generalFileMock, '通用组件文件')
main(lessonFileMock, '课文文件')
main(emptyFileMock, '空文件')
main(textOnlyFileMock, '仅文字文件')

console.log(`\n${'='.repeat(60)}`)
console.log('测试完成')
console.log(`${'='.repeat(60)}\n`)