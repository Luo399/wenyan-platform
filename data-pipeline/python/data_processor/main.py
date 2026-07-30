#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据处理协调器 - data_processor 包的新角色

职责分层（与 generate_all_json.py 分工）：
  - 转换层：generate_all_json.py（utils + transformers）— 唯一事实源
  - 增量层：IncrementalProcessor — 检测 public/data/ 下各子目录的文件级 diff
  - 版本层：VersionManager — 为 public/data/ 创建目录快照，支持回滚

子命令：
  - run    ：全量转换 → 增量检测 → 版本快照（端到端一键流程）
  - status ：查看增量状态与历史版本
  - version：版本管理（list/restore）

设计说明：
  - data_processor 不再重复实现 Excel→JSON 转换，processor.py 保留为备用路径
  - 增量检测粒度：以 public/data/<subdir>/ 下的每个 <text_id>.json 文件为单元
  - 版本快照粒度：整个 public/data/ 目录
"""

import argparse
import hashlib
import json
import logging
import os
import shutil
import sys
from typing import Dict, List, Tuple

# 添加 data-pipeline/python/ 到 sys.path，使 generate_all_json 可被导入
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_PYTHON_DIR = os.path.dirname(_SCRIPT_DIR)  # data-pipeline/python/
if _PYTHON_DIR not in sys.path:
    sys.path.append(_PYTHON_DIR)

from data_processor import (
    IncrementalProcessor,
    VersionManager,
)


# ---------------------------------------------------------------------------
# 路径解析
# ---------------------------------------------------------------------------

def _resolve_paths() -> Dict[str, str]:
    """
    解析管线各关键路径，全部基于 _SCRIPT_DIR 计算，不依赖 cwd

    :return: 路径字典
    """
    pipeline_root = os.path.dirname(_PYTHON_DIR)  # data-pipeline/
    repo_root = os.path.dirname(pipeline_root)     # 仓库根

    return {
        # 输入
        'excel_file': os.path.join(pipeline_root, 'source', '开发需求填写.dbt.xlsx'),
        # 转换层输出（前端消费）
        'public_data_dir': os.path.join(repo_root, 'public', 'data'),
        # 后端数据目录（与 public/data 同步，但保留后端专属文件）
        'backend_data_dir': os.path.join(repo_root, 'backend', 'data'),
        # 增量状态与版本快照存放地（不入 git）
        'temp_dir': os.path.join(pipeline_root, 'temp'),
        'state_file': os.path.join(pipeline_root, 'temp', '.pipeline_state.json'),
        'version_dir': os.path.join(pipeline_root, 'temp', '.pipeline_versions'),
    }


# ---------------------------------------------------------------------------
# 增量检测辅助
# ---------------------------------------------------------------------------

def _hash_file(file_path: str) -> str:
    """
    计算单个 JSON 文件的内容哈希

    :param file_path: 文件绝对路径
    :return: sha1 十六进制摘要
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        content = json.load(f)
    payload = json.dumps(content, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha1(payload.encode('utf-8')).hexdigest()


def _collect_subdir_hashes(public_data_dir: str) -> Dict[str, Dict[str, str]]:
    """
    遍历 public/data/ 下各子目录，收集每个子目录内 <text_id>.json 的文件哈希

    :return: {subdir_name: {text_id: file_hash}}
    """
    result: Dict[str, Dict[str, str]] = {}
    if not os.path.isdir(public_data_dir):
        return result

    for subdir_name in sorted(os.listdir(public_data_dir)):
        subdir_path = os.path.join(public_data_dir, subdir_name)
        if not os.path.isdir(subdir_path):
            continue
        hashes: Dict[str, str] = {}
        for file_name in sorted(os.listdir(subdir_path)):
            if not file_name.endswith('.json'):
                continue
            text_id = os.path.splitext(file_name)[0]
            try:
                hashes[text_id] = _hash_file(os.path.join(subdir_path, file_name))
            except (json.JSONDecodeError, IOError) as e:
                logging.warning(f"跳过无法解析的文件 {file_name}: {e}")
        result[subdir_name] = hashes
    return result


def _run_incremental(
    state_file: str,
    subdir_hashes: Dict[str, Dict[str, str]],
) -> List[Tuple[str, List[str], List[str], List[str]]]:
    """
    执行增量检测，提交哈希并持久化

    :param state_file: 增量状态文件路径
    :param subdir_hashes: _collect_subdir_hashes 的返回值
    :return: [(subdir_name, added, changed, removed), ...] 差异摘要
    """
    proc = IncrementalProcessor(state_file)
    diffs: List[Tuple[str, List[str], List[str], List[str]]] = []

    for subdir_name, current_hashes in subdir_hashes.items():
        added, changed, removed = proc.collect_changes(subdir_name, current_hashes)
        diffs.append((subdir_name, added, changed, removed))
        proc.commit(subdir_name, current_hashes)

    proc.flush()
    return diffs


def _create_version(version_dir: str, public_data_dir: str, note: str = '') -> Dict:
    """
    为 public/data/ 创建版本快照

    :param version_dir: 版本存放目录
    :param public_data_dir: 待快照的源目录
    :param note: 备注
    :return: 版本元数据
    """
    manager = VersionManager(version_dir)
    return manager.create_version(public_data_dir, label=None, note=note)


def _sync_public_to_backend(public_data_dir: str, backend_data_dir: str) -> int:
    """
    将 public/data/ 下各子目录的 JSON 同步到 backend/data/，
    覆盖同名文件，不删除 backend/data/ 中 public 没有的文件
    （保留 answer_records.json、students.json 等后端专属文件）

    :return: 同步的文件数
    """
    if not os.path.isdir(public_data_dir):
        return 0
    os.makedirs(backend_data_dir, exist_ok=True)

    synced = 0
    for subdir_name in os.listdir(public_data_dir):
        src_subdir = os.path.join(public_data_dir, subdir_name)
        if not os.path.isdir(src_subdir):
            continue
        dst_subdir = os.path.join(backend_data_dir, subdir_name)
        os.makedirs(dst_subdir, exist_ok=True)
        for file_name in os.listdir(src_subdir):
            if not file_name.endswith('.json'):
                continue
            shutil.copy2(
                os.path.join(src_subdir, file_name),
                os.path.join(dst_subdir, file_name)
            )
            synced += 1
    return synced


# ---------------------------------------------------------------------------
# 子命令实现
# ---------------------------------------------------------------------------

def _cmd_run(args) -> int:
    """
    run 子命令：转换 → 增量检测 → 同步 → 版本快照

    流程：
      1. 解析数据源（excel 或 tencent）
      2. 调用 generate_all_json.main() 完成 Excel → JSON 转换
      3. 扫描 public/data/ 各子目录，计算文件哈希
      4. 与历史状态对比，输出 diff 摘要
      5. 同步 public/data/ → backend/data/
      6. 为 public/data/ 创建版本快照（仅有变更时）
    """
    paths = _resolve_paths()
    public_data_dir = args.output or paths['public_data_dir']

    # 数据源解析：--source tencent 时从腾讯文档导出目录读取最新 Excel
    excel_file = args.input
    if not excel_file:
        if args.source == 'tencent':
            from utils import find_latest_export, resolve_export_dir
            export_dir = resolve_export_dir(args.tencent_dir)
            excel_file = find_latest_export(export_dir)
            if not excel_file:
                logging.error(
                    f"未在腾讯文档导出目录找到 .xlsx 文件: {export_dir}\n"
                    f"请先在 Trae IDE 中通过腾讯文档 MCP 读取在线表格并导出到该目录，"
                    f"或通过 --tencent-dir 指定其他目录"
                )
                return 1
            logging.info(f"数据源：腾讯文档导出 → {excel_file}")
        else:
            excel_file = paths['excel_file']
            logging.info(f"数据源：本地 Excel → {excel_file}")

    os.makedirs(paths['temp_dir'], exist_ok=True)
    os.makedirs(public_data_dir, exist_ok=True)

    # 1. 转换层
    logging.info("=" * 60)
    logging.info("[1/4] 转换层：Excel → JSON（generate_all_json）")
    logging.info("=" * 60)
    try:
        # 延迟导入，避免 generate_all_json 的 logging.basicConfig 副作用在模块加载时触发
        import generate_all_json
        generate_all_json.main(excel_file=excel_file, public_data_dir=public_data_dir)
    except Exception as e:
        logging.error(f"转换层失败: {e}", exc_info=True)
        return 1

    # 2. 增量层
    logging.info("=" * 60)
    logging.info("[2/3] 增量层：检测 public/data/ 文件级 diff")
    logging.info("=" * 60)
    subdir_hashes = _collect_subdir_hashes(public_data_dir)
    diffs = _run_incremental(paths['state_file'], subdir_hashes)

    has_any_change = False
    for subdir_name, added, changed, removed in diffs:
        if added or changed or removed:
            has_any_change = True
        logging.info(
            f"  - {subdir_name}: +{len(added)} ~{len(changed)} -{len(removed)}"
        )

    # 3. 同步到 backend/data/（后端读取源，无论是否有变更都执行）
    logging.info("=" * 60)
    logging.info("[3/4] 同步层：public/data/ → backend/data/")
    logging.info("=" * 60)
    synced = _sync_public_to_backend(public_data_dir, paths['backend_data_dir'])
    logging.info(f"已同步 {synced} 个 JSON 文件到 backend/data/")

    # 4. 版本层（仅在检测到变更时创建快照）
    if not has_any_change:
        logging.info("=" * 60)
        logging.info("[4/4] 版本层：无变更，跳过快照创建")
        logging.info("=" * 60)
    else:
        logging.info("=" * 60)
        logging.info("[4/4] 版本层：创建 public/data/ 快照")
        logging.info("=" * 60)
        meta = _create_version(
            paths['version_dir'],
            public_data_dir,
            note=f"auto snapshot from run, {sum(len(a+c+r) for _, a, c, r in diffs)} changes"
        )
        logging.info(f"已创建版本 {meta['version_id']}（{meta['file_count']} 个文件）")

    logging.info("=" * 60)
    logging.info("全流程完成。后续步骤：")
    logging.info("  - 本地上传 OSS：node scripts/upload-to-oss.js")
    logging.info("  - 或 commit + push 触发 CI 自动部署")
    logging.info("=" * 60)
    return 0


def _cmd_status(_args) -> int:
    """查看当前处理状态与历史版本"""
    paths = _resolve_paths()
    proc = IncrementalProcessor(paths['state_file'])
    versions = VersionManager(paths['version_dir'])

    print(f"public/data 目录: {paths['public_data_dir']}")
    print(f"状态文件: {paths['state_file']}")
    print(f"版本目录: {paths['version_dir']}")
    print()

    records = proc.state.state.get('records', {})
    if not records:
        print("增量状态: 空（尚未运行过 run 子命令）")
    else:
        print("增量状态:")
        for file_name, hashes in records.items():
            print(f"  - {file_name}: {len(hashes)} 条记录")
    print()

    listed = versions.list_versions()
    print(f"历史版本数: {len(listed)}")
    for v in listed[:5]:
        print(f"  - {v['version_id']} ({v['label']}) {v['file_count']} files")
    return 0


def _cmd_version(args) -> int:
    """版本管理子命令"""
    paths = _resolve_paths()
    manager = VersionManager(paths['version_dir'])

    if args.action == 'list':
        for v in manager.list_versions():
            print(f"{v['version_id']}\t{v['label']}\t{v['file_count']} files\t{v['created_at']}")
    elif args.action == 'restore':
        if not args.version_id:
            print("错误: restore 需要指定 --version-id")
            return 1
        manager.restore_version(args.version_id, paths['public_data_dir'], overwrite=True)
        print(f"已恢复版本 {args.version_id} 到 {paths['public_data_dir']}")
    else:
        print(f"未知子命令: {args.action}")
        return 1
    return 0


# ---------------------------------------------------------------------------
# CLI 入口
# ---------------------------------------------------------------------------

def main():
    """主函数"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[logging.StreamHandler(sys.stdout)]
    )

    parser = argparse.ArgumentParser(
        description="文言文平台数据处理协调器（转换 + 增量 + 版本）"
    )
    sub = parser.add_subparsers(dest='command')

    run_p = sub.add_parser('run', help='全量转换 → 增量检测 → 同步 → 版本快照')
    run_p.add_argument('-i', '--input', help='输入 Excel 路径（覆盖 --source 默认路径）')
    run_p.add_argument('-o', '--output', help='输出 JSON 根目录（默认 public/data/）')
    run_p.add_argument('--source', choices=['excel', 'tencent'], default='excel',
                       help='数据源：excel（默认）或 tencent（从腾讯文档导出目录读取）')
    run_p.add_argument('--tencent-dir', default=None,
                       help='腾讯文档导出目录（默认 data-pipeline/source/tencent_exports/ 或环境变量 TENCENT_DOC_EXPORT_DIR）')

    sub.add_parser('status', help='查看增量状态与历史版本')

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
