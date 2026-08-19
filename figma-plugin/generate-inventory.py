#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Figma 插件资源清单生成器

用途：
  读取 production_version.json（后端 API 返回的资源记录），
  生成完整资源清单，包含：
    - 通用资源（通用样式、通用图片、文字资源）
    - 按 WEN 篇目 + Screen 类型分组的资源
    - 数据文件状态
  写入 figma-plugin/resource-inventory.json。

用法：
  python figma-plugin/generate-inventory.py

依赖：
  json（标准库）、os（标准库）
"""

import json
import os
import re
from datetime import datetime

# 文件路径
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, '..'))
PROD_FILE = os.path.join(PROJECT_ROOT, 'production_version.json')
TEST_FILE = os.path.join(PROJECT_ROOT, 'test_version.json')
OUTPUT_FILE = os.path.join(SCRIPT_DIR, 'resource-inventory.json')
DATA_DIR = os.path.join(PROJECT_ROOT, 'public', 'data')

# 37篇诗文
POEMS = {
    'WEN_01': '陈涉世家', 'WEN_02': '马说', 'WEN_03': '岳阳楼记', 'WEN_04': '庄子与惠子',
    'WEN_05': '论语十二章', 'WEN_06': '诫子书', 'WEN_07': '陋室铭', 'WEN_08': '爱莲说',
    'WEN_09': '孟子三章', 'WEN_10': '虽有嘉肴', 'WEN_11': '大道之行', 'WEN_12': '鱼我所欲也',
    'WEN_13': '送东阳马生序', 'WEN_14': '出师表', 'WEN_15': '三峡', 'WEN_16': '答谢中书书',
    'WEN_17': '记承天寺夜游', 'WEN_18': '与朱元思书', 'WEN_19': '桃花源记', 'WEN_20': '小石潭记',
    'WEN_21': '核舟记', 'WEN_22': '醉翁亭记', 'WEN_23': '湖心亭看雪', 'WEN_24': '孙权劝学',
    'WEN_25': '卖油翁', 'WEN_26': '周亚夫军细柳', 'WEN_27': '唐雎不辱使命', 'WEN_28': '曹刿论战',
    'WEN_29': '邹忌讽齐王纳谏', 'WEN_30': '穿井得一人', 'WEN_31': '杞人忧天', 'WEN_32': '愚公移山',
    'WEN_33': '北冥有鱼', 'WEN_34': '咏雪', 'WEN_35': '陈太丘与友期行', 'WEN_36': '狼', 'WEN_37': '活板',
}

# 数据文件子目录
DATA_SUBDIRS = [
    'text_basic_info', 'word_list', 'level1_quiz', 'multi_role_reading',
    'culture_cards', 'level2_dialog', 'level2_quiz', 'level3_quiz',
    'level3_scenario_text', 'pages_level2_dialog_quiz', 'pages_level3_adaptive_quiz',
    'text-quiz',
]

# 已知的 Screen 类型（按 UI 流程排序）
SCREEN_TYPES = ['video', 'explanation', 'dialogue', 'quiz', 'summary']

# 各 Screen 页面说明
SCREEN_TEXT_FIELDS = {
    'video': '逐句讲解视频页',
    'explanation': '逐句讲解页',
    'dialogue': '多角色对话页',
    'quiz': '课后测验页',
    'summary': '学习总结页',
}


def load_json(filepath):
    """加载 JSON 文件，不存在则返回 None"""
    if not os.path.exists(filepath):
        return None
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def make_entry(key, val):
    """将资源项转为字典"""
    return {
        'oss_path': key,
        'type': val.get('type', 'unknown'),
        'size': val.get('size', 0),
        'size_kb': f'{val.get("size", 0) / 1024:.1f} KB',
        'size_mb': f'{val.get("size", 0) / 1024 / 1024:.2f} MB',
        'updatedAt': val.get('updatedAt', ''),
    }


def check_data_files(wen_id):
    """检查 public/data/ 下该 WEN 的数据文件，返回 {subdir: 状态}"""
    result = {}
    for subdir in DATA_SUBDIRS:
        filepath = os.path.join(DATA_DIR, subdir, f'{wen_id}.json')
        if os.path.exists(filepath):
            size = os.path.getsize(filepath)
            result[subdir] = {'exists': True, 'size': size, 'size_kb': f'{size / 1024:.1f} KB'}
        else:
            result[subdir] = {'exists': False, 'size': 0, 'size_kb': '-'}
    return result


def build_inventory():
    """构建完整资源清单"""
    prod_data = load_json(PROD_FILE)
    test_data = load_json(TEST_FILE)

    prod_assets = prod_data.get('data', {}).get('assets', {}) if prod_data else {}
    test_assets = test_data.get('data', {}).get('assets', {}) if test_data else {}

    last_sync_prod = prod_data.get('data', {}).get('lastSyncAt', None) if prod_data else None
    last_sync_test = test_data.get('data', {}).get('lastSyncAt', None) if test_data else None

    inventory = {
        'meta': {
            'generated_at': datetime.now().strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z',
            'production_last_sync': last_sync_prod,
            'test_last_sync': last_sync_test,
            'total_wen_count': 37,
            'total_asset_count': len(prod_assets),
        },
        # ========== 通用资源（不属于任何 WEN） ==========
        'general': {
            'styles': {
                'figma_components': [],     # styles/Figma Basics.json 等通用组件样式
                'image_styles': [],          # styles/xxx.png.json 等图片对应的样式
                'text_styles': [],           # styles/文字资源_xxx.json 等文字资源样式
                'total_count': 0,
                'total_size_mb': '-',
            },
            'images': [],
            'texts': [],
            'total_count': 0,
            'total_size_mb': '-',
        },
        # ========== 按 WEN 分组的资源 ==========
        'wen_list': [],
        # ========== 汇总统计 ==========
        'summary': {
            'with_oss_resources': 0,
            'with_data_files': 0,
            'complete': 0,
            'missing_data_files': 0,
            'missing_oss_resources': 0,
            'unconfigured': 0,
        },
    }

    # ---- 第一步：分离通用资源和 WEN 资源 ----
    wen_assets = {}  # {wen_id: [entries]}
    for wen_id in POEMS:
        wen_assets[wen_id] = []

    general_styles_figma = []
    general_styles_image = []
    general_styles_text = []
    general_images = []
    general_texts = []

    for key, val in prod_assets.items():
        entry = make_entry(key, val)

        # 文字资源
        if key.startswith('data/texts/'):
            # 检查是否属于某个 WEN
            matched = False
            for wen_id in POEMS:
                if wen_id in key or f'/{wen_id}/' in key:
                    wen_assets[wen_id].append(entry)
                    matched = True
                    break
            if not matched:
                general_texts.append(entry)
            continue

        # 检查是否属于某个 WEN
        matched_wen = None
        for wen_id in POEMS:
            # 检查路径中是否包含该 WEN 的目录
            if f'/{wen_id}/' in key:
                matched_wen = wen_id
                break

        if matched_wen:
            wen_assets[matched_wen].append(entry)
        else:
            # 通用资源
            if entry['type'] == 'image':
                general_images.append(entry)
            elif entry['type'] == 'style':
                if '文字资源_' in key:
                    general_styles_text.append(entry)
                elif re.search(r'\.(png|jpg|jpeg|gif|webp|svg)\.json$', key):
                    general_styles_image.append(entry)
                else:
                    general_styles_figma.append(entry)
            else:
                general_images.append(entry)

    # 填充通用资源清单
    inventory['general']['styles']['figma_components'] = [e['oss_path'] for e in general_styles_figma]
    inventory['general']['styles']['image_styles'] = [e['oss_path'] for e in general_styles_image]
    inventory['general']['styles']['text_styles'] = [e['oss_path'] for e in general_styles_text]
    inventory['general']['styles']['total_count'] = len(general_styles_figma) + len(general_styles_image) + len(general_styles_text)
    total_style_size = sum(e['size'] for e in general_styles_figma + general_styles_image + general_styles_text)
    inventory['general']['styles']['total_size_mb'] = f'{total_style_size / 1024 / 1024:.1f} MB' if total_style_size > 0 else '-'

    inventory['general']['images'] = [e['oss_path'] for e in general_images]
    total_img_size = sum(e['size'] for e in general_images)
    inventory['general']['images_total_size_mb'] = f'{total_img_size / 1024 / 1024:.1f} MB' if total_img_size > 0 else '-'

    inventory['general']['texts'] = [e['oss_path'] for e in general_texts]
    total_text_size = sum(e['size'] for e in general_texts)
    inventory['general']['texts_total_size_mb'] = f'{total_text_size / 1024 / 1024:.1f} MB' if total_text_size > 0 else '-'

    # 通用资源总数
    general_total = (len(general_styles_figma) + len(general_styles_image) + len(general_styles_text)
                     + len(general_images) + len(general_texts))
    inventory['general']['total_count'] = general_total
    general_total_size = total_style_size + total_img_size + total_text_size
    inventory['general']['total_size_mb'] = f'{general_total_size / 1024 / 1024:.1f} MB' if general_total_size > 0 else '-'

    # ---- 第二步：按 WEN 分组整理 ----
    for i in range(1, 38):
        wen_id = f'WEN_{i:02d}'
        title = POEMS.get(wen_id, '未知')
        raw_entries = wen_assets.get(wen_id, [])

        # 按资源类型分组
        screen_images = {}   # {screen_type: [entries]}
        culture_card_images = []
        wen_general_images = []  # 该 WEN 目录下的其他图片
        wen_styles = []
        wen_texts = []

        for entry in raw_entries:
            key = entry['oss_path']
            # 文字资源
            if key.startswith('data/texts/'):
                wen_texts.append(entry)
                continue
            # 样式
            if entry['type'] == 'style':
                wen_styles.append(entry)
                # 也尝试匹配到 screen
                m = re.search(r'styles/images/screens/\w+/([^/]+)/', key)
                if m:
                    st = m.group(1)
                    if st not in screen_images:
                        screen_images[st] = {'images': [], 'style': None, 'image_count': 0, 'style_exists': False, 'total_size': 0}
                    screen_images[st]['style'] = entry
                    screen_images[st]['style_exists'] = True
                continue
            # 图片
            if entry['type'] == 'image':
                if 'culture_cards' in key:
                    culture_card_images.append(entry)
                    continue
                m = re.search(r'images/screens/\w+/([^/]+)/', key)
                if m:
                    st = m.group(1)
                    if st not in screen_images:
                        screen_images[st] = {'images': [], 'style': None, 'image_count': 0, 'style_exists': False, 'total_size': 0}
                    screen_images[st]['images'].append(entry)
                    screen_images[st]['image_count'] += 1
                    screen_images[st]['total_size'] += entry['size']
                    continue
                wen_general_images.append(entry)

        # 计算各 screen 统计
        total_images = sum(s['image_count'] for s in screen_images.values()) + len(culture_card_images) + len(wen_general_images)
        total_styles = len(wen_styles)

        # 构建 screen 级输出
        screens_output = {}
        for screen_type in SCREEN_TYPES:
            if screen_type in screen_images:
                sd = screen_images[screen_type]
                total_mb = f'{sd["total_size"] / 1024 / 1024:.1f} MB' if sd['total_size'] > 0 else '-'
                screens_output[screen_type] = {
                    'image_count': sd['image_count'],
                    'style_exists': sd['style_exists'],
                    'total_size_mb': total_mb,
                    'page_description': SCREEN_TEXT_FIELDS.get(screen_type, ''),
                    'resource_list': [img['oss_path'] for img in sd['images']],
                }
            else:
                screens_output[screen_type] = {
                    'image_count': 0,
                    'style_exists': False,
                    'total_size_mb': '-',
                    'page_description': SCREEN_TEXT_FIELDS.get(screen_type, ''),
                    'resource_list': [],
                }

        # 数据文件检查
        data_files = check_data_files(wen_id)

        # 状态判断
        has_oss = total_images > 0 or total_styles > 0
        has_data = any(v['exists'] for v in data_files.values())

        if has_oss and has_data:
            status = '完整'
            inventory['summary']['complete'] += 1
        elif has_oss and not has_data:
            status = '缺数据文件'
            inventory['summary']['missing_data_files'] += 1
        elif not has_oss and has_data:
            status = '缺OSS资源'
            inventory['summary']['missing_oss_resources'] += 1
        else:
            status = '未配置'
            inventory['summary']['unconfigured'] += 1

        if has_oss:
            inventory['summary']['with_oss_resources'] += 1
        if has_data:
            inventory['summary']['with_data_files'] += 1

        total_size = sum(e['size'] for e in raw_entries)
        total_size_mb = f'{total_size / 1024 / 1024:.1f} MB' if total_size > 0 else '-'

        wen_entry = {
            'wen_id': wen_id,
            'title': title,
            'status': status,
            'production': {
                'total_images': total_images,
                'total_styles': total_styles,
                'total_size_mb': total_size_mb,
                'screens': screens_output,
                'culture_cards': {
                    'image_count': len(culture_card_images),
                    'total_size_mb': f'{sum(e["size"] for e in culture_card_images) / 1024 / 1024:.1f} MB' if culture_card_images else '-',
                    'resource_list': [img['oss_path'] for img in culture_card_images],
                },
                'other_images': {
                    'image_count': len(wen_general_images),
                    'resource_list': [img['oss_path'] for img in wen_general_images],
                },
                'styles': {
                    'count': len(wen_styles),
                    'resource_list': [s['oss_path'] for s in wen_styles],
                },
                'texts': {
                    'count': len(wen_texts),
                    'resource_list': [t['oss_path'] for t in wen_texts],
                },
            },
            'test': {
                'total_images': 0,
                'total_styles': 0,
                'total_size_mb': '-',
            },
            'data_files': data_files,
        }

        inventory['wen_list'].append(wen_entry)

    # ---- 第三步：整体汇总 ----
    inventory['summary']['general_resource_count'] = general_total
    inventory['summary']['general_total_size_mb'] = inventory['general']['total_size_mb']
    inventory['summary']['wen_resource_count'] = inventory['meta']['total_asset_count'] - general_total
    inventory['summary']['grand_total_size_mb'] = (
        f'{(general_total_size + sum(sum(e["size"] for e in wen_assets[wid]) for wid in POEMS)) / 1024 / 1024:.1f} MB'
    )

    return inventory


def main():
    inventory = build_inventory()
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(inventory, f, ensure_ascii=False, indent=2)

    print(f'资源清单已写入: {OUTPUT_FILE}')
    print(f'生成时间: {inventory["meta"]["generated_at"]}')
    print(f'生产 API 最后同步: {inventory["meta"]["production_last_sync"]}')
    print(f'总资源数: {inventory["meta"]["total_asset_count"]}')
    print()
    print('--- 通用资源 ---')
    g = inventory['general']
    print(f'  通用样式: {g["styles"]["total_count"]} 个 ({g["styles"]["total_size_mb"]})')
    print(f'    - Figma 组件样式: {len(g["styles"]["figma_components"])} 个')
    print(f'    - 图片对应样式: {len(g["styles"]["image_styles"])} 个')
    print(f'    - 文字资源样式: {len(g["styles"]["text_styles"])} 个')
    print(f'  通用图片: {len(g["images"])} 个 ({g["images_total_size_mb"]})')
    print(f'  文字资源: {len(g["texts"])} 个 ({g["texts_total_size_mb"]})')
    print(f'  通用合计: {g["total_count"]} 个 ({g["total_size_mb"]})')
    print()
    print('--- WEN 资源统计 ---')
    for w in inventory['wen_list']:
        if w['status'] != '未配置':
            s = w['production']
            print(f'  {w["wen_id"]} {w["title"]}: {s["total_images"]} 图 + {s["total_styles"]} 样式 = {s["total_size_mb"]} [{w["status"]}]')
    print()
    print('状态统计:')
    print(f'  完整: {inventory["summary"]["complete"]}')
    print(f'  缺数据文件: {inventory["summary"]["missing_data_files"]}')
    print(f'  缺OSS资源: {inventory["summary"]["missing_oss_resources"]}')
    print(f'  未配置: {inventory["summary"]["unconfigured"]}')


if __name__ == '__main__':
    main()