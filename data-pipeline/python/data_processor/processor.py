#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据处理器核心模块
负责数据清洗、转换和JSON生成
"""

import os
import json
import logging
from typing import Dict, List, Any, Optional

from .config import DataProcessorConfig, SheetConfig, FieldMapping
from .excel_reader import ExcelReader

logger = logging.getLogger(__name__)


class DataProcessor:
    """数据处理器"""
    
    def __init__(self, config: DataProcessorConfig):
        """
        初始化数据处理器
        
        :param config: 数据处理器配置
        """
        self.config = config
        self.reader: Optional[ExcelReader] = None
        self.process_results: List[Dict[str, Any]] = []
        
        # 确保输出目录存在
        os.makedirs(config.output_dir, exist_ok=True)
    
    def _validate_data(self, row_data: Dict[str, Any], field_mappings: List[FieldMapping]) -> List[str]:
        """
        验证数据完整性
        
        :param row_data: 单行数据
        :param field_mappings: 字段映射列表
        :return: 错误信息列表
        """
        errors = []
        
        for mapping in field_mappings:
            if mapping.required:
                value = row_data.get(mapping.source_column)
                if value is None:
                    errors.append(f"缺少必需字段: {mapping.source_column}")
        
        return errors
    
    def _transform_field(self, value: Any, mapping: FieldMapping) -> Any:
        """
        转换字段值
        
        :param value: 原始值
        :param mapping: 字段映射配置
        :return: 转换后的值
        """
        # 如果值为空，返回默认值
        if value is None:
            return mapping.default_value
        
        # 应用转换函数
        if mapping.transform_func:
            try:
                return mapping.transform_func(value)
            except Exception as e:
                logger.warning(f"字段 '{mapping.source_column}' 转换失败: {str(e)}")
                return mapping.default_value
        
        return value
    
    def _process_row(self, row_data: Dict[str, Any], field_mappings: List[FieldMapping]) -> Dict[str, Any]:
        """
        处理单行数据
        
        :param row_data: 原始行数据
        :param field_mappings: 字段映射列表
        :return: 处理后的行数据
        """
        result = {}
        
        for mapping in field_mappings:
            source_value = row_data.get(mapping.source_column)
            target_value = self._transform_field(source_value, mapping)
            result[mapping.target_field] = target_value
        
        return result
    
    def _process_sheet(self, sheet_config: SheetConfig) -> Dict[str, Any]:
        """
        处理单个工作表
        
        :param sheet_config: 工作表配置
        :return: 处理结果
        """
        result = {
            'sheet_name': sheet_config.sheet_name,
            'output_file': sheet_config.output_file,
            'total_rows': 0,
            'processed_rows': 0,
            'errors': [],
            'warnings': [],
            'success': False
        }
        
        try:
            # 读取原始数据
            raw_data = self.reader.read_sheet_data(
                sheet_name=sheet_config.sheet_name,
                header_row=sheet_config.header_row,
                property_row=sheet_config.property_row,
                data_start_row=sheet_config.data_start_row,
                filter_func=sheet_config.filter_func
            )
            
            result['total_rows'] = len(raw_data)
            logger.info(f"工作表 '{sheet_config.sheet_name}' 原始数据行数: {len(raw_data)}")
            
            # 处理每一行数据
            processed_data = []
            for row_idx, row_data in enumerate(raw_data):
                # 验证数据
                validation_errors = self._validate_data(row_data, sheet_config.field_mappings)
                if validation_errors:
                    result['errors'].append({
                        'row': row_idx + sheet_config.data_start_row,
                        'errors': validation_errors
                    })
                    continue
                
                # 转换数据
                processed_row = self._process_row(row_data, sheet_config.field_mappings)
                
                # 应用后处理函数
                if sheet_config.post_process_func:
                    try:
                        processed_row = sheet_config.post_process_func(processed_row)
                    except Exception as e:
                        result['warnings'].append({
                            'row': row_idx + sheet_config.data_start_row,
                            'warning': f"后处理失败: {str(e)}"
                        })
                
                processed_data.append(processed_row)
            
            result['processed_rows'] = len(processed_data)
            
            # 保存JSON文件
            output_path = os.path.join(self.config.output_dir, sheet_config.output_file)
            self._save_json(processed_data, output_path)
            
            result['success'] = True
            logger.info(f"工作表 '{sheet_config.sheet_name}' 处理完成，输出到: {output_path}")
        
        except Exception as e:
            result['errors'].append(f"处理失败: {str(e)}")
            logger.error(f"处理工作表 '{sheet_config.sheet_name}' 时发生错误: {str(e)}")
        
        return result
    
    def _save_json(self, data: Any, file_path: str):
        """
        保存JSON文件
        
        :param data: 要保存的数据
        :param file_path: 输出文件路径
        """
        try:
            with open(file_path, 'w', encoding=self.config.encoding) as f:
                json.dump(data, f, ensure_ascii=False, indent=self.config.json_indent)
            logger.debug(f"已保存JSON文件: {file_path}")
        except Exception as e:
            raise IOError(f"保存JSON文件失败: {str(e)}")
    
    def process(self) -> List[Dict[str, Any]]:
        """
        执行数据处理流程
        
        :return: 处理结果列表
        """
        logger.info("=" * 60)
        logger.info("开始数据处理流程")
        logger.info("=" * 60)
        
        self.process_results = []
        
        try:
            # 打开Excel文件
            self.reader = ExcelReader(self.config.input_file)
            self.reader.open_workbook()
            
            logger.info(f"输入文件: {self.config.input_file}")
            logger.info(f"输出目录: {self.config.output_dir}")
            logger.info(f"待处理工作表: {[sc.sheet_name for sc in self.config.sheet_configs]}")
            logger.info("-" * 60)
            
            # 处理每个工作表
            for sheet_config in self.config.sheet_configs:
                logger.info(f"正在处理: {sheet_config.sheet_name}")
                result = self._process_sheet(sheet_config)
                self.process_results.append(result)
                
                if result['success']:
                    logger.info(f"✓ 成功: {sheet_config.sheet_name} -> {sheet_config.output_file}")
                    logger.info(f"  处理行数: {result['processed_rows']}/{result['total_rows']}")
                else:
                    logger.error(f"✗ 失败: {sheet_config.sheet_name}")
                    for error in result['errors']:
                        logger.error(f"  - {error}")
                
                if result['warnings']:
                    for warning in result['warnings']:
                        logger.warning(f"  ⚠️ {warning}")
                
                logger.info("-" * 60)
            
        except Exception as e:
            logger.error(f"数据处理流程失败: {str(e)}")
            raise
        finally:
            # 关闭Excel文件
            if self.reader:
                self.reader.close_workbook()
        
        self._print_summary()
        return self.process_results
    
    def _print_summary(self):
        """打印处理摘要"""
        logger.info("=" * 60)
        logger.info("数据处理摘要")
        logger.info("=" * 60)
        
        total_sheets = len(self.process_results)
        success_sheets = sum(1 for r in self.process_results if r['success'])
        total_rows = sum(r['total_rows'] for r in self.process_results)
        processed_rows = sum(r['processed_rows'] for r in self.process_results)
        total_errors = sum(len(r['errors']) for r in self.process_results)
        total_warnings = sum(len(r['warnings']) for r in self.process_results)
        
        logger.info(f"处理工作表: {success_sheets}/{total_sheets}")
        logger.info(f"处理数据行: {processed_rows}/{total_rows}")
        logger.info(f"错误数量: {total_errors}")
        logger.info(f"警告数量: {total_warnings}")
        
        if total_errors == 0 and success_sheets == total_sheets:
            logger.info("✓ 所有工作表处理完成！")
        else:
            logger.warning("⚠️ 部分工作表处理存在问题，请检查日志")
        
        logger.info("=" * 60)
    
    def generate_report(self, report_path: Optional[str] = None) -> str:
        """
        生成处理报告
        
        :param report_path: 报告输出路径（可选）
        :return: 报告内容
        """
        report_lines = [
            "# 数据处理报告",
            "",
            "## 概述",
            f"- 输入文件: {self.config.input_file}",
            f"- 输出目录: {self.config.output_dir}",
            f"- 处理时间: {self._get_current_time()}",
            "",
            "## 处理结果",
            "| 工作表 | 输出文件 | 原始行数 | 处理行数 | 状态 |",
            "|--------|----------|----------|----------|------|"
        ]
        
        total_rows = 0
        processed_rows = 0
        
        for result in self.process_results:
            status = "✅ 成功" if result['success'] else "❌ 失败"
            report_lines.append(
                f"| {result['sheet_name']} | {result['output_file']} | {result['total_rows']} | {result['processed_rows']} | {status} |"
            )
            total_rows += result['total_rows']
            processed_rows += result['processed_rows']
        
        report_lines.extend([
            "",
            f"**总计**: {processed_rows}/{total_rows} 行",
            "",
            "## 错误详情"
        ])
        
        has_errors = False
        for result in self.process_results:
            if result['errors']:
                has_errors = True
                report_lines.append(f"### {result['sheet_name']}")
                for error in result['errors']:
                    if isinstance(error, dict):
                        report_lines.append(f"- 行 {error['row']}: {', '.join(error['errors'])}")
                    else:
                        report_lines.append(f"- {error}")
        
        if not has_errors:
            report_lines.append("无错误")
        
        report_lines.extend([
            "",
            "## 警告详情"
        ])
        
        has_warnings = False
        for result in self.process_results:
            if result['warnings']:
                has_warnings = True
                report_lines.append(f"### {result['sheet_name']}")
                for warning in result['warnings']:
                    if isinstance(warning, dict):
                        report_lines.append(f"- 行 {warning['row']}: {warning['warning']}")
                    else:
                        report_lines.append(f"- {warning}")
        
        if not has_warnings:
            report_lines.append("无警告")
        
        report_text = "\n".join(report_lines)
        
        if report_path:
            os.makedirs(os.path.dirname(report_path), exist_ok=True)
            with open(report_path, 'w', encoding=self.config.encoding) as f:
                f.write(report_text)
            logger.info(f"报告已保存: {report_path}")
        
        return report_text
    
    def _get_current_time(self) -> str:
        """获取当前时间字符串"""
        from datetime import datetime
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    def __del__(self):
        """析构函数，确保关闭资源"""
        if self.reader:
            self.reader.close_workbook()


def run_processor(input_file: str, output_dir: str, config_path: Optional[str] = None):
    """
    运行数据处理器
    
    :param input_file: Excel输入文件路径
    :param output_dir: JSON输出目录
    :param config_path: 配置文件路径（可选）
    """
    from .config import create_default_config, load_config_from_file
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    try:
        # 加载配置
        if config_path and os.path.exists(config_path):
            logger.info(f"使用配置文件: {config_path}")
            config = load_config_from_file(config_path)
        else:
            logger.info("使用默认配置")
            config = create_default_config(input_file, output_dir)
        
        # 创建并执行处理器
        processor = DataProcessor(config)
        results = processor.process()
        
        # 生成报告
        report_path = os.path.join(output_dir, 'processing_report.md')
        processor.generate_report(report_path)
        
        return results
    
    except Exception as e:
        logger.error(f"数据处理失败: {str(e)}")
        raise


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="数据处理器 - Excel转JSON")
    parser.add_argument("input", help="输入Excel文件路径")
    parser.add_argument("-o", "--output", default="./output", help="输出目录")
    parser.add_argument("-c", "--config", help="配置文件路径")
    
    args = parser.parse_args()
    
    run_processor(args.input, args.output, args.config)