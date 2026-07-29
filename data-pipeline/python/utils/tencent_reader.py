#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
腾讯文档数据源读取器（可选源）

接入方式：
  本模块不直接调用腾讯文档 OpenAPI（避免 OAuth 复杂性与运行时网络依赖），
  而是采用"本地导出文件"模式：
    1. 用户在 Trae IDE 中通过腾讯文档 MCP 读取在线表格
    2. 将数据导出/另存为 Excel 到本地目录（默认 data-pipeline/source/tencent_exports/）
    3. 本模块扫描该目录，找到最新的 .xlsx 文件作为管线输入

未来扩展：
  若需自动拉取，可在本模块新增 download_via_openapi(doc_id, token) 函数，
  通过 https://docs.qq.com/openapi/ 的导出接口实现，配置项通过环境变量注入。

环境变量：
  TENCENT_DOC_EXPORT_DIR  腾讯文档导出目录（默认 data-pipeline/source/tencent_exports/）
"""

import os
from typing import Optional


DEFAULT_EXPORT_DIR_NAME = 'tencent_exports'


def get_default_export_dir() -> str:
    """
    获取默认导出目录：data-pipeline/source/tencent_exports/

    :return: 导出目录绝对路径
    """
    # 本文件：data-pipeline/python/utils/tencent_reader.py
    # 上溯：utils -> python -> data-pipeline
    pipeline_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(pipeline_root, 'source', DEFAULT_EXPORT_DIR_NAME)


def resolve_export_dir(export_dir: Optional[str] = None) -> str:
    """
    解析导出目录，优先级：参数 > 环境变量 > 默认值

    :param export_dir: 显式指定的目录
    :return: 导出目录绝对路径
    """
    if export_dir:
        return os.path.abspath(export_dir)
    env_val = os.environ.get('TENCENT_DOC_EXPORT_DIR', '').strip()
    if env_val:
        return os.path.abspath(env_val)
    return get_default_export_dir()


def find_latest_export(export_dir: Optional[str] = None) -> Optional[str]:
    """
    在导出目录中查找最新的 .xlsx 文件（按修改时间排序）

    :param export_dir: 导出目录，默认从环境变量或默认路径解析
    :return: 最新 .xlsx 文件的绝对路径；目录不存在或无文件时返回 None
    """
    directory = resolve_export_dir(export_dir)
    if not os.path.isdir(directory):
        return None

    xlsx_files = [
        os.path.join(directory, f)
        for f in os.listdir(directory)
        if f.lower().endswith('.xlsx') and not f.startswith('~$')  # 排除 Excel 临时锁文件
    ]
    if not xlsx_files:
        return None

    # 按修改时间倒序，取最新
    xlsx_files.sort(key=lambda p: os.path.getmtime(p), reverse=True)
    return xlsx_files[0]


def list_exports(export_dir: Optional[str] = None) -> list:
    """
    列出导出目录中所有 .xlsx 文件（按修改时间倒序）

    :param export_dir: 导出目录
    :return: 文件绝对路径列表
    """
    directory = resolve_export_dir(export_dir)
    if not os.path.isdir(directory):
        return []

    files = [
        os.path.join(directory, f)
        for f in os.listdir(directory)
        if f.lower().endswith('.xlsx') and not f.startswith('~$')
    ]
    files.sort(key=lambda p: os.path.getmtime(p), reverse=True)
    return files
