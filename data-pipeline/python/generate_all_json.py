#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Excel转JSON批量生成工具 - 主入口（转换层唯一事实源）

职责：
  1. 读取 Excel 源文件（data-pipeline/source/*.xlsx）
  2. 按 sheet 调用 transformers/ 做字段转换
  3. 按 text_id 分组并写入 public/data/<子目录>/<text_id>.json

不做的事（由 data_processor 承担）：
  - 增量检测（IncrementalProcessor）
  - 版本快照（VersionManager）
  - OSS 上传（由 scripts/upload-to-oss.js 或 CI 承担）

路径约定：所有路径基于本文件所在目录（data-pipeline/python/）计算，
不依赖 cwd，可被 data_processor.main 作为子流程调用。
"""

import os
import logging
from typing import Optional

# 本文件所在目录 = data-pipeline/python/
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# data-pipeline 根目录
_PIPELINE_ROOT = os.path.dirname(_SCRIPT_DIR)

# 默认输入/输出路径（基于 _SCRIPT_DIR 的绝对路径）
DEFAULT_EXCEL_FILE = os.path.join(_PIPELINE_ROOT, 'source', '开发需求填写.dbt.xlsx')
DEFAULT_PUBLIC_DATA_DIR = os.path.normpath(os.path.join(_SCRIPT_DIR, '..', '..', 'public', 'data'))

# 日志配置：日志文件写入 _SCRIPT_DIR，避免 cwd 漂移
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(os.path.join(_SCRIPT_DIR, 'generate_all_json.log'), encoding='utf-8'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


def main(excel_file: Optional[str] = None, public_data_dir: Optional[str] = None) -> list:
    """
    主入口函数

    :param excel_file: Excel 源文件路径，默认 data-pipeline/source/开发需求填写.dbt.xlsx
    :param public_data_dir: JSON 输出根目录，默认 <仓库>/public/data/
    :return: 已生成的 JSON 文件绝对路径列表（供增量检测使用）
    """
    from utils import open_workbook, get_english_sheets
    from transformers import TRANSFORM_MAP

    excel_file = excel_file or DEFAULT_EXCEL_FILE
    public_data_dir = public_data_dir or DEFAULT_PUBLIC_DATA_DIR
    allowed_sheets = list(TRANSFORM_MAP.keys())

    if not os.path.exists(excel_file):
        raise FileNotFoundError(f"Excel文件不存在: {excel_file}")

    logger.info(f"正在打开Excel文件: {excel_file}")
    workbook = open_workbook(excel_file)

    english_sheets = get_english_sheets(workbook)
    logger.info(f"发现英文工作表: {english_sheets}")

    process_sheets = [s for s in english_sheets if s in allowed_sheets]
    logger.info(f"将处理的工作表: {process_sheets}")

    generated_files: list = []
    for sheet_name in process_sheets:
        try:
            files = process_sheet(workbook, sheet_name, excel_file, public_data_dir)
            generated_files.extend(files)
        except Exception as e:
            logger.error(f"处理工作表 '{sheet_name}' 失败: {str(e)}", exc_info=True)

    logger.info(f"所有工作表处理完成，共生成 {len(generated_files)} 个 JSON 文件")
    return generated_files


def process_sheet(workbook, sheet_name: str, excel_file: str, public_data_dir: str) -> list:
    """
    处理单个工作表

    :param workbook: Workbook 对象
    :param sheet_name: 工作表名称
    :param excel_file: Excel 源文件绝对路径（仅用于 ExcelConfig 记录）
    :param public_data_dir: JSON 输出根目录
    :return: 已生成的 JSON 文件绝对路径列表
    """
    from utils import ExcelConfig, read_sheet_full, save_json
    from transformers import TRANSFORM_MAP, GROUP_MAP, OUTPUT_DIR_MAP

    logger.info(f"\n===== 开始处理工作表: {sheet_name} =====")

    config = ExcelConfig(
        input_file=excel_file,
        sheet_name=sheet_name,
        header_row=1,
        property_row=2,
        data_start_row=3,
        empty_value_replacement=None
    )

    logger.info("读取工作表数据...")
    _header, raw_data = read_sheet_full(workbook, sheet_name, config)
    logger.info(f"读取到 {len(raw_data)} 行数据")

    transform_func = TRANSFORM_MAP.get(sheet_name)
    group_func = GROUP_MAP.get(sheet_name)
    # OUTPUT_DIR_MAP 的值是相对 _SCRIPT_DIR 的路径，这里转为基于 public_data_dir 的绝对路径
    output_subdir = OUTPUT_DIR_MAP.get(sheet_name, '')
    if not output_subdir:
        logger.warning(f"未找到工作表 '{sheet_name}' 的输出目录映射")
        return []
    # OUTPUT_DIR_MAP 形如 '../../public/data/word_list'，取最后一段作为子目录名
    subdir_name = os.path.basename(output_subdir.rstrip('/').rstrip('\\'))
    output_dir = os.path.join(public_data_dir, subdir_name)

    if not transform_func:
        logger.warning(f"未找到工作表 '{sheet_name}' 的转换函数")
        return []

    logger.info("转换数据...")
    transformed_data = transform_func(raw_data)

    logger.info("按text_id分组...")
    grouped_data = group_func(transformed_data)

    logger.info(f"保存到目录: {output_dir}")
    generated: list = []
    for text_id, data in grouped_data.items():
        output_path = os.path.join(output_dir, f"{text_id}.json")
        save_json(data, output_path)
        generated.append(os.path.abspath(output_path))

    logger.info(f"工作表 '{sheet_name}' 处理完成，生成 {len(grouped_data)} 个文件")
    return generated


if __name__ == '__main__':
    main()