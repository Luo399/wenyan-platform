#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
JSON输出工具模块

提供JSON文件保存、格式化输出等功能
遵循单一职责原则，专注于数据的持久化操作
"""

import os
import json
import logging
from typing import Any, Dict, List, Callable

logger = logging.getLogger(__name__)

def save_json(
    data: Any,
    file_path: str,
    encoding: str = 'utf-8',
    indent: int = 2
) -> None:
    """
    保存数据为JSON文件
    
    参数:
        data: 要保存的数据
        file_path: 输出文件路径
        encoding: 文件编码，默认为utf-8
        indent: JSON缩进，默认为2
    
    异常:
        IOError: 文件写入失败
    """
    try:
        # 确保输出目录存在
        output_dir = os.path.dirname(file_path)
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
        
        with open(file_path, 'w', encoding=encoding) as f:
            json.dump(data, f, ensure_ascii=False, indent=indent)
        
        logger.info(f"已保存: {file_path}")
        
    except Exception as e:
        raise IOError(f"保存文件失败: {str(e)}")

def save_json_by_group(
    groups: Dict[str, List[Dict[str, Any]]],
    output_dir: str,
    file_namer: Callable[[str], str] = lambda key: f"{key}.json",
    **kwargs
) -> None:
    """
    按分组保存JSON文件
    
    参数:
        groups: 分组数据，key为分组名，value为数据列表
        output_dir: 输出目录
        file_namer: 文件名生成函数，接收分组名返回文件名
        **kwargs: 传递给save_json的参数
    
    示例:
        save_json_by_group(groups, './output', lambda key: f"data_{key}.json")
    """
    os.makedirs(output_dir, exist_ok=True)
    
    for key, items in groups.items():
        file_path = os.path.join(output_dir, file_namer(key))
        save_json(items, file_path, **kwargs)

def save_json_items(
    items: List[Dict[str, Any]],
    output_dir: str,
    id_field: str = 'text_id',
    **kwargs
) -> None:
    """
    将数据列表按ID字段分组保存为单独的JSON文件
    
    参数:
        items: 数据列表
        output_dir: 输出目录
        id_field: 用于分组的ID字段名，默认为'text_id'
        **kwargs: 传递给save_json的参数
    
    示例:
        save_json_items(items, './output', 'text_id')
    """
    os.makedirs(output_dir, exist_ok=True)
    
    for item in items:
        item_id = item.get(id_field) or item.get('pageId')
        if item_id:
            file_path = os.path.join(output_dir, f"{item_id}.json")
            save_json(item, file_path, **kwargs)

def format_json(data: Any, indent: int = 2) -> str:
    """
    将数据格式化为JSON字符串
    
    参数:
        data: 要格式化的数据
        indent: 缩进空格数
    
    返回:
        格式化后的JSON字符串
    """
    return json.dumps(data, ensure_ascii=False, indent=indent)

def validate_json(file_path: str) -> bool:
    """
    验证JSON文件格式是否正确
    
    参数:
        file_path: JSON文件路径
    
    返回:
        True表示格式正确，False表示格式错误
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            json.load(f)
        return True
    except json.JSONDecodeError:
        logger.error(f"JSON格式错误: {file_path}")
        return False
    except Exception as e:
        logger.error(f"读取JSON文件失败: {str(e)}")
        return False