#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据处理主入口脚本
用于处理Excel数据并生成JSON文件
"""

import os
import sys
import shutil
import logging

# 添加当前目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data_processor import run_processor


def sync_to_target(source_dir: str, target_dir: str) -> int:
    """
    将数据同步到目标目录
    
    :param source_dir: 源目录
    :param target_dir: 目标目录
    :return: 同步的文件数量
    """
    if not os.path.exists(source_dir):
        return 0
    
    count = 0
    os.makedirs(target_dir, exist_ok=True)
    
    for item in os.listdir(source_dir):
        src_path = os.path.join(source_dir, item)
        dst_path = os.path.join(target_dir, item)
        
        if os.path.isdir(src_path):
            # 递归同步子目录
            count += sync_to_target(src_path, dst_path)
        elif item.endswith('.json'):
            # 复制JSON文件
            shutil.copy2(src_path, dst_path)
            count += 1
    
    return count


def main():
    """主函数"""
    # 配置日志
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    # 获取项目根目录
    pipeline_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    project_root = os.path.dirname(pipeline_root)
    
    # 输入文件路径（从 data-pipeline/source 读取）
    input_file = os.path.join(pipeline_root, 'source', '开发需求填写.dbt.xlsx')
    
    # 输出目录（输出到 data-pipeline/temp）
    output_dir = os.path.join(pipeline_root, 'temp')
    
    # 目标同步目录
    backend_data_dir = os.path.join(project_root, 'backend', 'data')
    frontend_data_dir = os.path.join(project_root, 'public', 'data')
    
    # 确保输出目录存在
    os.makedirs(output_dir, exist_ok=True)
    
    print("=" * 60)
    print("文言文平台数据处理工具")
    print("=" * 60)
    print(f"输入文件: {input_file}")
    print(f"输出目录: {output_dir}")
    print("-" * 60)
    
    try:
        # 运行处理器
        results = run_processor(input_file, output_dir)
        
        print("\n" + "=" * 60)
        print("处理完成！")
        print("=" * 60)
        
        # 打印结果摘要
        success_count = sum(1 for r in results if r['success'])
        total_count = len(results)
        
        print(f"成功处理: {success_count}/{total_count} 个工作表")
        
        # 检查是否有错误
        has_errors = any(len(r['errors']) > 0 for r in results)
        if has_errors:
            print("\n⚠️ 部分工作表存在错误，请查看日志或报告")
            print(f"报告路径: {os.path.join(output_dir, 'processing_report.md')}")
            return 1
        
        print("\n✓ 所有工作表处理成功！")
        
        # 同步到后端数据目录
        print("\n" + "-" * 60)
        print("同步数据到目标目录...")
        
        backend_count = sync_to_target(output_dir, backend_data_dir)
        print(f"  → 后端数据目录 ({backend_data_dir}): {backend_count} 个文件")
        
        frontend_count = sync_to_target(output_dir, frontend_data_dir)
        print(f"  → 前端数据目录 ({frontend_data_dir}): {frontend_count} 个文件")
        
        print("\n✓ 数据同步完成！")
        print(f"报告路径: {os.path.join(output_dir, 'processing_report.md')}")
        
        return 0
    
    except Exception as e:
        logging.error(f"数据处理失败: {str(e)}")
        print(f"\n❌ 处理失败: {str(e)}")
        return 1


if __name__ == "__main__":
    sys.exit(main())