#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据转换工具模块

提供通用的数据转换功能，如字母转索引、数据分组等
遵循单一职责原则，专注于数据的转换操作
"""

import logging
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

def convert_letter_to_index(letter: str) -> Optional[int]:
    """
    将字母选项(A/B/C/D)转换为数字索引(0/1/2/3)
    
    参数:
        letter: 字母(A/B/C/D)
    
    返回:
        数字索引(0/1/2/3)或None
    
    示例:
        >>> convert_letter_to_index('A')
        0
        >>> convert_letter_to_index('d')
        3
        >>> convert_letter_to_index('X')
        None
    """
    if not letter:
        return None
    
    letter = str(letter).strip().upper()
    if letter in ['A', 'B', 'C', 'D']:
        return ord(letter) - ord('A')
    
    return None

def group_by_column(
    data: List[Dict[str, Any]],
    column_name: str
) -> Dict[str, List[Dict[str, Any]]]:
    """
    按指定列分组数据
    
    参数:
        data: 数据列表
        column_name: 分组列名
    
    返回:
        分组后的字典，key为分组值，value为数据列表
    
    示例:
        >>> data = [{'text_id': 'WEN_01', 'name': 'a'}, {'text_id': 'WEN_02', 'name': 'b'}]
        >>> group_by_column(data, 'text_id')
        {'WEN_01': [{'text_id': 'WEN_01', 'name': 'a'}], 'WEN_02': [{'text_id': 'WEN_02', 'name': 'b'}]}
    """
    groups: Dict[str, List[Dict[str, Any]]] = {}
    
    for row in data:
        key = str(row.get(column_name, '')).strip()
        if not key:
            continue
        
        if key not in groups:
            groups[key] = []
        groups[key].append(row)
    
    return groups

def validate_required_fields(
    data: Dict[str, Any],
    required_fields: List[str]
) -> tuple:
    """
    验证必需字段是否存在
    
    参数:
        data: 数据字典
        required_fields: 必需字段列表
    
    返回:
        (是否通过验证, 缺失的字段列表)
    
    示例:
        >>> validate_required_fields({'name': 'test'}, ['name', 'age'])
        (False, ['age'])
        >>> validate_required_fields({'name': 'test', 'age': 18}, ['name', 'age'])
        (True, [])
    """
    missing = [field for field in required_fields if data.get(field) is None]
    return (len(missing) == 0, missing)

def remove_empty_fields(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    移除字典中的空值字段
    
    参数:
        data: 数据字典
    
    返回:
        移除空值后的字典
    
    示例:
        >>> remove_empty_fields({'name': 'test', 'age': None, 'city': ''})
        {'name': 'test'}
    """
    return {key: value for key, value in data.items() if value is not None and value != ''}

def merge_dicts(*dicts: Dict[str, Any]) -> Dict[str, Any]:
    """
    合并多个字典，后面的字典会覆盖前面的
    
    参数:
        *dicts: 要合并的字典
    
    返回:
        合并后的字典
    
    示例:
        >>> merge_dicts({'a': 1}, {'b': 2}, {'a': 3})
        {'a': 3, 'b': 2}
    """
    result: Dict[str, Any] = {}
    for d in dicts:
        result.update(d)
    return result

def ensure_list(value: Any) -> List[Any]:
    """
    确保值为列表，如果不是列表则包装为列表
    
    参数:
        value: 任意值
    
    返回:
        列表
    
    示例:
        >>> ensure_list('test')
        ['test']
        >>> ensure_list([1, 2, 3])
        [1, 2, 3]
        >>> ensure_list(None)
        []
    """
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]

def safe_get(data: Dict[str, Any], key: str, default: Any = None) -> Any:
    """
    安全获取字典值，避免KeyError
    
    参数:
        data: 数据字典
        key: 键名
        default: 默认值
    
    返回:
        对应的值或默认值
    
    示例:
        >>> safe_get({'name': 'test'}, 'name')
        'test'
        >>> safe_get({'name': 'test'}, 'age', 18)
        18
    """
    return data.get(key, default)