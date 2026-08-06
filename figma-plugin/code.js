"use strict";
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
 * 4. 显示变更列表，发送到后端 API
 *
 * 使用方式：
 *   在 Figma 中打开任意课文文件/通用文件 → 运行插件 → 自动扫描 → 确认同步
 *
 * OSS 路径规则：
 *   - 图片：Export Assets → 子 Frame 名即为 OSS 路径（如 images/culture_cards/WEN_01/card_bg.png）
 *   - 文字：文字资源_xxx Frame → data/texts/文字资源_xxx.json
 */
// ============ 日志工具 ============
// 在 Figma 中通过 Plugins → Development → Open Console 查看日志
const LOG_PREFIX = '[文言文同步]';
function logDebug(...args) {
    console.log(LOG_PREFIX, '[调试]', ...args);
}
function logInfo(...args) {
    console.log(LOG_PREFIX, '[信息]', ...args);
}
function logWarn(...args) {
    console.warn(LOG_PREFIX, '[警告]', ...args);
}
function logError(...args) {
    console.error(LOG_PREFIX, '[错误]', ...args);
}
// 后端 API 地址（可在插件 UI 中配置）
const DEFAULT_API_BASE = 'https://api.classicalab.cn';
// 资源类型枚举
const ASSET_TYPE = {
    IMAGE: 'image',
    TEXT: 'text',
};
/**
 * 主入口
 */
async function main() {
    logInfo('===== 开始扫描 =====');
    logInfo('当前文件页面:', figma.currentPage.name);
    // 获取当前页面
    const page = figma.currentPage;
    const allAssets = [];
    // 1. 扫描 Export Assets Frame
    logDebug('查找 Export Assets Frame...');
    const exportAssetsFrame = page.findOne((node) => node.type === 'FRAME' && node.name === 'Export Assets');
    if (exportAssetsFrame) {
        logInfo('找到 Export Assets Frame，开始扫描子节点');
        const assets = scanExportAssetsFrame(exportAssetsFrame);
        logInfo(`Export Assets 扫描完成，找到 ${assets.length} 个图片资源`);
        allAssets.push(...assets);
    }
    else {
        logWarn('未找到 Export Assets Frame（如不需要图片资源可忽略）');
    }
    // 2. 扫描 文字资源_ Frame
    logDebug('查找文字资源 Frame...');
    const textFrames = page.findAll((node) => node.type === 'FRAME' && node.name.startsWith('文字资源_'));
    if (textFrames.length > 0) {
        logInfo(`找到 ${textFrames.length} 个文字资源 Frame: ${textFrames.map((f) => f.name).join(', ')}`);
        for (const frame of textFrames) {
            logDebug(`扫描文字资源 Frame: "${frame.name}"`);
            const textAssets = scanTextFrame(frame);
            logInfo(`文字资源 "${frame.name}" 扫描完成，导出 ${textAssets.length} 个 JSON`);
            allAssets.push(...textAssets);
        }
    }
    else {
        logWarn('未找到文字资源 Frame（如不需要文字资源可忽略）');
    }
    // 3. 如果没有找到任何资源，提示用户
    if (allAssets.length === 0) {
        logWarn('未找到任何资源，扫描结束');
        figma.ui.onmessage = () => {
            figma.closePlugin();
        };
        figma.ui.postMessage({
            type: 'no-assets',
            message: '未找到 Export Assets 或 文字资源_ Frame\n请在当前文件中创建以下 Frame：\n\n1. Export Assets（图片资源，子 Frame 名即 OSS 路径）\n2. 文字资源_{名称}（文字资源，导出为 JSON）',
        });
        return;
    }
    // 4. 汇总日志
    const imageCount = allAssets.filter((a) => a.type === 'image').length;
    const textCount = allAssets.filter((a) => a.type === 'text').length;
    logInfo(`===== 扫描完成: 共 ${allAssets.length} 个资源（${imageCount} 图片 + ${textCount} 文字） =====`);
    allAssets.forEach((a) => logDebug(`  ${a.type === 'image' ? '🖼' : '📝'} ${a.ossPath}`));
    // 5. 发送到 UI 显示变更列表
    figma.ui.postMessage({
        type: 'scan-result',
        assets: allAssets,
        total: allAssets.length,
    });
}
/**
 * 扫描 Export Assets Frame 下的图片资源
 * 子 Frame 名称 = OSS 路径，图层名称 = 文件名
 */
