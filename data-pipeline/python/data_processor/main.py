#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据处理主入口脚本
用于处理Excel数据并生成JSON文件

支持子命令：
  - run    ：全量处理 Excel -> JSON
  - status ：查看当前处理状态与增量信息
  - version：管理历史版本（list/restore）
"""

import argparse
import os
import sys
import logging

# 添加当前目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data_processor import (
    run_processor,
    IncrementalProcessor,
    VersionManager,
)


def _resolve_paths(pipeline_root: str) -> tuple:
    """解析默认输入/输出路径"""
    input_file = os.path.join(pipeline_root, 'source', '开发需求填写.dbt.xlsx')
    output_dir = os.path.join(pipeline_root, 'temp')
    return input_file, output_dir


def _cmd_run(args) -> int:
    """全量运行子命令"""
    pipeline_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    input_file, output_dir = _resolve_paths(pipeline_root)
    if args.input:
        input_file = args.input
    if args.output:
        output_dir = args.output
    os.makedirs(output_dir, exist_ok=True)
    run_processor(input_file, output_dir)
    return 0


def _cmd_status(_args) -> int:
    """查看当前处理状态"""
    pipeline_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    _, output_dir = _resolve_paths(pipeline_root)
    proc = IncrementalProcessor(os.path.join(output_dir, '.pipeline_state.json'))
    versions = VersionManager(os.path.join(output_dir, '.pipeline_versions'))
    print("输出目录:", output_dir)
    for file_name, hashes in proc.state.state.get('records', {}).items():
        print(f"  - {file_name}: {len(hashes)} 条记录")
    listed = versions.list_versions()
    print(f"历史版本数: {len(listed)}")
    for v in listed[:5]:
        print(f"  - {v['version_id']} ({v['label']}) {v['file_count']} files")
    return 0


def _cmd_version(args) -> int:
    """版本管理子命令"""
    pipeline_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    _, output_dir = _resolve_paths(pipeline_root)
    manager = VersionManager(os.path.join(output_dir, '.pipeline_versions'))

    if args.action == 'list':
        for v in manager.list_versions():
            print(f"{v['version_id']}\t{v['label']}\t{v['file_count']} files\t{v['created_at']}")
    elif args.action == 'restore':
        if not args.version_id:
            print("错误: restore 需要指定 --version-id")
            return 1
        manager.restore_version(args.version_id, output_dir, overwrite=True)
    else:
        print(f"未知子命令: {args.action}")
        return 1
    return 0


def main():
    """主函数"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[logging.StreamHandler(sys.stdout)]
    )

    parser = argparse.ArgumentParser(description="文言文平台数据处理工具")
    sub = parser.add_subparsers(dest='command')

    run_p = sub.add_parser('run', help='全量处理 Excel -> JSON')
    run_p.add_argument('-i', '--input', help='输入 Excel 路径')
    run_p.add_argument('-o', '--output', help='输出 JSON 目录')

    sub.add_parser('status', help='查看处理状态与历史版本')

    ver_p = sub.add_parser('version', help='版本管理')
    ver_p.add_argument('action', choices=['list', 'restore'])
    ver_p.add_argument('--version-id', help='目标版本 ID（restore 时必填）')

    args = parser.parse_args()
    if args.command == 'run':
        return _cmd_run(args)
    if args.command == 'status':
        return _cmd_status(args)
    if args.command == 'version':
        return _cmd_version(args)

    parser.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())