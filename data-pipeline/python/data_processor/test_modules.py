#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
模块测试脚本

用于验证重构后的各个模块是否正常工作
"""

import sys
import os

# 添加当前目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_utils():
    """测试工具模块"""
    print("=" * 60)
    print("测试 utils 模块")
    print("=" * 60)
    
    try:
        from utils import (
            ExcelHeader,
            ExcelConfig,
            open_workbook,
            get_english_sheets,
            save_json,
            convert_letter_to_index,
            group_by_column,
            validate_required_fields,
            remove_empty_fields
        )
        
        # 测试 ExcelHeader
        header = ExcelHeader(['课文ID', '标题'], ['text_id', 'title'])
        print(f"✓ ExcelHeader: {header}")
        
        # 测试 ExcelConfig
        config = ExcelConfig(input_file='test.xlsx')
        print(f"✓ ExcelConfig: 输入文件={config.input_file}")
        
        # 测试 convert_letter_to_index
        assert convert_letter_to_index('A') == 0
        assert convert_letter_to_index('d') == 3
        assert convert_letter_to_index('X') is None
        print(f"✓ convert_letter_to_index: 通过")
        
        # 测试 validate_required_fields
        data = {'name': 'test', 'age': None}
        is_valid, missing = validate_required_fields(data, ['name', 'age'])
        assert not is_valid and 'age' in missing
        print(f"✓ validate_required_fields: 通过")
        
        # 测试 remove_empty_fields
        cleaned = remove_empty_fields({'a': 1, 'b': None, 'c': ''})
        assert cleaned == {'a': 1}
        print(f"✓ remove_empty_fields: 通过")
        
        # 测试 group_by_column
        data = [
            {'text_id': 'WEN_01', 'name': 'a'},
            {'text_id': 'WEN_02', 'name': 'b'},
            {'text_id': 'WEN_01', 'name': 'c'}
        ]
        groups = group_by_column(data, 'text_id')
        assert len(groups) == 2
        assert len(groups['WEN_01']) == 2
        print(f"✓ group_by_column: 通过")
        
        print("✓ utils 模块测试通过\n")
        
    except Exception as e:
        print(f"✗ utils 模块测试失败: {e}")
        raise

def test_transformers():
    """测试转换器模块"""
    print("=" * 60)
    print("测试 transformers 模块")
    print("=" * 60)
    
    try:
        from transformers import (
            transform_text_basic_info,
            transform_level1_word_list,
            transform_level1_quiz,
            TRANSFORM_MAP,
            GROUP_MAP,
            OUTPUT_DIR_MAP
        )
        
        # 测试映射表
        assert len(TRANSFORM_MAP) == 7
        assert len(GROUP_MAP) == 7
        assert len(OUTPUT_DIR_MAP) == 7
        print(f"✓ 映射表完整性: 通过")
        
        # 测试 text_basic_info 转换器
        raw_data = [{
            'text_id': 'WEN_01',
            'title': '测试课文',
            'author': '测试作者'
        }]
        result = transform_text_basic_info(raw_data)
        assert len(result) == 1
        assert result[0]['text_id'] == 'WEN_01'
        print(f"✓ transform_text_basic_info: 通过")
        
        # 测试 level1_word_list 转换器
        raw_data = [{
            'text_id': 'WEN_01',
            'word': '测试词',
            'basic_meaning': '测试释义'
        }]
        result = transform_level1_word_list(raw_data)
        assert len(result) == 1
        assert result[0]['word'] == '测试词'
        print(f"✓ transform_level1_word_list: 通过")
        
        # 测试 level1_quiz 转换器
        raw_data = [{
            'text_id': 'WEN_01',
            'question_type': 'single',
            'question': '测试问题',
            'option_a': 'A选项',
            'option_b': 'B选项',
            'correct_answer': 'A'
        }]
        result = transform_level1_quiz(raw_data)
        assert len(result) == 1
        assert result[0]['correct_index'] == 0
        print(f"✓ transform_level1_quiz: 通过")
        
        print("✓ transformers 模块测试通过\n")
        
    except Exception as e:
        print(f"✗ transformers 模块测试失败: {e}")
        raise

def test_integration():
    """测试模块集成"""
    print("=" * 60)
    print("测试模块集成")
    print("=" * 60)
    
    try:
        from utils import open_workbook, get_english_sheets, ExcelConfig, read_sheet_full
        from transformers import TRANSFORM_MAP, GROUP_MAP
        
        # 测试打开Excel文件
        excel_file = '开发需求填写.dbt.xlsx'
        if os.path.exists(excel_file):
            workbook = open_workbook(excel_file)
            sheets = get_english_sheets(workbook)
            
            # 检查是否有匹配的工作表
            matching_sheets = [s for s in sheets if s in TRANSFORM_MAP]
            print(f"✓ Excel文件打开成功")
            print(f"✓ 发现工作表: {sheets}")
            print(f"✓ 匹配的转换器: {matching_sheets}")
            
            # 测试读取第一个匹配的工作表
            if matching_sheets:
                sheet_name = matching_sheets[0]
                config = ExcelConfig(excel_file, sheet_name=sheet_name)
                header, data = read_sheet_full(workbook, sheet_name, config)
                print(f"✓ 读取工作表 '{sheet_name}': {len(data)} 行")
                
                # 测试转换
                transform_func = TRANSFORM_MAP.get(sheet_name)
                if transform_func:
                    result = transform_func(data)
                    print(f"✓ 转换成功: {len(result)} 条记录")
                
                # 测试分组
                group_func = GROUP_MAP.get(sheet_name)
                if group_func:
                    grouped = group_func(result)
                    print(f"✓ 分组成功: {len(grouped)} 组")
        else:
            print(f"⚠ Excel文件不存在，跳过集成测试")
        
        print("✓ 模块集成测试通过\n")
        
    except Exception as e:
        print(f"✗ 模块集成测试失败: {e}")
        raise

def main():
    """运行所有测试"""
    print("\n" + "=" * 60)
    print("模块测试脚本")
    print("=" * 60 + "\n")
    
    try:
        test_utils()
        test_transformers()
        test_integration()
        
        print("=" * 60)
        print("所有测试通过！")
        print("=" * 60)
        
        return 0
    except Exception as e:
        print(f"\n✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    sys.exit(main())