function scanExportAssetsFrame(frame) {
    const assets = [];
    const totalChildren = frame.children?.length || 0;
    logDebug(`scanExportAssetsFrame: 共 ${totalChildren} 个子节点`);
    if (!frame.children) {
        logWarn('Export Assets Frame 没有子节点');
        return assets;
    }
    for (let i = 0; i < frame.children.length; i++) {
        const child = frame.children[i];
        if (child.type !== 'FRAME') {
            logDebug(`  [${i + 1}/${totalChildren}] 跳过非 Frame 节点: "${child.name}" (${child.type})`);
            continue;
        }
        // 子 Frame 名称作为 OSS 路径
        const ossPath = child.name.replace(/\/$/, '');
        const subChildrenCount = child.children?.length || 0;
        logDebug(`  [${i + 1}/${totalChildren}] 处理目录 "${child.name}" → OSS "${ossPath}" (${subChildrenCount} 个子节点)`);
        if (!child.children) {
            logDebug(`    → 空目录，跳过`);
            continue;
        }
        let hitCount = 0;
        let skipCount = 0;
        for (const leaf of child.children) {
            // 跳过非可视节点
            if (leaf.visible === false) {
                logDebug(`    → [跳过] 隐藏图层: "${leaf.name}"`);
                skipCount++;
                continue;
            }
            // 只处理可导出的图层类型
            const exportableTypes = [
                'RECTANGLE', 'ELLIPSE', 'VECTOR', 'IMAGE',
                'INSTANCE', 'COMPONENT', 'FRAME', 'GROUP',
            ];
            if (!exportableTypes.includes(leaf.type)) {
                logDebug(`    → [跳过] 不支持的图层类型(${leaf.type}): "${leaf.name}"`);
                skipCount++;
                continue;
            }
            // 文件名 = 图层名（必须包含扩展名）
            const fileName = leaf.name;
            if (!/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(fileName)) {
                logDebug(`    → [跳过] 无有效图片扩展名: "${leaf.name}"`);
                skipCount++;
                continue;
            }
            const fullPath = `${ossPath}/${fileName}`;
            logDebug(`    → [命中] ${leaf.type} → "${fullPath}"`);
            hitCount++;
            assets.push({
                ossPath: fullPath,
                fileName,
                type: ASSET_TYPE.IMAGE,
                nodeId: leaf.id,
                status: 'new',
            });
        }
        logDebug(`    → 目录 "${child.name}" 处理完成: ${hitCount} 命中, ${skipCount} 跳过`);
    }
    logDebug(`scanExportAssetsFrame 完成: 共 ${assets.length} 个图片资源`);
    return assets;
}
/**
 * 扫描文字资源 Frame 下的文本节点
 * Frame 命名格式：文字资源_{名称}（如 文字资源_论语·学而篇）
 * 子节点命名格式：{field_name}（如 knowledge_text, card_name）
 * 导出路径：data/texts/文字资源_{名称}.json
 */
