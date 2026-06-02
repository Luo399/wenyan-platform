#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
text_basic_info 工作表数据转换器

负责处理课文基础信息数据的转换逻辑
"""

import logging
from typing import Dict, List, Any, Optional

from utils.data_transformer import validate_required_fields, remove_empty_fields

logger = logging.getLogger(__name__)

REQUIRED_FIELDS = ['text_id', 'title']

def transform_text_basic_info(raw_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    转换课文基础信息数据
    
    参数:
        raw_data: 原始数据列表
    
    返回:
        转换后的数据列表
    
    数据结构:
        {
            "text_id": "WEN_01",           // 课文ID
            "title": "陈涉世家",            // 课文标题
            "author": "司马迁",             // 作者
            "dynasty": "汉",               // 朝代
            "original_text": "...",        // 原文内容
            "illustration": "WEN_01_illus_1.png",  // 插图路径
            "bgm": "WEN_01_bgm_guzheng.mp3"        // 背景音乐路径
        }
    """
    result = []
    
    for row in raw_data:
        # 验证必需字段
        is_valid, missing = validate_required_fields(row, REQUIRED_FIELDS)
        if not is_valid:
            logger.warning(f"跳过无效行，缺失字段: {missing}")
            continue
        
        transformed = {
            'text_id': row.get('text_id'),
            'title': row.get('title'),
            'author': row.get('author'),
            'dynasty': row.get('dynasty'),
            'original_text': row.get('original_text'),
            'illustration': row.get('illustration'),
            'bgm': row.get('bgm'),
            'keywords': row.get('keywords'),
            'theme': row.get('theme'),
            'difficulty': row.get('difficulty'),
            'reading_time': row.get('reading_time'),
            'background': row.get('background')
        }
        
        # 移除空值字段
        cleaned = remove_empty_fields(transformed)
        result.append(cleaned)
    
    logger.info(f"转换完成: {len(result)} 条课文基础信息")
    return result

def group_by_text_id(data: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """
    按text_id分组数据，每组只保留第一个条目
    
    参数:
        data: 数据列表
    
    返回:
        按text_id分组的字典
    """
    groups = {}
    for item in data:
        text_id = item.get('text_id')
        if text_id and text_id not in groups:
            groups[text_id] = item
    return groups