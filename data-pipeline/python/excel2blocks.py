#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Excel数据转Block模式JSON脚本

功能：
1. 读取level2_dialog_quiz工作表
2. 按行顺序生成blocks数组
3. question_number有值 -> type: 'quiz'
4. question_number为空 -> type: 'dialogue'
5. 按text_id分组，为每个text_id生成一个pages JSON文件
"""

import os
import json
import pandas as pd
import numpy as np

# 输入文件路径
INPUT_FILE = r"e:\cpp_discipline\wenyan-platform\数据\开发需求填写.dbt.xlsx"

# 输出目录 - pages配置文件位置
OUTPUT_DIR = r"e:\cpp_discipline\wenyan-platform\public\data\pages"


def read_level2_dialog_quiz(file_path):
    """读取level2_dialog_quiz工作表数据"""
    print(f"📥 正在读取Excel文件: {file_path}")
    
    # 读取整个sheet，header=None表示不设置表头
    df = pd.read_excel(file_path, sheet_name="level2_dialog_quiz", header=None)
    
    # 第一行是中文列名，第二行是英文列名
    chinese_names = df.iloc[0].tolist()
    english_names = df.iloc[1].tolist()
    
    print(f"📋 中文列名: {chinese_names}")
    print(f"🔤 英文列名: {english_names}")
    
    # 从第三行开始是实际数据
    data_df = df.iloc[2:]
    
    # 设置列名为英文列名
    data_df.columns = english_names
    
    # 将空值转换为None
    data_df = data_df.replace([np.nan, 'nan', '', ' ', None], None)
    
    # 转换为字典列表
    data = data_df.to_dict(orient='records')
    
    # 清理空值
    def clean_nulls(obj):
        if isinstance(obj, dict):
            return {k: clean_nulls(v) for k, v in obj.items()}
        elif pd.isna(obj) or obj == 'nan' or obj == '' or obj == ' ':
            return None
        return obj
    
    data = [clean_nulls(row) for row in data]
    
    # 过滤完全空的行
    data = [row for row in data if any(v is not None for v in row.values())]
    
    print(f"📈 读取到 {len(data)} 行有效数据")
    
    return data


def generate_blocks(data):
    """按text_id分组生成Block模式JSON"""
    # 按text_id分组
    groups = {}
    for row in data:
        text_id = row.get("text_id")
        if not text_id:
            continue
        
        if text_id not in groups:
            groups[text_id] = []
        
        # 判断是dialogue还是quiz
        question_number = row.get("question_number")
        
        if question_number is not None and str(question_number).strip() != '':
            # quiz类型
            block = {
                "type": "quiz",
                "data": {
                    "text_id": row.get("text_id"),
                    "question_number": int(question_number) if str(question_number).isdigit() else question_number,
                    "question_text": row.get("question_text"),
                    "option_a": row.get("option_a"),
                    "option_b": row.get("option_b"),
                    "option_c": row.get("option_c"),
                    "option_d": row.get("option_d"),
                    "audio_file": row.get("audio_file"),
                    "difficulty": row.get("difficulty"),
                    "pre_dialog": row.get("pre_dialog"),
                    "correct_answer": row.get("correct_answer"),
                    "explanation": row.get("explanation"),
                    "question_type": row.get("question_type")
                }
            }
        else:
            # dialogue类型
            block = {
                "type": "dialogue",
                "data": {
                    "text_id": row.get("text_id"),
                    "pre_dialog": row.get("pre_dialog"),
                    "audio_file": row.get("audio_file"),
                    "icon_dialog": row.get("icon_dialog")
                }
            }
        
        groups[text_id].append(block)
    
    return groups


def save_block_json(groups):
    """保存每个text_id对应的JSON文件"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    for text_id, blocks in groups.items():
        output = {
            "pageId": text_id,
            "blocks": blocks
        }
        
        output_path = os.path.join(OUTPUT_DIR, f"{text_id}.json")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        
        # 输出验证信息：前3个block的type
        print(f"\n✅ 已生成: {output_path}")
        print(f"   📊 总blocks数: {len(blocks)}")
        print(f"   🔖 前3个block类型: {[b['type'] for b in blocks[:3]]}")


def main():
    print("=" * 60)
    print("Excel转Block模式JSON工具")
    print("=" * 60)
    print(f"📥 输入文件: {INPUT_FILE}")
    print(f"📤 输出目录: {OUTPUT_DIR}")
    print("-" * 60)
    
    # 检查输入文件
    if not os.path.exists(INPUT_FILE):
        print(f"❌ 错误: 未找到文件 {INPUT_FILE}")
        return
    
    # 读取数据
    data = read_level2_dialog_quiz(INPUT_FILE)
    
    # 生成blocks
    groups = generate_blocks(data)
    
    # 保存JSON文件
    save_block_json(groups)
    
    print("\n" + "=" * 60)
    print("🎉 Block模式JSON生成完成！")
    print("=" * 60)
    print(f"📦 共生成 {len(groups)} 个页面配置文件")


if __name__ == "__main__":
    main()