function scanTextFrame(frame) {
    const assets = [];
    logDebug(`scanTextFrame: "${frame.name}" (${frame.children?.length || 0} 个子节点)`);
    // 构建 JSON 对象
    const jsonData = {};
    if (!frame.children) {
        logWarn(`文字资源 Frame "${frame.name}" 没有子节点`);
        return assets;
    }
    for (const child of frame.children) {
        if (child.type === 'TEXT') {
            // 直接读取 TextNode.characters
            const textNode = child;
            const fieldName = child.name;
            const textContent = textNode.characters;
            jsonData[fieldName] = textContent;
            logDebug(`  [字段] "${fieldName}" = "${textContent.substring(0, 50)}${textContent.length > 50 ? '...' : ''}" (${textContent.length} 字)`);
        }
        else if (child.type === 'FRAME') {
            // 子 Frame 中的文本节点
            const subFrame = child;
            logDebug(`  [子组] 发现子 Frame: "${child.name}" (${subFrame.children?.length || 0} 个子节点)`);
            const subData = {};
            if (subFrame.children) {
                for (const subChild of subFrame.children) {
                    if (subChild.type === 'TEXT') {
                        const subText = subChild;
                        const subFieldName = subChild.name;
                        const subTextContent = subText.characters;
                        subData[subFieldName] = subTextContent;
                        logDebug(`    [子字段] "${subFieldName}" = "${subTextContent.substring(0, 50)}${subTextContent.length > 50 ? '...' : ''}"`);
                    }
                    else {
                        logDebug(`    [跳过] 非 TEXT 子节点: "${subChild.name}" (${subChild.type})`);
                    }
                }
            }
            else {
                logDebug(`    [跳过] 子 Frame 为空`);
            }
            if (Object.keys(subData).length > 0) {
                jsonData[child.name] = subData;
                logDebug(`  [子组] "${child.name}" 已添加 ${Object.keys(subData).length} 个字段`);
            }
            else {
                logDebug(`  [子组] "${child.name}" 无有效文本字段，跳过`);
            }
        }
        else {
            logDebug(`  [跳过] 非 TEXT/FRAME 节点: "${child.name}" (${child.type})`);
        }
    }
    if (Object.keys(jsonData).length > 0) {
        const jsonFileName = `${frame.name}.json`;
        const fieldCount = Object.keys(jsonData).length;
        const jsonContent = JSON.stringify(jsonData, null, 2);
        const ossPath = `data/texts/${jsonFileName}`;
        logInfo(`  [产出] JSON: "${ossPath}" (${fieldCount} 个字段, ${jsonContent.length} 字节)`);
        assets.push({
            ossPath,
            fileName: jsonFileName,
            type: ASSET_TYPE.TEXT,
            nodeId: frame.id,
            content: jsonContent,
            status: 'new',
        });
    }
    else {
        logWarn(`文字资源 Frame "${frame.name}" 未提取到任何文本内容`);
    }
    return assets;
}
/**
 * 导出图片资源
 */
async function exportImageAsset(node, ossPath) {
    const fileName = ossPath.split('/').pop() || ossPath;
    logDebug(`开始导出图片: "${ossPath}"`);
    try {
        // 判断导出格式
        const isSvg = ossPath.toLowerCase().endsWith('.svg');
        const format = isSvg ? 'SVG' : 'PNG';
        const exportOptions = isSvg
            ? { format: 'SVG' }
            : { format: 'PNG', constraint: { type: 'SCALE', value: 2 } };
        logDebug(`  导出格式: ${format}, 节点类型: ${node.type}`);
        const data = await node.exportAsync(exportOptions);
        logInfo(`  导出成功: "${fileName}" (${data.byteLength} bytes, ${format})`);
        return {
            ossPath,
            fileName,
            type: ASSET_TYPE.IMAGE,
            size: data.byteLength,
            status: 'uploaded',
        };
    }
    catch (err) {
        logError(`导出失败: "${ossPath}"`, err);
        return {
            ossPath,
            fileName,
            type: ASSET_TYPE.IMAGE,
            size: 0,
            status: 'error',
            error: String(err),
        };
    }
}
/**
 * 上传到后端
 */
