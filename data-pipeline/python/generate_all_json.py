#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Excel转JSON批量生成工具 - 主入口

负责协调各个模块，完成从Excel到JSON的完整转换流程
"""

import os
import logging
from typing import Dict, Any

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('generate_all_json.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

def main():
    """
    主入口函数
    
    流程：
    1. 打开Excel文件
    2. 获取所有英文命名的工作表
    3. 遍历每个工作表，读取数据并转换
    4. 按text_id分组数据
    5. 保存为JSON文件
    """
    # 导入模块（放在函数内避免循环导入）
    from utils import (
        open_workbook,
        ExcelConfig,
        read_sheet_full,
        get_english_sheets,
        save_json
    )
    from transformers import (
        TRANSFORM_MAP,
        GROUP_MAP,
        OUTPUT_DIR_MAP
    )
    
    # 配置参数
    EXCEL_FILE = '开发需求填写.dbt.xlsx'
    ALLOWED_SHEETS = list(TRANSFORM_MAP.keys())
    
    try:
        # 验证Excel文件存在
        if not os.path.exists(EXCEL_FILE):
            raise FileNotFoundError(f"Excel文件不存在: {EXCEL_FILE}")
        
        # 打开工作簿
        logger.info(f"正在打开Excel文件: {EXCEL_FILE}")
        workbook = open_workbook(EXCEL_FILE)
        
        # 获取所有英文命名的工作表
        english_sheets = get_english_sheets(workbook)
        logger.info(f"发现英文工作表: {english_sheets}")
        
        # 过滤允许处理的工作表
        process_sheets = [s for s in english_sheets if s in ALLOWED_SHEETS]
        logger.info(f"将处理的工作表: {process_sheets}")
        
        # 遍历处理每个工作表
        for sheet_name in process_sheets:
            try:
                process_sheet(workbook, sheet_name)
            except Exception as e:
                logger.error(f"处理工作表 '{sheet_name}' 失败: {str(e)}", exc_info=True)
        
        logger.info("所有工作表处理完成")
        
    except Exception as e:
        logger.error(f"执行失败: {str(e)}", exc_info=True)
        raise

def process_sheet(workbook, sheet_name: str):
    """
    处理单个工作表
    
    参数:
        workbook: Workbook对象
        sheet_name: 工作表名称
    """
    from utils import ExcelConfig, read_sheet_full, save_json
    from transformers import TRANSFORM_MAP, GROUP_MAP, OUTPUT_DIR_MAP
    
    logger.info(f"\n===== 开始处理工作表: {sheet_name} =====")
    
    # 创建配置
    config = ExcelConfig(
        input_file='开发需求填写.dbt.xlsx',
        sheet_name=sheet_name,
        header_row=1,
        property_row=2,
        data_start_row=3,
        empty_value_replacement=None
    )
    
    # 读取数据
    logger.info(f"读取工作表数据...")
    header, raw_data = read_sheet_full(workbook, sheet_name, config)
    logger.info(f"读取到 {len(raw_data)} 行数据")
    
    # 获取转换函数和分组函数
    transform_func = TRANSFORM_MAP.get(sheet_name)
    group_func = GROUP_MAP.get(sheet_name)
    output_dir = OUTPUT_DIR_MAP.get(sheet_name, '../public/data/output')
    
    if not transform_func:
        logger.warning(f"未找到工作表 '{sheet_name}' 的转换函数")
        return
    
    # 转换数据
    logger.info(f"转换数据...")
    transformed_data = transform_func(raw_data)
    
    # 按text_id分组
    logger.info(f"按text_id分组...")
    grouped_data = group_func(transformed_data)
    
    # 保存JSON文件
    logger.info(f"保存到目录: {output_dir}")
    for text_id, data in grouped_data.items():
        output_path = os.path.join(output_dir, f"{text_id}.json")
        save_json(data, output_path)
    
    logger.info(f"工作表 '{sheet_name}' 处理完成，生成 {len(grouped_data)} 个文件")

if __name__ == '__main__':
    main()