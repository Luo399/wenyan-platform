#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
增量更新模块
实现基于内容哈希的增量检测，避免每次全量重跑
"""

import json
import hashlib
import logging
import os
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple

logger = logging.getLogger(__name__)

# 状态文件默认名称
DEFAULT_STATE_FILE = '.pipeline_state.json'
# 状态文件字段
STATE_VERSION = '1.0'
STATE_KEY_VERSION = 'version'
STATE_KEY_UPDATED_AT = 'updated_at'
STATE_KEY_FILES = 'files'
STATE_KEY_RECORDS = 'records'


def compute_record_hash(record: Dict[str, Any]) -> str:
    """
    计算单条记录的内容哈希
    使用排序后的 JSON 序列化保证顺序无关

    :param record: 数据记录
    :return: 哈希值
    """
    payload = json.dumps(record, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha1(payload.encode('utf-8')).hexdigest()


def compute_records_hashes(records: List[Dict[str, Any]]) -> Dict[str, str]:
    """
    批量计算记录哈希，返回 key -> hash 字典
    默认使用 'text_id' 字段作为键，可通过 key_field 参数调整

    :param records: 记录列表
    :return: 键到哈希的映射
    """
    result = {}
    for record in records:
        key = str(record.get('text_id', ''))
        if not key:
            continue
        result[key] = compute_record_hash(record)
    return result


def diff_records(
    current_hashes: Dict[str, str],
    previous_hashes: Dict[str, str]
) -> Tuple[List[str], List[str], List[str]]:
    """
    对比当前与历史的哈希差异

    :param current_hashes: 当前批次哈希
    :param previous_hashes: 上一批次哈希
    :return: (新增/变更/删除) 的 text_id 列表
    """
    current_keys = set(current_hashes.keys())
    previous_keys = set(previous_hashes.keys())

    added = sorted(list(current_keys - previous_keys))
    removed = sorted(list(previous_keys - current_keys))
    changed = sorted([
        key for key in (current_keys & previous_keys)
        if current_hashes[key] != previous_hashes[key]
    ])

    return added, changed, removed


class PipelineState:
    """
    数据管道状态管理
    记录每个输出文件的最后处理时间与内容哈希
    """

    def __init__(self, state_file_path: str = DEFAULT_STATE_FILE):
        self.state_file_path = state_file_path
        self.state: Dict[str, Any] = {
            STATE_KEY_VERSION: STATE_VERSION,
            STATE_KEY_UPDATED_AT: '',
            STATE_KEY_FILES: {},
            STATE_KEY_RECORDS: {},
        }

    def load(self) -> bool:
        """
        从磁盘加载状态

        :return: 是否成功加载（文件不存在视为空状态）
        """
        if not os.path.exists(self.state_file_path):
            logger.info("状态文件不存在，使用空状态")
            return False

        try:
            with open(self.state_file_path, 'r', encoding='utf-8') as f:
                self.state = json.load(f)
            logger.info(f"已加载状态: {self.state_file_path}")
            return True
        except (json.JSONDecodeError, IOError) as e:
            logger.warning(f"状态文件加载失败，使用空状态: {str(e)}")
            self.state = self._empty_state()
            return False

    def save(self) -> None:
        """将当前状态写入磁盘"""
        self.state[STATE_KEY_UPDATED_AT] = datetime.now().isoformat()
        os.makedirs(os.path.dirname(self.state_file_path) or '.', exist_ok=True)
        with open(self.state_file_path, 'w', encoding='utf-8') as f:
            json.dump(self.state, f, ensure_ascii=False, indent=2)
        logger.info(f"状态已保存: {self.state_file_path}")

    def get_file_hash(self, file_name: str) -> Optional[str]:
        """获取上一版本文件指纹"""
        return self.state[STATE_KEY_FILES].get(file_name)

    def set_file_hash(self, file_name: str, file_hash: str) -> None:
        """更新文件指纹"""
        self.state[STATE_KEY_FILES][file_name] = file_hash

    def get_record_hashes(self, file_name: str) -> Dict[str, str]:
        """获取历史记录哈希"""
        return self.state[STATE_KEY_RECORDS].get(file_name, {})

    def set_record_hashes(self, file_name: str, hashes: Dict[str, str]) -> None:
        """覆盖写入记录哈希"""
        self.state[STATE_KEY_RECORDS][file_name] = hashes

    @staticmethod
    def _empty_state() -> Dict[str, Any]:
        return {
            STATE_KEY_VERSION: STATE_VERSION,
            STATE_KEY_UPDATED_AT: '',
            STATE_KEY_FILES: {},
            STATE_KEY_RECORDS: {},
        }


class IncrementalProcessor:
    """
    增量处理器
    在 DataProcessor 之上包装一层，支持只处理变更的数据
    """

    def __init__(self, state_file_path: str = DEFAULT_STATE_FILE):
        self.state = PipelineState(state_file_path)
        self.state.load()

    def has_changes(
        self,
        file_name: str,
        current_hashes: Dict[str, str],
    ) -> bool:
        """
        判断当前批次相对历史是否有变化

        :param file_name: 输出文件名
        :param current_hashes: 当前批次哈希
        :return: 是否有变化
        """
        previous = self.state.get_record_hashes(file_name)
        if not previous and current_hashes:
            return True
        if set(previous.keys()) != set(current_hashes.keys()):
            return True
        return any(previous[k] != current_hashes[k] for k in previous)

    def collect_changes(
        self,
        file_name: str,
        current_hashes: Dict[str, str],
    ) -> Tuple[List[str], List[str], List[str]]:
        """
        收集新增/变更/删除记录

        :param file_name: 输出文件名
        :param current_hashes: 当前批次哈希
        :return: (added, changed, removed) 三个 text_id 列表
        """
        previous = self.state.get_record_hashes(file_name)
        return diff_records(current_hashes, previous)

    def commit(self, file_name: str, current_hashes: Dict[str, str]) -> None:
        """
        提交本批次哈希到状态

        :param file_name: 输出文件名
        :param current_hashes: 当前批次哈希
        """
        self.state.set_record_hashes(file_name, current_hashes)
        fingerprint = hashlib.sha1(
            json.dumps(current_hashes, sort_keys=True).encode('utf-8')
        ).hexdigest()
        self.state.set_file_hash(file_name, fingerprint)

    def flush(self) -> None:
        """将状态持久化到磁盘"""
        self.state.save()

    def merge_records(
        self,
        file_path: str,
        new_records: List[Dict[str, Any]],
        removed_keys: List[str],
    ) -> List[Dict[str, Any]]:
        """
        合并新旧数据：保留未变更的旧记录，替换变更/新增，删除移除项

        :param file_path: 输出 JSON 文件路径
        :param new_records: 新批次记录
        :param removed_keys: 需要删除的 text_id 列表
        :return: 合并后的最终记录列表
        """
        existing: List[Dict[str, Any]] = []
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    existing = json.load(f)
                if not isinstance(existing, list):
                    existing = []
            except (json.JSONDecodeError, IOError):
                existing = []

        removed_set = set(removed_keys)
        kept = [r for r in existing if str(r.get('text_id', '')) not in removed_set]
        kept_map = {str(r.get('text_id', '')): r for r in kept}
        for record in new_records:
            key = str(record.get('text_id', ''))
            kept_map[key] = record
        return list(kept_map.values())


__all__ = [
    'compute_record_hash',
    'compute_records_hashes',
    'diff_records',
    'PipelineState',
    'IncrementalProcessor',
    'DEFAULT_STATE_FILE',
    'STATE_VERSION',
]