async function uploadToBackend(apiBase, assets) {
    const results = [];
    logInfo(`===== 开始上传: ${assets.length} 个资源到 ${apiBase} =====`);
    for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        logDebug(`[${i + 1}/${assets.length}] 处理: "${asset.ossPath}" (${asset.type})`);
        if (asset.type === ASSET_TYPE.TEXT) {
            // 文字资源：JSON 格式上传
            logDebug(`  → 文字资源, JSON 长度: ${asset.content?.length || 0} 字符`);
            try {
                const response = await fetch(`${apiBase}/api/assets/upload`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        files: [{
                                ossPath: asset.ossPath,
                                type: 'text',
                                content: asset.content,
                                encoding: 'utf-8',
                            }],
                    }),
                });
                const result = await response.json();
                if (result.success) {
                    logInfo(`  ✅ 上传成功: "${asset.ossPath}"`);
                    results.push({
                        ossPath: asset.ossPath,
                        fileName: asset.fileName,
                        type: ASSET_TYPE.TEXT,
                        size: new Blob([asset.content || '']).size,
                        status: 'uploaded',
                    });
                }
                else {
                    logError(`  ❌ 上传失败: "${asset.ossPath}" - ${result.message || '未知错误'}`);
                    results.push({
                        ossPath: asset.ossPath,
                        fileName: asset.fileName,
                        type: ASSET_TYPE.TEXT,
                        size: 0,
                        status: 'error',
                        error: result.message || '上传失败',
                    });
                }
            }
            catch (err) {
                logError(`  ❌ 网络错误: "${asset.ossPath}"`, err);
                results.push({
                    ossPath: asset.ossPath,
                    fileName: asset.fileName,
                    type: ASSET_TYPE.TEXT,
                    size: 0,
                    status: 'error',
                    error: String(err),
                });
            }
        }
        else {
            // 图片资源：导出后再上传
            logDebug(`  → 图片资源, 查找节点 ID: ${asset.nodeId}`);
            try {
                const node = figma.getNodeById(asset.nodeId);
                if (!node) {
                    logError(`  ❌ 节点不存在: "${asset.ossPath}" (nodeId: ${asset.nodeId})`);
                    results.push({
                        ossPath: asset.ossPath,
                        fileName: asset.fileName,
                        type: ASSET_TYPE.IMAGE,
                        size: 0,
                        status: 'error',
                        error: '节点不存在',
                    });
                    continue;
                }
                const exportResult = await exportImageAsset(node, asset.ossPath);
                if (exportResult.status === 'error') {
                    results.push(exportResult);
                    continue;
                }
                // 上传到后端
                logDebug(`  → 导出成功，准备上传到后端`);
                const formData = new FormData();
                const blob = new Blob([new Uint8Array(await (node.exportAsync(asset.ossPath.toLowerCase().endsWith('.svg')
                        ? { format: 'SVG' }
                        : { format: 'PNG', constraint: { type: 'SCALE', value: 2 } })))]);
                formData.append('files', blob, asset.fileName);
                formData.append('ossPath', asset.ossPath);
                formData.append('type', ASSET_TYPE.IMAGE);
                const response = await fetch(`${apiBase}/api/assets/upload`, {
                    method: 'POST',
                    body: formData,
                });
                const result = await response.json();
                if (result.success) {
                    logInfo(`  ✅ 上传成功: "${asset.ossPath}" (${exportResult.size} bytes)`);
                    results.push({
                        ...exportResult,
                        status: 'uploaded',
                    });
                }
                else {
                    logError(`  ❌ 上传失败: "${asset.ossPath}" - ${result.message || '未知错误'}`);
                    results.push({
                        ...exportResult,
                        status: 'error',
                        error: result.message || '上传失败',
                    });
                }
            }
            catch (err) {
                logError(`  ❌ 处理失败: "${asset.ossPath}"`, err);
                results.push({
                    ossPath: asset.ossPath,
                    fileName: asset.fileName,
                    type: ASSET_TYPE.IMAGE,
                    size: 0,
                    status: 'error',
                    error: String(err),
                });
            }
        }
    }
    const uploaded = results.filter((r) => r.status === 'uploaded').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    const errors = results.filter((r) => r.status === 'error').length;
    logInfo(`===== 上传完成: ${uploaded} 成功, ${skipped} 跳过, ${errors} 失败 =====`);
    return results;
}
// 监听 UI 消息
figma.ui.onmessage = async (msg) => {
    if (msg.type === 'sync') {
        const apiBase = msg.apiBase || DEFAULT_API_BASE;
        const assets = msg.assets;
        figma.ui.postMessage({ type: 'sync-start', total: assets.length });
        try {
            const results = await uploadToBackend(apiBase, assets);
            const uploaded = results.filter((r) => r.status === 'uploaded').length;
            const skipped = results.filter((r) => r.status === 'skipped').length;
            const errors = results.filter((r) => r.status === 'error');
            figma.ui.postMessage({
                type: 'sync-complete',
                results,
                summary: {
                    total: assets.length,
                    uploaded,
                    skipped,
                    errors: errors.length,
                    errorDetails: errors,
                },
            });
        }
        catch (err) {
            figma.ui.postMessage({
                type: 'sync-error',
                error: String(err),
            });
        }
    }
    if (msg.type === 'cancel') {
        figma.closePlugin();
    }
};
// 显示 UI
figma.showUI(__html__, { width: 600, height: 500 });
// 启动扫描
main().catch((err) => {
    figma.ui.postMessage({
        type: 'scan-error',
        error: String(err),
    });
});
