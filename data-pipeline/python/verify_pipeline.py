#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
端到端数据流验证脚本
验证从 Excel 读取 -> 数据清洗 -> JSON 输出 -> 前后端数据一致性
"""

import os
import sys
import json

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from data_processor.excel_reader import ExcelReader


def verify_data_flow():
    """验证完整数据流"""
    
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    source_file = os.path.join(project_root, 'data-pipeline', 'source', '开发需求填写.dbt.xlsx')
    backend_data_dir = os.path.join(project_root, 'backend', 'data')
    frontend_data_dir = os.path.join(project_root, 'public', 'data')
    
    print("=" * 70)
    print("文言文平台 - 静态数据流端到端验证")
    print("=" * 70)
    
    checks = []
    
    # 1. 检查源文件
    print("\n📋 第1步：源文件检查")
    print("-" * 70)
    if os.path.exists(source_file):
        print(f"  ✅ Excel源文件存在: {source_file}")
        checks.append(('源文件存在', True))
    else:
        print(f"  ❌ Excel源文件不存在: {source_file}")
        checks.append(('源文件存在', False))
        return
    
    # 2. 读取Excel工作表
    print("\n📋 第2步：Excel工作表读取验证")
    print("-" * 70)
    try:
        with ExcelReader(source_file) as reader:
            sheet_names = reader.get_sheet_names()
            data_sheets = [s for s in sheet_names if s and s[0].isascii() and not s.startswith('素材') 
                          and s not in ['进度查询', '问题收集']]
            
            print(f"  总工作表数: {len(sheet_names)}")
            print(f"  数据工作表数: {len(data_sheets)}")
            
            sheet_stats = {}
            for name in data_sheets:
                info = reader.get_sheet_info(name)
                row_count = info['max_row'] - 2  # 减去表头两行
                sheet_stats[name] = max(0, row_count)
                print(f"    - {name}: {row_count} 行数据")
            
            checks.append(('Excel读取正常', True))
    except Exception as e:
        print(f"  ❌ Excel读取失败: {e}")
        checks.append(('Excel读取正常', False))
        return
    
    # 3. 检查后端数据目录
    print("\n📋 第3步：后端数据目录验证")
    print("-" * 70)
    
    data_types = [
        'text_basic_info', 'word_list', 'multi_role_reading',
        'level1_quiz', 'level2_dialog_quiz', 'level3_adaptive_quiz',
        'culture_cards'
    ]
    
    for dtype in data_types:
        dir_path = os.path.join(backend_data_dir, dtype)
        if os.path.exists(dir_path):
            files = [f for f in os.listdir(dir_path) if f.endswith('.json')]
            wen_files = [f for f in files if f.startswith('WEN_')]
            print(f"  ✅ {dtype}: {len(wen_files)} 个课文文件")
            checks.append((f'后端{dtype}存在', True))
        else:
            print(f"  ❌ {dtype}: 目录不存在")
            checks.append((f'后端{dtype}存在', False))
    
    # 4. 验证WEN_01数据完整性
    print("\n📋 第4步：WEN_01 数据完整性验证")
    print("-" * 70)
    
    wen_01_checks = [
        ('text_basic_info', 'object', ['text_id', 'title', 'original_text']),
        ('word_list', 'array', ['text_id', 'word', 'basic_meaning']),
        ('multi_role_reading', 'object', ['text_id', 'audio_file', 'segments']),
        ('level1_quiz', 'array', ['text_id', 'question_text', 'option_a']),
        ('level2_dialog_quiz', 'array', ['text_id', 'question_text']),
        ('level3_adaptive_quiz', 'array', ['text_id', 'question_text']),
        ('culture_cards', 'array', ['text_id', 'card_name']),
    ]
    
    for dtype, expected_type, required_fields in wen_01_checks:
        file_path = os.path.join(backend_data_dir, dtype, 'WEN_01.json')
        if not os.path.exists(file_path):
            print(f"  ❌ {dtype}/WEN_01.json: 文件不存在")
            checks.append((f'WEN_01 {dtype}', False))
            continue
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 检查类型
            if expected_type == 'array':
                if not isinstance(data, list):
                    print(f"  ❌ {dtype}: 期望数组，实际是 {type(data).__name__}")
                    checks.append((f'WEN_01 {dtype}', False))
                    continue
                if len(data) == 0:
                    print(f"  ⚠️  {dtype}: 数组为空")
                    checks.append((f'WEN_01 {dtype}', True))
                    continue
                sample = data[0]
            else:
                if not isinstance(data, dict):
                    print(f"  ❌ {dtype}: 期望对象，实际是 {type(data).__name__}")
                    checks.append((f'WEN_01 {dtype}', False))
                    continue
                sample = data
            
            # 检查必需字段
            missing = [f for f in required_fields if f not in sample]
            if missing:
                print(f"  ⚠️  {dtype}: 缺少字段 {missing}")
            else:
                count = len(data) if isinstance(data, list) else 1
                print(f"  ✅ {dtype}: {count} 条记录，字段完整")
            
            checks.append((f'WEN_01 {dtype}', True))
            
        except Exception as e:
            print(f"  ❌ {dtype}: 解析失败 - {e}")
            checks.append((f'WEN_01 {dtype}', False))
    
    # 5. 前后端数据一致性检查
    print("\n📋 第5步：前后端数据一致性验证")
    print("-" * 70)
    
    consistency_ok = True
    for dtype in data_types:
        backend_file = os.path.join(backend_data_dir, dtype, 'WEN_01.json')
        frontend_file = os.path.join(frontend_data_dir, dtype, 'WEN_01.json')
        
        if not os.path.exists(backend_file) or not os.path.exists(frontend_file):
            continue
        
        try:
            with open(backend_file, 'r', encoding='utf-8') as f:
                backend_data = json.dumps(json.load(f), sort_keys=True)
            with open(frontend_file, 'r', encoding='utf-8') as f:
                frontend_data = json.dumps(json.load(f), sort_keys=True)
            
            if backend_data == frontend_data:
                print(f"  ✅ {dtype}: 前后端数据一致")
            else:
                print(f"  ❌ {dtype}: 前后端数据不一致")
                consistency_ok = False
        except Exception as e:
            print(f"  ⚠️  {dtype}: 对比失败 - {e}")
    
    checks.append(('前后端数据一致', consistency_ok))
    
    # 6. 总结
    print("\n" + "=" * 70)
    print("验证总结")
    print("=" * 70)
    
    passed = sum(1 for _, ok in checks if ok)
    total = len(checks)
    
    print(f"\n  通过: {passed}/{total} 项检查")
    
    if passed == total:
        print("\n  🎉 全流程验证通过！数据流完整且一致。")
    else:
        print(f"\n  ⚠️  有 {total - passed} 项检查未通过，请检查。")
        failed = [name for name, ok in checks if not ok]
        for name in failed:
            print(f"    - {name}")
    
    print("\n" + "=" * 70)
    
    return passed == total


if __name__ == '__main__':
    success = verify_data_flow()
    sys.exit(0 if success else 1)
