"use strict";
(() => {
  // core.ts
  function logDebug(...args) {
    console.log("[core][\u8C03\u8BD5]", ...args);
  }
  function logInfo(...args) {
    console.log("[core][\u4FE1\u606F]", ...args);
  }
  function logWarn(...args) {
    console.warn("[core][\u8B66\u544A]", ...args);
  }
  var EXPORT_TIMEOUT_MS = 3e4;
  var ASSET_TYPE = {
    IMAGE: "image",
    TEXT: "text"
  };
  var EXPORTABLE_TYPES = [
    "RECTANGLE",
    "ELLIPSE",
    "VECTOR",
    "IMAGE",
    "INSTANCE",
    "COMPONENT",
    "FRAME",
    "GROUP"
  ];
  var IMAGE_EXT_RE = /\.(png|jpg|jpeg|gif|webp|svg)$/i;
  function withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`\u64CD\u4F5C\u8D85\u65F6: ${label} (\u8D85\u8FC7 ${ms}ms)`));
      }, ms);
      promise.then(
        (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        }
      );
    });
  }
  function scanExportAssetsFrame(frame) {
    const assets = [];
    const totalChildren = frame.children?.length || 0;
    logDebug(`scanExportAssetsFrame: \u5171 ${totalChildren} \u4E2A\u5B50\u8282\u70B9`);
    if (!frame.children) {
      logWarn("Export Assets Frame \u6CA1\u6709\u5B50\u8282\u70B9");
      return assets;
    }
    for (let i = 0; i < frame.children.length; i++) {
      const child = frame.children[i];
      if (child.type !== "FRAME") {
        logDebug(`  [${i + 1}/${totalChildren}] \u8DF3\u8FC7\u975E Frame \u8282\u70B9: "${child.name}" (${child.type})`);
        continue;
      }
      const ossPath = child.name.replace(/\/$/, "");
      const subChildrenCount = child.children?.length || 0;
      logDebug(`  [${i + 1}/${totalChildren}] \u5904\u7406\u76EE\u5F55 "${child.name}" \u2192 OSS "${ossPath}" (${subChildrenCount} \u4E2A\u5B50\u8282\u70B9)`);
      if (!child.children) {
        logDebug(`    \u2192 \u7A7A\u76EE\u5F55\uFF0C\u8DF3\u8FC7`);
        continue;
      }
      let hitCount = 0;
      let skipCount = 0;
      for (const leaf of child.children) {
        if (leaf.visible === false) {
          logDebug(`    \u2192 [\u8DF3\u8FC7] \u9690\u85CF\u56FE\u5C42: "${leaf.name}"`);
          skipCount++;
          continue;
        }
        if (!EXPORTABLE_TYPES.includes(leaf.type)) {
          logDebug(`    \u2192 [\u8DF3\u8FC7] \u4E0D\u652F\u6301\u7684\u56FE\u5C42\u7C7B\u578B(${leaf.type}): "${leaf.name}"`);
          skipCount++;
          continue;
        }
        const fileName = leaf.name;
        if (!IMAGE_EXT_RE.test(fileName)) {
          logDebug(`    \u2192 [\u8DF3\u8FC7] \u65E0\u6709\u6548\u56FE\u7247\u6269\u5C55\u540D: "${leaf.name}"`);
          skipCount++;
          continue;
        }
        const fullPath = `${ossPath}/${fileName}`;
        logDebug(`    \u2192 [\u547D\u4E2D] ${leaf.type} \u2192 "${fullPath}"`);
        hitCount++;
        assets.push({
          ossPath: fullPath,
          fileName,
          type: ASSET_TYPE.IMAGE,
          nodeId: leaf.id,
          status: "new"
        });
      }
      logDebug(`    \u2192 \u76EE\u5F55 "${child.name}" \u5904\u7406\u5B8C\u6210: ${hitCount} \u547D\u4E2D, ${skipCount} \u8DF3\u8FC7`);
    }
    logDebug(`scanExportAssetsFrame \u5B8C\u6210: \u5171 ${assets.length} \u4E2A\u56FE\u7247\u8D44\u6E90`);
    return assets;
  }
  function resolveTextOssPath(frameName) {
    const rest = frameName.replace(/^文字资源_/, "").replace(/\/+$/, "");
    if (rest.includes("/")) {
      return `data/${rest}.json`;
    }
    return `data/texts/${frameName}.json`;
  }
  function scanTextFrame(frame) {
    const assets = [];
    logDebug(`scanTextFrame: "${frame.name}" (${frame.children?.length || 0} \u4E2A\u5B50\u8282\u70B9)`);
    const jsonData = {};
    if (!frame.children) {
      logWarn(`\u6587\u5B57\u8D44\u6E90 Frame "${frame.name}" \u6CA1\u6709\u5B50\u8282\u70B9`);
      return assets;
    }
    for (const child of frame.children) {
      if (child.type === "TEXT") {
        const textNode = child;
        const fieldName = child.name;
        const textContent = textNode.characters;
        jsonData[fieldName] = textContent;
        logDebug(`  [\u5B57\u6BB5] "${fieldName}" = "${textContent.substring(0, 50)}${textContent.length > 50 ? "..." : ""}" (${textContent.length} \u5B57)`);
      } else if (child.type === "FRAME") {
        const subFrame = child;
        logDebug(`  [\u5B50\u7EC4] \u53D1\u73B0\u5B50 Frame: "${child.name}" (${subFrame.children?.length || 0} \u4E2A\u5B50\u8282\u70B9)`);
        const subData = {};
        if (subFrame.children) {
          for (const subChild of subFrame.children) {
            if (subChild.type === "TEXT") {
              const subText = subChild;
              const subFieldName = subChild.name;
              const subTextContent = subText.characters;
              subData[subFieldName] = subTextContent;
              logDebug(`    [\u5B50\u5B57\u6BB5] "${subFieldName}" = "${subTextContent.substring(0, 50)}${subTextContent.length > 50 ? "..." : ""}"`);
            } else {
              logDebug(`    [\u8DF3\u8FC7] \u975E TEXT \u5B50\u8282\u70B9: "${subChild.name}" (${subChild.type})`);
            }
          }
        } else {
          logDebug(`    [\u8DF3\u8FC7] \u5B50 Frame \u4E3A\u7A7A`);
        }
        if (Object.keys(subData).length > 0) {
          jsonData[child.name] = subData;
          logDebug(`  [\u5B50\u7EC4] "${child.name}" \u5DF2\u6DFB\u52A0 ${Object.keys(subData).length} \u4E2A\u5B57\u6BB5`);
        } else {
          logDebug(`  [\u5B50\u7EC4] "${child.name}" \u65E0\u6709\u6548\u6587\u672C\u5B57\u6BB5\uFF0C\u8DF3\u8FC7`);
        }
      } else {
        logDebug(`  [\u8DF3\u8FC7] \u975E TEXT/FRAME \u8282\u70B9: "${child.name}" (${child.type})`);
      }
    }
    if (Object.keys(jsonData).length > 0) {
      const fieldCount = Object.keys(jsonData).length;
      const jsonContent = JSON.stringify(jsonData, null, 2);
      const ossPath = resolveTextOssPath(frame.name);
      logInfo(`  [\u4EA7\u51FA] JSON: "${ossPath}" (${fieldCount} \u4E2A\u5B57\u6BB5)`);
      assets.push({
        ossPath,
        fileName: `${frame.name}.json`,
        type: ASSET_TYPE.TEXT,
        nodeId: frame.id,
        content: jsonContent,
        status: "new"
      });
    } else {
      logWarn(`\u6587\u5B57\u8D44\u6E90 Frame "${frame.name}" \u672A\u63D0\u53D6\u5230\u4EFB\u4F55\u6587\u672C\u5185\u5BB9`);
    }
    return assets;
  }

  // code.ts
  var LOG_PREFIX = "[\u6587\u8A00\u6587\u540C\u6B65]";
  function logDebug2(...args) {
    console.log(LOG_PREFIX, "[\u8C03\u8BD5]", ...args);
  }
  function logInfo2(...args) {
    console.log(LOG_PREFIX, "[\u4FE1\u606F]", ...args);
  }
  function logWarn2(...args) {
    console.warn(LOG_PREFIX, "[\u8B66\u544A]", ...args);
  }
  function logError(...args) {
    console.error(LOG_PREFIX, "[\u9519\u8BEF]", ...args);
  }
  var DEFAULT_API_BASE = "https://api.classicalab.cn";
  async function main() {
    logInfo2("===== \u5F00\u59CB\u626B\u63CF =====");
    logInfo2("\u5F53\u524D\u6587\u4EF6\u9875\u9762:", figma.currentPage.name);
    const page = figma.currentPage;
    const allAssets = [];
    logDebug2("\u67E5\u627E Export Assets Frame...");
    const exportAssetsFrame = page.findOne(
      (node) => node.type === "FRAME" && node.name === "Export Assets"
    );
    if (exportAssetsFrame) {
      logInfo2("\u627E\u5230 Export Assets Frame\uFF0C\u5F00\u59CB\u626B\u63CF\u5B50\u8282\u70B9");
      const assets = scanExportAssetsFrame(exportAssetsFrame);
      logInfo2(`Export Assets \u626B\u63CF\u5B8C\u6210\uFF0C\u627E\u5230 ${assets.length} \u4E2A\u56FE\u7247\u8D44\u6E90`);
      allAssets.push(...assets);
    } else {
      logWarn2("\u672A\u627E\u5230 Export Assets Frame\uFF08\u5982\u4E0D\u9700\u8981\u56FE\u7247\u8D44\u6E90\u53EF\u5FFD\u7565\uFF09");
    }
    logDebug2("\u67E5\u627E\u6587\u5B57\u8D44\u6E90 Frame...");
    const textFrames = page.findAll(
      (node) => node.type === "FRAME" && node.name.startsWith("\u6587\u5B57\u8D44\u6E90_")
    );
    if (textFrames.length > 0) {
      logInfo2(`\u627E\u5230 ${textFrames.length} \u4E2A\u6587\u5B57\u8D44\u6E90 Frame: ${textFrames.map((f) => f.name).join(", ")}`);
      for (const frame of textFrames) {
        logDebug2(`\u626B\u63CF\u6587\u5B57\u8D44\u6E90 Frame: "${frame.name}"`);
        const textAssets = scanTextFrame(frame);
        logInfo2(`\u6587\u5B57\u8D44\u6E90 "${frame.name}" \u626B\u63CF\u5B8C\u6210\uFF0C\u5BFC\u51FA ${textAssets.length} \u4E2A JSON`);
        allAssets.push(...textAssets);
      }
    } else {
      logWarn2("\u672A\u627E\u5230\u6587\u5B57\u8D44\u6E90 Frame\uFF08\u5982\u4E0D\u9700\u8981\u6587\u5B57\u8D44\u6E90\u53EF\u5FFD\u7565\uFF09");
    }
    if (allAssets.length === 0) {
      logWarn2("\u672A\u627E\u5230\u4EFB\u4F55\u8D44\u6E90\uFF0C\u626B\u63CF\u7ED3\u675F");
      figma.ui.onmessage = () => {
        figma.closePlugin();
      };
      figma.ui.postMessage({
        type: "no-assets",
        message: "\u672A\u627E\u5230 Export Assets \u6216 \u6587\u5B57\u8D44\u6E90_ Frame\n\u8BF7\u5728\u5F53\u524D\u6587\u4EF6\u4E2D\u521B\u5EFA\u4EE5\u4E0B Frame\uFF1A\n\n1. Export Assets\uFF08\u56FE\u7247\u8D44\u6E90\uFF0C\u5B50 Frame \u540D\u5373 OSS \u8DEF\u5F84\uFF09\n2. \u6587\u5B57\u8D44\u6E90_{\u540D\u79F0}\uFF08\u6587\u5B57\u8D44\u6E90\uFF0C\u5BFC\u51FA\u4E3A JSON\uFF09"
      });
      return;
    }
    const imageCount = allAssets.filter((a) => a.type === "image").length;
    const textCount = allAssets.filter((a) => a.type === "text").length;
    logInfo2(`===== \u626B\u63CF\u5B8C\u6210: \u5171 ${allAssets.length} \u4E2A\u8D44\u6E90\uFF08${imageCount} \u56FE\u7247 + ${textCount} \u6587\u5B57\uFF09 =====`);
    allAssets.forEach((a) => logDebug2(`  ${a.type === "image" ? "\u56FE\u7247" : "\u6587\u5B57"} ${a.ossPath}`));
    figma.ui.postMessage({
      type: "scan-result",
      assets: allAssets,
      total: allAssets.length
    });
  }
  async function exportSingleNode(nodeId, ossPath) {
    try {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node) {
        logError(`  \u8282\u70B9\u4E0D\u5B58\u5728\u6216\u4E0D\u53EF\u8BBF\u95EE: "${ossPath}" (nodeId: ${nodeId})`);
        return new Uint8Array(0);
      }
      if ("removed" in node && node.removed === true) {
        logError(`  \u8282\u70B9\u5DF2\u88AB\u5220\u9664: "${ossPath}"`);
        return new Uint8Array(0);
      }
      const isSvg = ossPath.toLowerCase().endsWith(".svg");
      const exportOptions = isSvg ? { format: "SVG" } : { format: "PNG", constraint: { type: "SCALE", value: 2 } };
      logDebug2(`  \u2192 \u6B63\u5728\u5BFC\u51FA: "${ossPath}" (${isSvg ? "SVG" : "PNG"})`);
      const rawData = await withTimeout(
        node.exportAsync(exportOptions),
        EXPORT_TIMEOUT_MS,
        `exportAsync(${ossPath})`
      );
      logInfo2(`  \u5BFC\u51FA\u6210\u529F: "${ossPath}" (${rawData.byteLength} bytes)`);
      return new Uint8Array(rawData);
    } catch (err) {
      logError(`  \u5BFC\u51FA\u5931\u8D25: "${ossPath}"`, err);
      return new Uint8Array(0);
    }
  }
  async function prepareAssetsForUpload(assets) {
    logInfo2(`===== \u51C6\u5907\u5BFC\u51FA: ${assets.length} \u4E2A\u8D44\u6E90 =====`);
    const result = [];
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      logDebug2(`[${i + 1}/${assets.length}] \u5904\u7406: "${asset.ossPath}" (${asset.type})`);
      if (asset.type === ASSET_TYPE.IMAGE) {
        const data = await exportSingleNode(asset.nodeId, asset.ossPath);
        result.push({ ...asset, data });
      } else {
        logDebug2(`  \u2192 \u6587\u5B57\u8D44\u6E90, JSON \u957F\u5EA6: ${asset.content?.length || 0} \u5B57\u7B26`);
        result.push(asset);
      }
    }
    const imageCount = result.filter((a) => a.type === "image" && a.data && a.data.length > 0).length;
    const errorCount = result.filter((a) => a.type === "image" && (!a.data || a.data.length === 0)).length;
    logInfo2(`===== \u5BFC\u51FA\u5B8C\u6210: ${imageCount} \u56FE\u7247\u6210\u529F, ${errorCount} \u56FE\u7247\u5931\u8D25 =====`);
    return result;
  }
  figma.ui.onmessage = async (msg) => {
    if (msg.type === "sync") {
      const apiBase = msg.apiBase || DEFAULT_API_BASE;
      const apiToken = typeof msg.apiToken === "string" ? msg.apiToken.trim() : "";
      const assets = msg.assets;
      logInfo2(`===== \u6536\u5230\u540C\u6B65\u8BF7\u6C42: ${assets.length} \u4E2A\u8D44\u6E90, API: ${apiBase} =====`);
      logDebug2(`\u4EE4\u724C: ${apiToken ? "\u5DF2\u914D\u7F6E\uFF08\u957F\u5EA6 " + apiToken.length + "\uFF09" : "\u672A\u914D\u7F6E"}`);
      figma.ui.postMessage({ type: "sync-start", total: assets.length });
      try {
        const exportData = await prepareAssetsForUpload(assets);
        figma.ui.postMessage({
          type: "sync-data",
          apiBase,
          apiToken,
          assets: exportData
        });
      } catch (err) {
        logError("prepareAssetsForUpload \u5931\u8D25:", err);
        figma.ui.postMessage({
          type: "sync-error",
          error: String(err)
        });
      }
    }
    if (msg.type === "sync-done") {
      logInfo2(`===== \u540C\u6B65\u5B8C\u6210: ${msg.summary.uploaded} \u6210\u529F, ${msg.summary.errors} \u5931\u8D25 =====`);
      msg.summary.errorDetails?.forEach((e) => logError(`  \u5931\u8D25 ${e.fileName}: ${e.error}`));
      figma.ui.postMessage({
        type: "sync-complete",
        results: msg.results,
        summary: msg.summary
      });
    }
    if (msg.type === "cancel") {
      logInfo2("\u7528\u6237\u53D6\u6D88\u540C\u6B65");
      figma.closePlugin();
    }
  };
  figma.showUI(__html__, {
    width: 600,
    height: 500,
    themeColors: true
  });
  main().catch((err) => {
    logError("\u4E3B\u626B\u63CF\u6D41\u7A0B\u5F02\u5E38:", err);
    try {
      figma.ui.postMessage({
        type: "scan-error",
        error: String(err)
      });
    } catch (postErr) {
      logError("\u65E0\u6CD5\u5411 UI \u53D1\u9001\u9519\u8BEF\u6D88\u606F:", postErr);
    }
  });
})();
