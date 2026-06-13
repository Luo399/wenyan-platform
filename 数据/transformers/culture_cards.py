#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
culture_cards 工作表数据转换器

负责处理文化卡片数据的转换逻辑
"""

import logging
from typing import Dict, List, Any

from utils.data_transformer import validate_required_fields, remove_empty_fields, group_by_column

logger = logging.getLogger(__name__)

REQUIRED_FIELDS = ['text_id', 'card_id', 'card_name']

def transform_culture_cards(raw_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    转换文化卡片数据
    
    参数:
        raw_data: 原始数据列表
    
    返回:
        转换后的数据列表
    
    数据结构:
        {
            "text_id": "WEN_01",              // 课文ID
            "card_id": 1,                     // 卡片ID
            "card_name": "历史回响",          // 卡片名称
            "image_file": "WEN_01_card_uprising.mp4",  // 配图文件
            "knowledge_text": "...",          // 文化知识点文案
            "unlock_condition": "完成第二关..."  // 解锁条件描述
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
            'card_id': row.get('card_id'),
            'card_name': row.get('card_name'),
            'image_file': row.get('image_file'),
            'knowledge_text': row.get('knowledge_text'),
            'unlock_condition': row.get('unlock_condition')
        }
        
        # 移除空值字段
        cleaned = remove_empty_fields(transformed)
        result.append(cleaned)
    
    logger.info(f"转换完成: {len(result)} 张文化卡片")
    return result

def group_by_text_id(data: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """
    按text_id分组数据，并组织成 cards 结构
    
    参数:
        data: 数据列表
    
    返回:
        按text_id分组的字典
    """
    groups = group_by_column(data, 'text_id')
    
    result = {}
    for text_id, items in groups.items():
        result[text_id] = {
            'text_id': text_id,
            'cards': items
        }
    
    return result
