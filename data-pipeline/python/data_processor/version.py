#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
版本管理模块
提供数据处理结果的快照、版本列表、回滚、对比与自动清理能力
"""

import json
import os
import shutil
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

# 默认配置
DEFAULT_VERSION_DIR = '.pipeline_versions'
DEFAULT_KEEP_VERSIONS = 10
META_FILE_NAME = 'meta.json'
MANIFEST_FILE_NAME = 'manifest.json'


def _now_iso() -> str:
    """当前时间的 ISO 字符串"""
    return datetime.now().isoformat()


def _safe_link(src: str, dst: str) -> None:
    """跨平台复制（Windows 不一定支持硬链接，使用 copy2）"""
    shutil.copy2(src, dst)


class VersionManager:
    """
    版本管理器
    通过目录快照 + 元数据文件实现简易版本控制
    """

    def __init__(
        self,
        version_dir: str = DEFAULT_VERSION_DIR,
        keep_versions: int = DEFAULT_KEEP_VERSIONS,
    ):
        if keep_versions < 1:
            raise ValueError("keep_versions 必须 >= 1")
        self.version_dir = version_dir
        self.keep_versions = keep_versions
        os.makedirs(self.version_dir, exist_ok=True)

    # ------------------------------------------------------------------
    # 列表与查询
    # ------------------------------------------------------------------
    def list_versions(self) -> List[Dict[str, Any]]:
        """
        列出所有版本（按时间倒序）

        :return: 版本元数据列表
        """
        versions: List[Dict[str, Any]] = []
        if not os.path.isdir(self.version_dir):
            return versions

        for entry in os.listdir(self.version_dir):
            meta_path = os.path.join(self.version_dir, entry, META_FILE_NAME)
            if os.path.isfile(meta_path):
                try:
                    with open(meta_path, 'r', encoding='utf-8') as f:
                        meta = json.load(f)
                    versions.append(meta)
                except (json.JSONDecodeError, IOError) as e:
                    logger.warning(f"版本元数据读取失败 {meta_path}: {str(e)}")

        versions.sort(key=lambda v: v.get('created_at', ''), reverse=True)
        return versions

    def get_version(self, version_id: str) -> Optional[Dict[str, Any]]:
        """按 ID 查找版本元数据"""
        for version in self.list_versions():
            if version.get('version_id') == version_id:
                return version
        return None

    def get_latest_version(self) -> Optional[Dict[str, Any]]:
        """获取最新版本元数据"""
        versions = self.list_versions()
        return versions[0] if versions else None

    # ------------------------------------------------------------------
    # 创建与清理
    # ------------------------------------------------------------------
    def create_version(
        self,
        source_dir: str,
        label: Optional[str] = None,
        note: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        为 source_dir 创建快照版本

        :param source_dir: 待快照的目录
        :param label: 版本显示名称（可选）
        :param note: 备注
        :return: 版本元数据
        """
        if not os.path.isdir(source_dir):
            raise FileNotFoundError(f"源目录不存在: {source_dir}")

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
        version_id = f"v_{timestamp}"
        snapshot_dir = os.path.join(self.version_dir, version_id)
        os.makedirs(snapshot_dir, exist_ok=True)

        manifest = self._build_manifest(source_dir)
        manifest_path = os.path.join(snapshot_dir, MANIFEST_FILE_NAME)
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)

        for entry in manifest['files']:
            src = os.path.join(source_dir, entry['name'])
            dst = os.path.join(snapshot_dir, entry['name'])
            if os.path.isfile(src):
                _safe_link(src, dst)

        meta: Dict[str, Any] = {
            'version_id': version_id,
            'label': label or version_id,
            'note': note or '',
            'created_at': _now_iso(),
            'source_dir': os.path.abspath(source_dir),
            'file_count': manifest['file_count'],
            'total_size': manifest['total_size'],
            'manifest_file': MANIFEST_FILE_NAME,
        }
        meta_path = os.path.join(snapshot_dir, META_FILE_NAME)
        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)

        logger.info(
            f"已创建版本 {version_id}（{meta['file_count']} 个文件，"
            f"{meta['total_size']} 字节）"
        )
        self._cleanup_old_versions()
        return meta

    def _cleanup_old_versions(self) -> int:
        """
        清理超出保留数量的旧版本

        :return: 清理的版本数
        """
        versions = self.list_versions()
        if len(versions) <= self.keep_versions:
            return 0

        to_remove = versions[self.keep_versions:]
        removed = 0
        for version in to_remove:
            target = os.path.join(self.version_dir, version['version_id'])
            if os.path.isdir(target):
                shutil.rmtree(target, ignore_errors=True)
                removed += 1
                logger.info(f"已清理旧版本: {version['version_id']}")
        return removed

    def delete_version(self, version_id: str) -> bool:
        """删除指定版本"""
        target = os.path.join(self.version_dir, version_id)
        if not os.path.isdir(target):
            return False
        shutil.rmtree(target, ignore_errors=True)
        logger.info(f"已删除版本: {version_id}")
        return True

    # ------------------------------------------------------------------
    # 回滚
    # ------------------------------------------------------------------
    def restore_version(
        self,
        version_id: str,
        target_dir: str,
        overwrite: bool = False,
    ) -> int:
        """
        从快照恢复到目标目录

        :param version_id: 版本 ID
        :param target_dir: 恢复到的目录
        :param overwrite: 是否覆盖已存在文件
        :return: 恢复的文件数
        """
        snapshot_dir = os.path.join(self.version_dir, version_id)
        if not os.path.isdir(snapshot_dir):
            raise FileNotFoundError(f"版本不存在: {version_id}")

        os.makedirs(target_dir, exist_ok=True)
        restored = 0
        for name in os.listdir(snapshot_dir):
            if name in (META_FILE_NAME, MANIFEST_FILE_NAME):
                continue
            src = os.path.join(snapshot_dir, name)
            dst = os.path.join(target_dir, name)
            if not os.path.isfile(src):
                continue
            if os.path.exists(dst) and not overwrite:
                logger.warning(f"跳过已存在文件: {name}")
                continue
            shutil.copy2(src, dst)
            restored += 1
        logger.info(f"已从版本 {version_id} 恢复 {restored} 个文件到 {target_dir}")
        return restored

    # ------------------------------------------------------------------
    # 对比
    # ------------------------------------------------------------------
    def diff_versions(
        self,
        version_id_a: str,
        version_id_b: str,
    ) -> Dict[str, List[str]]:
        """
        对比两个版本的文件差异

        :param version_id_a: 版本 A
        :param version_id_b: 版本 B
        :return: {'added': [..], 'removed': [..], 'common': [..]}
        """
        files_a = self._list_snapshot_files(version_id_a)
        files_b = self._list_snapshot_files(version_id_b)
        return {
            'added': sorted(list(files_b - files_a)),
            'removed': sorted(list(files_a - files_b)),
            'common': sorted(list(files_a & files_b)),
        }

    def _list_snapshot_files(self, version_id: str) -> set:
        """列出快照中实际存在的文件名集合"""
        snapshot_dir = os.path.join(self.version_dir, version_id)
        if not os.path.isdir(snapshot_dir):
            return set()
        return {
            name for name in os.listdir(snapshot_dir)
            if name not in (META_FILE_NAME, MANIFEST_FILE_NAME)
            and os.path.isfile(os.path.join(snapshot_dir, name))
        }

    # ------------------------------------------------------------------
    # 内部工具
    # ------------------------------------------------------------------
    @staticmethod
    def _build_manifest(source_dir: str) -> Dict[str, Any]:
        """生成文件清单与统计信息"""
        files: List[Dict[str, Any]] = []
        total_size = 0
        for name in sorted(os.listdir(source_dir)):
            full = os.path.join(source_dir, name)
            if not os.path.isfile(full):
                continue
            size = os.path.getsize(full)
            total_size += size
            files.append({'name': name, 'size': size})
        return {
            'file_count': len(files),
            'total_size': total_size,
            'files': files,
        }


__all__ = [
    'VersionManager',
    'DEFAULT_VERSION_DIR',
    'DEFAULT_KEEP_VERSIONS',
    'META_FILE_NAME',
    'MANIFEST_FILE_NAME',
]
