import pandas as pd
import json
import os
import numpy as np

def excel_to_json(excel_path, output_dir, sheet_indices=[0, 1, 2]):
    """
    将Excel文件的指定Sheet转换为JSON格式
    
    参数:
        excel_path: Excel文件路径
        output_dir: JSON输出目录
        sheet_indices: 要转换的Sheet索引列表（从0开始），默认第1、2、3个表
    """
    os.makedirs(output_dir, exist_ok=True)
    
    xls = pd.ExcelFile(excel_path)
    all_sheet_names = xls.sheet_names
    print(f"📊 Excel文件中包含的Sheet: {all_sheet_names}")
    
    for idx in sheet_indices:
        if idx >= len(all_sheet_names):
            print(f"⚠️ 警告: Sheet索引 {idx} 超出范围，跳过")
            continue
            
        sheet_name = all_sheet_names[idx]
        print(f"\n🔄 正在处理第 {idx+1} 个Sheet: '{sheet_name}'")
        
        df = pd.read_excel(excel_path, sheet_name=sheet_name, header=None)
        
        if df.shape[0] < 2:
            print(f"⚠️ 警告: Sheet '{sheet_name}' 数据不足2行，跳过")
            continue
        
        # 第一行是中文列名（用于显示）
        chinese_names = df.iloc[0].tolist()
        # 第二行是英文列名（作为JSON属性名）
        english_names = df.iloc[1].tolist()
        
        print(f"📋 中文列名: {chinese_names}")
        print(f"🔤 英文列名(将作为JSON属性名): {english_names}")
        
        # 从第三行开始是实际数据
        data_df = df.iloc[2:]
        
        # 设置列名为英文列名
        data_df.columns = english_names
        
        # 将空值转换为None（JSON中的null）
        data_df = data_df.replace([np.nan, 'nan', '', ' ', None], None)
        
        # 转换为字典列表
        data = data_df.to_dict(orient='records')
        
        # 处理空值（确保JSON中输出null）
        def replace_nan(obj):
            if isinstance(obj, dict):
                return {k: replace_nan(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [replace_nan(item) for item in obj]
            elif pd.isna(obj) or obj == 'nan' or obj == '':
                return None
            return obj
        
        data = replace_nan(data)
        
        output_filename = f"{sheet_name}.json"
        output_path = os.path.join(output_dir, output_filename)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 已保存: {output_path}")
        print(f"📈 数据行数: {len(data)}")

if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    excel_file = os.path.join(script_dir, '开发需求填写.dbt.xlsx')
    output_directory = script_dir
    
    if not os.path.exists(excel_file):
        print(f"❌ 错误: 未找到文件 {excel_file}")
        exit(1)
    
    print("=" * 60)
    print("Excel转JSON工具")
    print("=" * 60)
    print(f"📥 输入文件: {excel_file}")
    print(f"📤 输出目录: {output_directory}")
    print("-" * 60)
    
    excel_to_json(excel_file, output_directory, sheet_indices=[0, 1, 2])
    
    print("\n" + "=" * 60)
    print("🎉 转换完成！")
    print("=" * 60)