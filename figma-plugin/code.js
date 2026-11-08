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
    TEXT: "text",
    // style：Figma 视觉属性（圆角/颜色/描边/阴影/布局/文字）提取产物，内容为 JSON
    STYLE: "style"
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
  var STYLE_FRAME_PREFIX = "\u6837\u5F0F_";
  var STYLE_SHARED_BASE_NAME = "_shared";
  var STYLE_MAX_NODES = 300;
  var STYLE_MAX_DEPTH = 6;
  var STYLE_MAX_JSON_BYTES = 480 * 1024;
  function resolveStyleOssPath(frameName) {
    const rest = String(frameName || "").replace(new RegExp(`^${STYLE_FRAME_PREFIX}`), "").replace(/\/+/g, "/").replace(/\/+$/, "").replace(/\s+/g, "_");
    if (!rest) return "";
    return `styles/${rest}.json`;
  }
  function isMixed(value) {
    return typeof value === "symbol";
  }
  function round(value, digits = 3) {
    const f = 10 ** digits;
    return Math.round(value * f) / f;
  }
  function px(value) {
    return typeof value === "number" && !isNaN(value) ? `${round(value, 2)}px` : void 0;
  }
  function rgbToHex(r, g, b) {
    const to255 = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255);
    const hex2 = (v) => v.toString(16).padStart(2, "0");
    return `#${hex2(to255(r))}${hex2(to255(g))}${hex2(to255(b))}`;
  }
  function solidToCss(color, opacity) {
    if (!color || typeof color.r !== "number" || typeof color.g !== "number" || typeof color.b !== "number") {
      return void 0;
    }
    const alpha = typeof opacity === "number" ? opacity : typeof color.a === "number" ? color.a : 1;
    const hex = rgbToHex(color.r, color.g, color.b);
    if (alpha >= 1) return hex;
    return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${round(alpha)})`;
  }
  function gradientAngleToCss(matrix, width, height) {
    if (!Array.isArray(matrix) || matrix.length < 6) return 180;
    const dx = matrix[0] * (typeof width === "number" && width > 0 ? width : 1);
    const dy = matrix[1] * (typeof height === "number" && height > 0 ? height : 1);
    const deg = Math.atan2(dx, -dy) * 180 / Math.PI;
    return Math.round((deg % 360 + 360) % 360);
  }
  function gradientToCss(paint, width, height) {
    const stops = paint && paint.gradientStops;
    if (!Array.isArray(stops) || stops.length === 0) return void 0;
    const parts = stops.map((s) => {
      const color = solidToCss(s.color, s.color && typeof s.color.a === "number" ? s.color.a : void 0) || "rgba(0, 0, 0, 0)";
      const pos = typeof s.position === "number" ? `${round(s.position * 100, 2)}%` : "0%";
      return `${color} ${pos}`;
    });
    if (paint.type === "GRADIENT_RADIAL") return `radial-gradient(${parts.join(", ")})`;
    if (paint.type === "GRADIENT_ANGULAR") return `conic-gradient(${parts.join(", ")})`;
    if (paint.type === "GRADIENT_LINEAR") {
      return `linear-gradient(${gradientAngleToCss(paint.gradientTransform, width, height)}deg, ${parts.join(", ")})`;
    }
    return void 0;
  }
  function paintToEntry(paint, width, height) {
    const entry = { type: String(paint.type) };
    if (typeof paint.opacity === "number") entry.opacity = round(paint.opacity, 4);
    if (paint.type === "SOLID" && paint.color) {
      entry.color = {
        r: round(paint.color.r, 5),
        g: round(paint.color.g, 5),
        b: round(paint.color.b, 5),
        ...typeof paint.color.a === "number" ? { a: round(paint.color.a, 5) } : {}
      };
      entry.hex = rgbToHex(paint.color.r, paint.color.g, paint.color.b);
      entry.css = solidToCss(paint.color, paint.opacity);
    } else if (String(paint.type).startsWith("GRADIENT")) {
      entry.gradientStops = Array.isArray(paint.gradientStops) ? paint.gradientStops.map((s) => ({
        position: round(s.position, 4),
        color: {
          r: round(s.color.r, 5),
          g: round(s.color.g, 5),
          b: round(s.color.b, 5),
          ...typeof s.color.a === "number" ? { a: round(s.color.a, 5) } : {}
        }
      })) : [];
      if (Array.isArray(paint.gradientTransform)) entry.gradientTransform = paint.gradientTransform.map((v) => round(v, 6));
      entry.css = gradientToCss(paint, width, height);
    } else if (paint.type === "IMAGE") {
      if (paint.imageRef) entry.imageRef = paint.imageRef;
      if (paint.scaleMode) entry.scaleMode = paint.scaleMode;
    }
    return entry;
  }
  function extractPaints(paints, width, height) {
    if (isMixed(paints)) return { mixed: true };
    if (!Array.isArray(paints)) return { list: [] };
    return { list: paints.filter((p) => p && p.visible !== false).map((p) => paintToEntry(p, width, height)) };
  }
  function paintsToBackgroundCss(list) {
    const css = {};
    const solids = list.filter((p) => p.type === "SOLID" && p.css);
    const gradients = list.filter((p) => String(p.type).startsWith("GRADIENT") && p.css);
    if (solids.length) css["background-color"] = solids[0].css;
    if (gradients.length) css["background-image"] = gradients.map((g) => g.css).join(", ");
    return css;
  }
  function extractCornerRadii(node) {
    if (typeof node.cornerRadius === "number" && !isNaN(node.cornerRadius)) {
      return { uniform: round(node.cornerRadius, 2) };
    }
    const CORNER_ORDER = ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"];
    const rect = node.rectangleCornerRadii;
    if (Array.isArray(rect) && rect.length === 4 && rect.every((v) => typeof v === "number")) {
      return { corners: rect.map((v) => round(v, 2)) };
    }
    if (CORNER_ORDER.every((k) => typeof node[k] === "number")) {
      return { corners: CORNER_ORDER.map((k) => round(node[k], 2)) };
    }
    return {};
  }
  function borderRadiusToCss(radii) {
    if (typeof radii.uniform === "number") return `${radii.uniform}px`;
    if (Array.isArray(radii.corners) && radii.corners.length === 4) {
      return radii.corners.map((v) => `${v}px`).join(" ");
    }
    return void 0;
  }
  function effectsToCss(effects) {
    const css = {};
    if (!Array.isArray(effects)) return css;
    const shadows = [];
    const blurs = [];
    const bgBlurs = [];
    for (const e of effects) {
      if (!e || e.visible === false) continue;
      const radius = px(e.radius) || "0px";
      if (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") {
        const x = px(e.offset && e.offset.x) || "0px";
        const y = px(e.offset && e.offset.y) || "0px";
        const spread = typeof e.spread === "number" ? ` ${px(e.spread)}` : "";
        const color = solidToCss(e.color) || "rgba(0, 0, 0, 0.3)";
        const inset = e.type === "INNER_SHADOW" ? "inset " : "";
        shadows.push(`${inset}${x} ${y} ${radius}${spread} ${color}`);
      } else if (e.type === "LAYER_BLUR") {
        blurs.push(`blur(${radius})`);
      } else if (e.type === "BACKGROUND_BLUR") {
        bgBlurs.push(`blur(${radius})`);
      }
    }
    if (shadows.length) css["box-shadow"] = shadows.join(", ");
    if (blurs.length) css.filter = blurs.join(" ");
    if (bgBlurs.length) css["backdrop-filter"] = bgBlurs.join(" ");
    return css;
  }
  function effectsToRaw(effects) {
    if (!Array.isArray(effects) || isMixed(effects)) return [];
    return effects.filter((e) => e && e.visible !== false).map((e) => ({
      type: String(e.type),
      ...typeof e.radius === "number" ? { radius: round(e.radius, 2) } : {},
      ...typeof e.spread === "number" ? { spread: round(e.spread, 2) } : {},
      ...e.offset ? { offset: { x: round(e.offset.x, 2), y: round(e.offset.y, 2) } } : {},
      ...e.color ? { color: { r: round(e.color.r, 5), g: round(e.color.g, 5), b: round(e.color.b, 5), a: round(typeof e.color.a === "number" ? e.color.a : 1, 5) } } : {}
    }));
  }
  var ALIGN_TO_CSS = {
    MIN: "flex-start",
    MAX: "flex-end",
    CENTER: "center",
    SPACE_BETWEEN: "space-between",
    BASELINE: "baseline"
  };
  function autoLayoutToCss(node) {
    const css = {};
    const mode = node.layoutMode;
    if (!mode || mode === "NONE") return css;
    if (mode === "GRID") {
      css.display = "grid";
      const cg = px(node.gridColumnGap);
      const rg = px(node.gridRowGap);
      if (cg) css["column-gap"] = cg;
      if (rg) css["row-gap"] = rg;
      return css;
    }
    css.display = "flex";
    css["flex-direction"] = mode === "VERTICAL" ? "column" : "row";
    const gap = px(node.itemSpacing);
    if (gap) css.gap = gap;
    const pad = [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft];
    if (pad.every((v) => typeof v === "number")) {
      css.padding = pad.map((v) => `${round(v, 2)}px`).join(" ");
    }
    const justify = ALIGN_TO_CSS[String(node.primaryAxisAlignItems)];
    if (justify) css["justify-content"] = justify;
    const alignItems = ALIGN_TO_CSS[String(node.counterAxisAlignItems)];
    if (alignItems) css["align-items"] = alignItems;
    if (node.layoutWrap === "WRAP") css["flex-wrap"] = "wrap";
    return css;
  }
  function autoLayoutToRaw(node) {
    const mode = node.layoutMode;
    if (!mode || mode === "NONE") return void 0;
    const raw = { layoutMode: mode };
    const numKeys = ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "itemSpacing", "counterAxisSpacing", "minWidth", "maxWidth", "minHeight", "maxHeight"];
    for (const k of numKeys) {
      if (typeof node[k] === "number") raw[k] = round(node[k], 2);
    }
    if (node.primaryAxisAlignItems) raw.primaryAxisAlignItems = node.primaryAxisAlignItems;
    if (node.counterAxisAlignItems) raw.counterAxisAlignItems = node.counterAxisAlignItems;
    if (node.primaryAxisSizingMode) raw.primaryAxisSizingMode = node.primaryAxisSizingMode;
    if (node.counterAxisSizingMode) raw.counterAxisSizingMode = node.counterAxisSizingMode;
    if (node.layoutWrap) raw.layoutWrap = node.layoutWrap;
    return raw;
  }
  function letterSpacingToCss(v) {
    if (!v || typeof v !== "object") return void 0;
    if (v.unit === "AUTO") return "normal";
    if (v.unit === "PIXELS" && typeof v.value === "number") return `${round(v.value, 3)}px`;
    if (v.unit === "PERCENT" && typeof v.value === "number") return `${round(v.value / 100, 4)}em`;
    return void 0;
  }
  function lineHeightToCss(v) {
    if (!v || typeof v !== "object") return void 0;
    if (v.unit === "AUTO") return "normal";
    if (v.unit === "PIXELS" && typeof v.value === "number") return `${round(v.value, 2)}px`;
    if (v.unit === "PERCENT" && typeof v.value === "number") return `${round(v.value / 100, 4)}`;
    return void 0;
  }
  var TEXT_CASE_TO_CSS = {
    UPPER: "uppercase",
    LOWER: "lowercase",
    TITLE: "capitalize",
    ORIGINAL: "none"
  };
  var TEXT_ALIGN_TO_CSS = {
    LEFT: "left",
    RIGHT: "right",
    CENTER: "center",
    JUSTIFIED: "justify"
  };
  function extractTextStyle(node) {
    const raw = {};
    const css = {};
    const read = (prop, rangeGetter) => {
      if (typeof node[rangeGetter] === "function") {
        try {
          const v2 = node[rangeGetter](0, 1);
          if (!isMixed(v2)) return v2;
        } catch {
        }
      }
      const v = node[prop];
      return isMixed(v) ? void 0 : v;
    };
    const fontName = read("fontName", "getRangeFontName");
    if (fontName && typeof fontName === "object" && fontName.family) {
      raw.fontName = { family: fontName.family, style: fontName.style };
      css["font-family"] = `"${fontName.family}", sans-serif`;
      if (typeof fontName.style === "string" && /italic|oblique/i.test(fontName.style)) {
        css["font-style"] = "italic";
      }
    }
    const fontSize = read("fontSize", "getRangeFontSize");
    if (typeof fontSize === "number") {
      raw.fontSize = round(fontSize, 2);
      css["font-size"] = `${round(fontSize, 2)}px`;
    }
    const weight = read("fontWeight", "getRangeFontWeight");
    if (typeof weight === "number") {
      raw.fontWeight = weight;
      css["font-weight"] = String(weight);
    }
    const ls = read("letterSpacing", "getRangeLetterSpacing");
    const lsCss = letterSpacingToCss(ls);
    if (lsCss) {
      raw.letterSpacing = ls;
      css["letter-spacing"] = lsCss;
    }
    const lh = read("lineHeight", "getRangeLineHeight");
    const lhCss = lineHeightToCss(lh);
    if (lhCss) {
      raw.lineHeight = lh;
      css["line-height"] = lhCss;
    }
    if (typeof node.paragraphSpacing === "number" && node.paragraphSpacing !== 0) {
      raw.paragraphSpacing = round(node.paragraphSpacing, 2);
      css["margin-bottom"] = `${round(node.paragraphSpacing, 2)}px`;
    }
    const align = TEXT_ALIGN_TO_CSS[String(node.textAlignHorizontal)];
    if (align) {
      raw.textAlignHorizontal = node.textAlignHorizontal;
      css["text-align"] = align;
    }
    if (node.textCase && TEXT_CASE_TO_CSS[String(node.textCase)]) {
      raw.textCase = node.textCase;
      css["text-transform"] = TEXT_CASE_TO_CSS[String(node.textCase)];
    }
    if (node.textDecoration === "UNDERLINE") {
      raw.textDecoration = node.textDecoration;
      css["text-decoration-line"] = "underline";
    } else if (node.textDecoration === "STRIKETHROUGH") {
      raw.textDecoration = node.textDecoration;
      css["text-decoration-line"] = "line-through";
    }
    const fills = extractPaints(node.fills, node.width, node.height);
    if (!("mixed" in fills)) {
      const solid = fills.list.find((p) => p.type === "SOLID" && p.css);
      if (solid) {
        css.color = solid.css;
        raw.colorHex = solid.hex;
      }
    }
    return { raw, css };
  }
  var BLEND_MODE_TO_CSS = {
    NORMAL: "normal",
    MULTIPLY: "multiply",
    SCREEN: "screen",
    OVERLAY: "overlay",
    DARKEN: "darken",
    LIGHTEN: "lighten",
    COLOR_DODGE: "color-dodge",
    COLOR_BURN: "color-burn",
    HARD_LIGHT: "hard-light",
    SOFT_LIGHT: "soft-light",
    DIFFERENCE: "difference",
    EXCLUSION: "exclusion"
  };
  function extractNodeStyle(node) {
    const raw = {};
    const css = {};
    const w = px(node.width);
    const h = px(node.height);
    if (w) {
      raw.width = round(node.width, 2);
      css.width = w;
    }
    if (h) {
      raw.height = round(node.height, 2);
      css.height = h;
    }
    if (typeof node.rotation === "number" && node.rotation !== 0) {
      raw.rotation = round(node.rotation, 3);
      css.transform = `rotate(${round(node.rotation, 3)}deg)`;
    }
    const radii = extractCornerRadii(node);
    if (typeof radii.uniform === "number") raw.cornerRadius = radii.uniform;
    if (radii.corners) raw.cornerRadii = { order: ["topLeft", "topRight", "bottomRight", "bottomLeft"], values: radii.corners };
    const radiusCss = borderRadiusToCss(radii) ?? (node.type === "ELLIPSE" ? "50%" : void 0);
    if (radiusCss) css["border-radius"] = radiusCss;
    const fills = extractPaints(node.fills, node.width, node.height);
    if ("mixed" in fills) {
      raw.fills = { mixed: true };
    } else if (fills.list.length) {
      raw.fills = fills.list;
      if (node.type !== "TEXT") Object.assign(css, paintsToBackgroundCss(fills.list));
    }
    const strokes = extractPaints(node.strokes, node.width, node.height);
    if ("mixed" in strokes) {
      raw.strokes = { mixed: true };
    } else if (strokes.list.length) {
      raw.strokes = strokes.list;
      const solid = strokes.list.find((p) => p.type === "SOLID" && p.css);
      const strokeWidth = isMixed(node.strokeWeight) ? void 0 : node.strokeWeight;
      if (typeof strokeWidth === "number") raw.strokeWeight = round(strokeWidth, 2);
      if (node.strokeAlign) raw.strokeAlign = node.strokeAlign;
      if (Array.isArray(node.dashPattern)) raw.dashPattern = node.dashPattern.map((v) => round(v, 2));
      const widthCss = px(strokeWidth);
      if (widthCss && solid) {
        css.border = `${widthCss} solid ${solid.css}`;
        if (node.strokeAlign === "INSIDE") css["box-sizing"] = "border-box";
      }
    }
    const effects = effectsToRaw(node.effects);
    if (effects.length) {
      raw.effects = effects;
      Object.assign(css, effectsToCss(node.effects));
    }
    if (typeof node.opacity === "number" && !isNaN(node.opacity)) {
      raw.opacity = round(node.opacity, 4);
      if (node.opacity < 1) css.opacity = String(round(node.opacity, 3));
    }
    if (node.blendMode && node.blendMode !== "NORMAL") {
      raw.blendMode = node.blendMode;
      const blend = BLEND_MODE_TO_CSS[String(node.blendMode)];
      if (blend && blend !== "normal") css["mix-blend-mode"] = blend;
    }
    if (node.isMask === true) raw.isMask = true;
    const autoLayout = autoLayoutToRaw(node);
    if (autoLayout) {
      raw.autoLayout = autoLayout;
      Object.assign(css, autoLayoutToCss(node));
    }
    if (node.type === "TEXT") {
      const text = extractTextStyle(node);
      raw.text = text.raw;
      Object.assign(css, text.css);
    }
    return { raw, css };
  }
  function collectStyleNodes(frame) {
    const entries = [];
    const usedPaths = /* @__PURE__ */ new Set();
    let hiddenSkipped = 0;
    let truncated = false;
    const uniquePath = (base, id) => {
      if (!usedPaths.has(base)) {
        usedPaths.add(base);
        return base;
      }
      const withId = `${base}#${id}`;
      usedPaths.add(withId);
      return withId;
    };
    const selfStyle = extractNodeStyle(frame);
    const self = {
      // tokens 的 usedBy 里用固定标记代表 Frame 本体（子图层是 child/... 路径）
      path: "@frame",
      nodeId: String(frame.id || ""),
      nodeName: String(frame.name || ""),
      nodeType: String(frame.type || ""),
      raw: selfStyle.raw,
      css: selfStyle.css
    };
    const walk = (node, prefix, depth) => {
      const children = node && node.children;
      if (!Array.isArray(children)) return true;
      for (const child of children) {
        if (truncated) return false;
        if (!child || child.visible === false) {
          if (child) hiddenSkipped++;
          continue;
        }
        if (entries.length >= STYLE_MAX_NODES) {
          truncated = true;
          logWarn(`\u6837\u5F0F\u63D0\u53D6\u8FBE\u5230\u8282\u70B9\u4E0A\u9650 ${STYLE_MAX_NODES}\uFF0C\u5DF2\u622A\u65AD`);
          return false;
        }
        if (depth > STYLE_MAX_DEPTH) {
          truncated = true;
          logWarn(`\u6837\u5F0F\u63D0\u53D6\u8FBE\u5230\u6DF1\u5EA6\u4E0A\u9650 ${STYLE_MAX_DEPTH}\uFF0C\u5DF2\u622A\u65AD`);
          return false;
        }
        const name = String(child.name || "(\u672A\u547D\u540D)");
        const path = uniquePath(prefix ? `${prefix}/${name}` : name, String(child.id || ""));
        const style = extractNodeStyle(child);
        entries.push({
          path,
          nodeId: String(child.id || ""),
          nodeName: name,
          nodeType: String(child.type || ""),
          raw: style.raw,
          css: style.css
        });
        if (!walk(child, path, depth + 1)) return false;
      }
      return true;
    };
    walk(frame, "", 1);
    return { self, entries, truncated, hiddenSkipped };
  }
  function tally(values) {
    const seen = /* @__PURE__ */ new Set();
    const map = /* @__PURE__ */ new Map();
    for (const [value, path] of values) {
      if (!value) continue;
      const pairKey = `${value}\0${path}`;
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);
      const hit = map.get(value);
      if (hit) {
        hit.count++;
        if (hit.usedBy.length < 3) hit.usedBy.push(path);
      } else {
        map.set(value, { value, count: 1, usedBy: [path] });
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  }
  function buildStyleTokens(entries) {
    const colors = [];
    const radii = [];
    const spacing = [];
    const shadows = [];
    const fonts = [];
    for (const e of entries) {
      const colorKeys = ["background-color", "color", "border"];
      for (const k of colorKeys) {
        const v = e.css[k];
        if (!v) continue;
        if (k === "border") {
          const m = v.match(/(#[0-9a-f]{6}|rgba?\([^)]*\))/i);
          if (m) colors.push([m[1], e.path]);
        } else {
          for (const part of v.split(",")) {
            const t = part.trim();
            if (/^(#|rgba?\()/i.test(t)) colors.push([t, e.path]);
          }
        }
      }
      if (e.css["background-image"]) colors.push([e.css["background-image"], e.path]);
      const radius = e.css["border-radius"];
      if (radius) for (const part of radius.split(",")) radii.push([part.trim(), e.path]);
      if (e.css.padding) for (const part of e.css.padding.split(" ")) spacing.push([part.trim(), e.path]);
      if (e.css.gap) for (const part of e.css.gap.split(" ")) spacing.push([part.trim(), e.path]);
      if (e.css["box-shadow"]) shadows.push([e.css["box-shadow"], e.path]);
      const fs = e.css["font-size"];
      const fw = e.css["font-weight"];
      const lh = e.css["line-height"];
      if (fs || fw || lh) {
        fonts.push([[fs, fw, lh].filter(Boolean).join(" / "), e.path]);
      }
    }
    return {
      color: tally(colors),
      radius: tally(radii),
      spacing: tally(spacing),
      shadow: tally(shadows),
      font: tally(fonts)
    };
  }
  function buildStyleDoc(frame, self, entries, meta) {
    const nodes = {};
    for (const e of entries) {
      nodes[e.path] = {
        nodeId: e.nodeId,
        nodeType: e.nodeType,
        css: e.css,
        ...meta.withRaw ? { raw: e.raw } : {}
      };
    }
    return {
      kind: "figma-style-tokens",
      schema: 1,
      source: {
        frame: String(frame.name || ""),
        nodeId: String(frame.id || ""),
        page: frame.parent && frame.parent.name ? String(frame.parent.name) : ""
      },
      meta: {
        nodeCount: entries.length,
        truncated: meta.truncated,
        hiddenSkipped: meta.hiddenSkipped,
        withRaw: meta.withRaw
      },
      // self = 样式_ Frame 本体（容器圆角/背景/自动布局常挂在这一层）
      self: {
        nodeId: self.nodeId,
        nodeType: self.nodeType,
        css: self.css,
        ...meta.withRaw ? { raw: self.raw } : {}
      },
      tokens: buildStyleTokens([self, ...entries]),
      nodes
    };
  }
  function utf8ByteLength(str) {
    let bytes = 0;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code < 128) bytes += 1;
      else if (code < 2048) bytes += 2;
      else if (code >= 55296 && code <= 56319) {
        bytes += 4;
        i++;
      } else bytes += 3;
    }
    return bytes;
  }
  function serializeStyleDoc(frame, self, entries, truncated, hiddenSkipped) {
    const full = JSON.stringify(buildStyleDoc(frame, self, entries, { truncated, hiddenSkipped, withRaw: true }), null, 2);
    if (utf8ByteLength(full) <= STYLE_MAX_JSON_BYTES) return full;
    logWarn("\u6837\u5F0F JSON \u8D85\u51FA\u5B57\u8282\u4E0A\u9650\uFF0C\u5148\u53BB\u6389 raw \u518D\u8BD5");
    const withoutRaw = JSON.stringify(buildStyleDoc(frame, self, entries, { truncated: true, hiddenSkipped, withRaw: false }), null, 2);
    if (utf8ByteLength(withoutRaw) <= STYLE_MAX_JSON_BYTES) return withoutRaw;
    logWarn("\u4ECD\u7136\u8D85\u9650\uFF0C\u9010\u6B65\u88C1\u526A\u8282\u70B9\u6761\u76EE");
    let step = Math.max(20, Math.floor(entries.length / 3));
    let shrunk = withoutRaw;
    while (step > 0) {
      const head = entries.slice(0, step);
      const candidate = JSON.stringify(buildStyleDoc(frame, self, head, { truncated: true, hiddenSkipped, withRaw: false }), null, 2);
      if (utf8ByteLength(candidate) <= STYLE_MAX_JSON_BYTES || step <= 20) {
        shrunk = candidate;
        break;
      }
      step = Math.floor(step / 2);
    }
    return shrunk;
  }
  function scanStyleFrame(frame) {
    const ossPath = resolveStyleOssPath(frame.name);
    if (!ossPath) {
      logWarn(`\u6837\u5F0F Frame "${frame.name}" \u53BB\u6389 \u6837\u5F0F_ \u524D\u7F00\u540E\u4E3A\u7A7A\uFF0C\u8DF3\u8FC7\uFF08\u8BF7\u547D\u540D\u4E3A \u6837\u5F0F_<\u6A21\u5757>\uFF09`);
      return [];
    }
    const { self, entries, truncated, hiddenSkipped } = collectStyleNodes(frame);
    if (entries.length === 0) {
      logWarn(`\u6837\u5F0F Frame "${frame.name}" \u5185\u6CA1\u6709\u53EF\u89C1\u56FE\u5C42\uFF0C\u8DF3\u8FC7`);
      return [];
    }
    const content = serializeStyleDoc(frame, self, entries, truncated, hiddenSkipped);
    const fileName = ossPath.split("/").pop();
    logInfo(`  [\u6837\u5F0F] "${frame.name}" \u2192 "${ossPath}"\uFF08${entries.length} \u4E2A\u8282\u70B9${truncated ? "\uFF0C\u5DF2\u622A\u65AD" : ""}\uFF09`);
    return [
      {
        ossPath,
        fileName,
        type: ASSET_TYPE.STYLE,
        nodeId: String(frame.id || ""),
        content,
        status: "new"
      }
    ];
  }
  function variableValueToCss(resolvedType, value) {
    if (resolvedType === "COLOR") return solidToCss(value);
    if (resolvedType === "FLOAT") {
      return typeof value === "number" ? `${round(value, 2)}px` : void 0;
    }
    if (resolvedType === "STRING") return typeof value === "string" ? value : void 0;
    if (resolvedType === "BOOLEAN") return typeof value === "boolean" ? String(value) : void 0;
    return void 0;
  }
  function buildSharedStylesAsset(input) {
    const paint = (input.paintStyles || []).map((s) => {
      const paints = extractPaints(s && s.paints);
      const list = "mixed" in paints ? [] : paints.list;
      const css = { ...paintsToBackgroundCss(list) };
      if (s && s.color && typeof s.color.r === "number") {
        css["background-color"] = solidToCss(s.color) || "";
      }
      return {
        name: String(s && s.name || ""),
        nodeId: String(s && s.nodeId || ""),
        description: s && s.description || "",
        css,
        raw: { paints }
      };
    });
    const text = (input.textStyles || []).map((s) => {
      const st = s && s.style || {};
      const pseudo = {
        type: "TEXT",
        ...st,
        fills: st.fills,
        width: void 0,
        height: void 0
      };
      const extracted = extractTextStyle(pseudo);
      return {
        name: String(s && s.name || ""),
        nodeId: String(s && s.nodeId || ""),
        description: s && s.description || "",
        css: extracted.css,
        raw: extracted.raw
      };
    });
    const effect = (input.effectStyles || []).map((s) => {
      const effects = s && s.effects || [];
      return {
        name: String(s && s.name || ""),
        nodeId: String(s && s.nodeId || ""),
        description: s && s.description || "",
        css: effectsToCss(effects),
        raw: { effects: effectsToRaw(effects) }
      };
    });
    const grid = (input.gridStyles || []).map((s) => ({
      name: String(s && s.name || ""),
      nodeId: String(s && s.nodeId || ""),
      description: s && s.description || "",
      css: {},
      raw: { layoutGrids: s && s.layoutGrids || [] }
    }));
    const modeNames = /* @__PURE__ */ new Map();
    const collections = (input.variableCollections || []).map((c) => {
      for (const modeId of Object.keys(c && c.modes || {})) {
        modeNames.set(String(modeId), String(c.modes[modeId].name));
      }
      return {
        name: String(c && c.name || ""),
        id: String(c && c.id || ""),
        modes: Object.keys(c && c.modes || {}).map((k) => String(c.modes[k].name))
      };
    });
    const variables = (input.variables || []).map((v) => {
      const valuesByMode = v && v.valuesByMode || {};
      const values = {};
      for (const modeId of Object.keys(valuesByMode)) {
        const key = modeNames.get(String(modeId)) || String(modeId);
        const raw = valuesByMode[modeId];
        values[key] = {
          raw: raw && typeof raw === "object" && typeof raw.r === "number" ? { r: round(raw.r, 5), g: round(raw.g, 5), b: round(raw.b, 5), a: round(typeof raw.a === "number" ? raw.a : 1, 5) } : raw,
          css: variableValueToCss(String(v.resolvedType), raw)
        };
      }
      return {
        name: String(v && v.name || ""),
        resolvedType: String(v && v.resolvedType || ""),
        collectionId: String(v && v.variableCollectionId || ""),
        description: v && v.description || "",
        values
      };
    });
    const total = paint.length + text.length + effect.length + grid.length + variables.length;
    if (total === 0) return [];
    const entries = [
      ...paint.map((p) => ({ path: `paint:${p.name}`, nodeId: p.nodeId, nodeName: p.name, nodeType: "PAINT_STYLE", raw: p.raw, css: p.css })),
      ...text.map((t) => ({ path: `text:${t.name}`, nodeId: t.nodeId, nodeName: t.name, nodeType: "TEXT_STYLE", raw: t.raw, css: t.css })),
      ...effect.map((e) => ({ path: `effect:${e.name}`, nodeId: e.nodeId, nodeName: e.name, nodeType: "EFFECT_STYLE", raw: e.raw, css: e.css })),
      ...variables.filter((v) => v.resolvedType === "COLOR").map((v) => {
        const first = Object.values(v.values)[0];
        return { path: `var:${v.name}`, nodeId: v.collectionId, nodeName: v.name, nodeType: "VARIABLE", raw: v.values, css: { "background-color": first && first.css || "" } };
      })
    ];
    const doc = {
      kind: "figma-local-styles",
      schema: 1,
      source: { page: String(input.pageName || ""), file: "\u5F53\u524D Figma \u6587\u4EF6" },
      meta: {
        paintCount: paint.length,
        textCount: text.length,
        effectCount: effect.length,
        gridCount: grid.length,
        variableCount: variables.length
      },
      tokens: buildStyleTokens(entries),
      styles: { paint, text, effect, grid },
      variableCollections: collections,
      variables
    };
    const content = JSON.stringify(doc, null, 2);
    if (utf8ByteLength(content) > STYLE_MAX_JSON_BYTES) {
      logWarn("\u5171\u4EAB\u6837\u5F0F\u4E0E\u53D8\u91CF\u4EA7\u7269\u8D85\u51FA\u5B57\u8282\u4E0A\u9650\uFF0C\u8DF3\u8FC7\u4E0A\u4F20\uFF08\u53EF\u7CBE\u7B80\u672C\u5730\u6837\u5F0F/\u53D8\u91CF\uFF09");
      return [];
    }
    const ossPath = `styles/${STYLE_SHARED_BASE_NAME}.json`;
    logInfo(`  [\u6837\u5F0F] \u5171\u4EAB\u6837\u5F0F\u4E0E\u53D8\u91CF \u2192 "${ossPath}"\uFF08${total} \u9879\uFF09`);
    return [{ ossPath, fileName: `${STYLE_SHARED_BASE_NAME}.json`, type: ASSET_TYPE.STYLE, nodeId: "", content, status: "new" }];
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
  function collectLocalStyles() {
    const f = figma;
    const pick = (fn) => typeof fn === "function" ? fn.call(f) || [] : [];
    return {
      paintStyles: pick(f.getLocalPaintStyles),
      textStyles: pick(f.getLocalTextStyles),
      effectStyles: pick(f.getLocalEffectStyles),
      gridStyles: pick(f.getLocalGridStyles),
      variables: pick(f.variables && f.variables.getLocalVariables),
      variableCollections: pick(f.variables && f.variables.getLocalVariableCollections)
    };
  }
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
    logDebug2("\u67E5\u627E\u6837\u5F0F Frame...");
    const styleFrames = page.findAll(
      (node) => node.type === "FRAME" && node.name.startsWith(STYLE_FRAME_PREFIX) && node.visible !== false
    );
    if (styleFrames.length > 0) {
      logInfo2(`\u627E\u5230 ${styleFrames.length} \u4E2A\u6837\u5F0F Frame: ${styleFrames.map((f) => f.name).join(", ")}`);
      for (const frame of styleFrames) {
        logDebug2(`\u626B\u63CF\u6837\u5F0F Frame: "${frame.name}"`);
        const styleAssets = scanStyleFrame(frame);
        allAssets.push(...styleAssets);
      }
    } else {
      logWarn2("\u672A\u627E\u5230\u6837\u5F0F Frame\uFF08\u5982\u4E0D\u9700\u8981 CSS \u53C2\u6570\u53EF\u5FFD\u7565\uFF09");
    }
    const sharedAssets = buildSharedStylesAsset({ ...collectLocalStyles(), pageName: page.name });
    if (sharedAssets.length === 0) {
      logWarn2("\u672A\u627E\u5230\u672C\u5730\u5171\u4EAB\u6837\u5F0F\u6216\u53D8\u91CF\uFF08Figma \u6587\u4EF6\u672A\u5B9A\u4E49\uFF0C\u6216\u5BA2\u6237\u7AEF\u4E0D\u652F\u6301\u53D8\u91CF API\uFF09");
    }
    allAssets.push(...sharedAssets);
    if (allAssets.length === 0) {
      logWarn2("\u672A\u627E\u5230\u4EFB\u4F55\u8D44\u6E90\uFF0C\u7B49\u5F85\u7528\u6237\u5904\u7406");
      figma.ui.postMessage({
        type: "no-assets",
        message: "\u672A\u627E\u5230 Export Assets / \u6587\u5B57\u8D44\u6E90_ / \u6837\u5F0F_ Frame\uFF0C\u4E5F\u6CA1\u6709\u672C\u5730\u5171\u4EAB\u6837\u5F0F\n\u8BF7\u786E\u8BA4\uFF1A\n1. \u5F53\u524D\u3010\u9009\u4E2D\u9875\u9762\u3011\u786E\u5B9E\u5305\u542B\u8FD9\u4E9B Frame\n2. Export Assets \u540D\u79F0\u5B8C\u5168\u4E00\u81F4\uFF08\u533A\u5206\u5927\u5C0F\u5199\uFF09\n3. \u8D44\u6E90\u547D\u540D\u7B26\u5408 docs/naming-convention.md\n\n\u2460 Export Assets\uFF08\u56FE\u7247\u8D44\u6E90\uFF0C\u5B50 Frame \u540D\u5373 OSS \u8DEF\u5F84\uFF09\n\u2461 \u6587\u5B57\u8D44\u6E90_{\u540D\u79F0}\uFF08\u6587\u5B57\u8D44\u6E90\uFF0C\u5BFC\u51FA\u4E3A JSON\uFF09\n\u2462 \u6837\u5F0F_{\u540D\u79F0}\uFF08CSS \u53C2\u6570\uFF0C\u5BFC\u51FA\u4E3A styles/{\u540D\u79F0}.json\uFF09"
      });
      return;
    }
    const imageCount = allAssets.filter((a) => a.type === "image").length;
    const textCount = allAssets.filter((a) => a.type === "text").length;
    const styleCount = allAssets.filter((a) => a.type === "style").length;
    logInfo2(
      `===== \u626B\u63CF\u5B8C\u6210: \u5171 ${allAssets.length} \u4E2A\u8D44\u6E90\uFF08${imageCount} \u56FE\u7247 + ${textCount} \u6587\u5B57 + ${styleCount} \u6837\u5F0F\uFF09 =====`
    );
    allAssets.forEach(
      (a) => logDebug2(`  ${a.type === "image" ? "\u56FE\u7247" : a.type === "style" ? "\u6837\u5F0F" : "\u6587\u5B57"} ${a.ossPath}`)
    );
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
    let imageSuccess = 0;
    let imageFailed = 0;
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      logDebug2(`[${i + 1}/${assets.length}] \u5904\u7406: "${asset.ossPath}" (${asset.type})`);
      if (asset.type === ASSET_TYPE.IMAGE) {
        const data = await exportSingleNode(asset.nodeId, asset.ossPath);
        if (data && data.length > 0) {
          result.push({ ...asset, data });
          imageSuccess++;
        } else {
          imageFailed++;
          logError(`  \u2192 \u8DF3\u8FC7\u7A7A\u5BFC\u51FA\uFF080 \u5B57\u8282\uFF09: "${asset.ossPath}"`);
        }
      } else {
        logDebug2(`  \u2192 ${asset.type === ASSET_TYPE.STYLE ? "\u6837\u5F0F" : "\u6587\u5B57"}\u8D44\u6E90, JSON \u957F\u5EA6: ${asset.content?.length || 0} \u5B57\u7B26`);
        result.push(asset);
      }
    }
    logInfo2(`===== \u5BFC\u51FA\u5B8C\u6210: ${imageSuccess} \u56FE\u7247\u6210\u529F, ${imageFailed} \u56FE\u7247\u5931\u8D25\uFF08\u5DF2\u8DF3\u8FC7\uFF0C\u4E0D\u8FDB\u5165\u4E0A\u4F20\u961F\u5217\uFF09 =====`);
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
