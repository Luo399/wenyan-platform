#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据转换器模块包

包含7个工作表对应的转换器：
- text_basic_info: 课文基础信息
- level1_word_list: 一级字词列表
- level1_multi_role_reading: 一级多角色朗读
- level1_quiz: 一级测验
- level2_dialog_quiz: 二级对话测验
- level3_adaptive_quiz: 三级自适应测验
- culture_cards: 文化卡片
"""

from .text_basic_info import (
    transform_text_basic_info,
    group_by_text_id as group_text_basic_info
)

from .level1_word_list import (
    transform_level1_word_list,
    group_by_text_id as group_level1_word_list
)

from .level1_multi_role_reading import (
    transform_level1_multi_role_reading,
    group_by_text_id as group_level1_multi_role_reading
)

from .level1_quiz import (
    transform_level1_quiz,
    group_by_text_id as group_level1_quiz
)

from .level2_dialog_quiz import (
    transform_level2_dialog_quiz,
    group_by_text_id as group_level2_dialog_quiz
)

from .level3_adaptive_quiz import (
    transform_level3_adaptive_quiz,
    group_by_text_id as group_level3_adaptive_quiz
)

from .culture_cards import (
    transform_culture_cards,
    group_by_text_id as group_culture_cards
)

# 转换函数映射表
TRANSFORM_MAP = {
    'text_basic_info': transform_text_basic_info,
    'level1_word_list': transform_level1_word_list,
    'level1_multi_role_reading': transform_level1_multi_role_reading,
    'level1_quiz': transform_level1_quiz,
    'level2_dialog_quiz': transform_level2_dialog_quiz,
    'level3_adaptive_quiz': transform_level3_adaptive_quiz,
    'culture_cards': transform_culture_cards,
}

# 分组函数映射表
GROUP_MAP = {
    'text_basic_info': group_text_basic_info,
    'level1_word_list': group_level1_word_list,
    'level1_multi_role_reading': group_level1_multi_role_reading,
    'level1_quiz': group_level1_quiz,
    'level2_dialog_quiz': group_level2_dialog_quiz,
    'level3_adaptive_quiz': group_level3_adaptive_quiz,
    'culture_cards': group_culture_cards,
}

# 输出目录映射表（相对于 data-pipeline/python 目录）
OUTPUT_DIR_MAP = {
    'text_basic_info': '../../public/data/text_basic_info',
    'level1_word_list': '../../public/data/word_list',
    'level1_multi_role_reading': '../../public/data/multi_role_reading',
    'level1_quiz': '../../public/data/level1_quiz',
    'level2_dialog_quiz': '../../public/data/pages_level2_dialog_quiz',
    'level3_adaptive_quiz': '../../public/data/pages_level3_adaptive_quiz',
    'culture_cards': '../../public/data/culture_cards',
}

__all__ = [
    # 转换函数
    'transform_text_basic_info',
    'transform_level1_word_list',
    'transform_level1_multi_role_reading',
    'transform_level1_quiz',
    'transform_level2_dialog_quiz',
    'transform_level3_adaptive_quiz',
    'transform_culture_cards',
    
    # 分组函数
    'group_text_basic_info',
    'group_level1_word_list',
    'group_level1_multi_role_reading',
    'group_level1_quiz',
    'group_level2_dialog_quiz',
    'group_level3_adaptive_quiz',
    'group_culture_cards',
    
    # 映射表
    'TRANSFORM_MAP',
    'GROUP_MAP',
    'OUTPUT_DIR_MAP',
]