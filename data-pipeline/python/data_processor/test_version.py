#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
版本管理模块测试
覆盖创建/列表/恢复/对比/清理等核心能力
"""

import json
import os
import shutil
import tempfile
import time
import unittest

from .version import (
    VersionManager,
    DEFAULT_VERSION_DIR,
    META_FILE_NAME,
    MANIFEST_FILE_NAME,
)


class _TmpDirMixin:
    def setUp(self):
        self.tmp_root = tempfile.mkdtemp()
        self.source_dir = os.path.join(self.tmp_root, 'src')
        self.version_dir = os.path.join(self.tmp_root, 'versions')
        os.makedirs(self.source_dir, exist_ok=True)

    def tearDown(self):
        shutil.rmtree(self.tmp_root, ignore_errors=True)

    def _write(self, name: str, content: str) -> str:
        path = os.path.join(self.source_dir, name)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        return path


class TestVersionManagerCreate(_TmpDirMixin, unittest.TestCase):
    """创建版本测试"""

    def test_create_version_writes_meta_and_manifest(self):
        self._write('a.json', '[1,2,3]')
        self._write('b.json', '{"k":"v"}')
        manager = VersionManager(self.version_dir, keep_versions=5)
        meta = manager.create_version(self.source_dir, label='init', note='first')

        self.assertTrue(meta['version_id'].startswith('v_'))
        self.assertEqual(meta['label'], 'init')
        self.assertEqual(meta['note'], 'first')
        self.assertEqual(meta['file_count'], 2)

        snapshot = os.path.join(self.version_dir, meta['version_id'])
        self.assertTrue(os.path.isfile(os.path.join(snapshot, META_FILE_NAME)))
        self.assertTrue(os.path.isfile(os.path.join(snapshot, MANIFEST_FILE_NAME)))
        self.assertTrue(os.path.isfile(os.path.join(snapshot, 'a.json')))

    def test_create_version_raises_for_missing_source(self):
        manager = VersionManager(self.version_dir)
        with self.assertRaises(FileNotFoundError):
            manager.create_version(os.path.join(self.tmp_root, 'missing'))

    def test_create_version_label_defaults_to_id(self):
        self._write('only.json', '{}')
        manager = VersionManager(self.version_dir)
        meta = manager.create_version(self.source_dir)
        self.assertEqual(meta['label'], meta['version_id'])


class TestVersionManagerList(_TmpDirMixin, unittest.TestCase):
    """版本列表与查询测试"""

    def test_list_versions_returns_empty_initially(self):
        manager = VersionManager(self.version_dir)
        self.assertEqual(manager.list_versions(), [])

    def test_list_versions_sorted_descending(self):
        self._write('f.json', '{}')
        manager = VersionManager(self.version_dir)
        ids = []
        for _ in range(3):
            meta = manager.create_version(self.source_dir)
            ids.append(meta['version_id'])
            time.sleep(0.01)
        listed = manager.list_versions()
        self.assertEqual([v['version_id'] for v in listed], list(reversed(ids)))

    def test_get_latest_version(self):
        self._write('f.json', '{}')
        manager = VersionManager(self.version_dir)
        first = manager.create_version(self.source_dir)
        time.sleep(0.01)
        second = manager.create_version(self.source_dir)
        latest = manager.get_latest_version()
        self.assertIsNotNone(latest)
        self.assertEqual(latest['version_id'], second['version_id'])
        self.assertNotEqual(latest['version_id'], first['version_id'])

    def test_get_version_by_id(self):
        self._write('f.json', '{}')
        manager = VersionManager(self.version_dir)
        meta = manager.create_version(self.source_dir)
        fetched = manager.get_version(meta['version_id'])
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched['version_id'], meta['version_id'])

    def test_get_version_returns_none_for_missing(self):
        manager = VersionManager(self.version_dir)
        self.assertIsNone(manager.get_version('v_not_exist'))


class TestVersionManagerCleanup(_TmpDirMixin, unittest.TestCase):
    """自动清理测试"""

    def test_cleanup_keeps_only_n_latest(self):
        self._write('f.json', '{}')
        manager = VersionManager(self.version_dir, keep_versions=2)
        created_ids = []
        for _ in range(4):
            meta = manager.create_version(self.source_dir)
            created_ids.append(meta['version_id'])
            time.sleep(0.01)
        listed = manager.list_versions()
        self.assertEqual(len(listed), 2)
        # 最近两个应保留
        self.assertIn(created_ids[-1], [v['version_id'] for v in listed])
        self.assertIn(created_ids[-2], [v['version_id'] for v in listed])
        # 最早两个应被清理
        self.assertNotIn(created_ids[0], [v['version_id'] for v in listed])
        self.assertNotIn(created_ids[1], [v['version_id'] for v in listed])

    def test_invalid_keep_versions_raises(self):
        with self.assertRaises(ValueError):
            VersionManager(self.version_dir, keep_versions=0)


class TestVersionManagerRestore(_TmpDirMixin, unittest.TestCase):
    """回滚测试"""

    def test_restore_copies_files(self):
        self._write('level1.json', '[1]')
        manager = VersionManager(self.version_dir)
        meta = manager.create_version(self.source_dir)

        restore_dir = os.path.join(self.tmp_root, 'restore')
        count = manager.restore_version(meta['version_id'], restore_dir)
        self.assertEqual(count, 1)
        self.assertTrue(os.path.isfile(os.path.join(restore_dir, 'level1.json')))

    def test_restore_skips_existing_without_overwrite(self):
        self._write('dup.json', 'new')
        manager = VersionManager(self.version_dir)
        meta = manager.create_version(self.source_dir)

        restore_dir = os.path.join(self.tmp_root, 'restore')
        os.makedirs(restore_dir, exist_ok=True)
        with open(os.path.join(restore_dir, 'dup.json'), 'w', encoding='utf-8') as f:
            f.write('keep')

        count = manager.restore_version(meta['version_id'], restore_dir, overwrite=False)
        self.assertEqual(count, 0)
        with open(os.path.join(restore_dir, 'dup.json'), 'r', encoding='utf-8') as f:
            self.assertEqual(f.read(), 'keep')

    def test_restore_overwrite_replaces_existing(self):
        self._write('dup.json', 'new')
        manager = VersionManager(self.version_dir)
        meta = manager.create_version(self.source_dir)

        restore_dir = os.path.join(self.tmp_root, 'restore')
        os.makedirs(restore_dir, exist_ok=True)
        with open(os.path.join(restore_dir, 'dup.json'), 'w', encoding='utf-8') as f:
            f.write('keep')

        count = manager.restore_version(meta['version_id'], restore_dir, overwrite=True)
        self.assertEqual(count, 1)
        with open(os.path.join(restore_dir, 'dup.json'), 'r', encoding='utf-8') as f:
            self.assertEqual(f.read(), 'new')

    def test_restore_raises_for_missing_version(self):
        manager = VersionManager(self.version_dir)
        with self.assertRaises(FileNotFoundError):
            manager.restore_version('v_missing', self.tmp_root)


class TestVersionManagerDiff(_TmpDirMixin, unittest.TestCase):
    """版本对比测试"""

    def test_diff_detects_added_and_removed(self):
        self._write('a.json', '{}')
        manager = VersionManager(self.version_dir)
        v1 = manager.create_version(self.source_dir)
        time.sleep(0.01)

        os.remove(os.path.join(self.source_dir, 'a.json'))
        self._write('b.json', '{}')
        v2 = manager.create_version(self.source_dir)

        diff = manager.diff_versions(v1['version_id'], v2['version_id'])
        self.assertEqual(diff['added'], ['b.json'])
        self.assertEqual(diff['removed'], ['a.json'])
        self.assertEqual(diff['common'], [])

    def test_diff_for_identical_versions(self):
        self._write('x.json', '{}')
        manager = VersionManager(self.version_dir)
        v1 = manager.create_version(self.source_dir)
        time.sleep(0.01)
        v2 = manager.create_version(self.source_dir)
        diff = manager.diff_versions(v1['version_id'], v2['version_id'])
        self.assertEqual(diff['added'], [])
        self.assertEqual(diff['removed'], [])
        self.assertEqual(diff['common'], ['x.json'])


class TestVersionManagerDelete(_TmpDirMixin, unittest.TestCase):
    """删除版本测试"""

    def test_delete_existing_version(self):
        self._write('a.json', '{}')
        manager = VersionManager(self.version_dir)
        meta = manager.create_version(self.source_dir)
        self.assertTrue(manager.delete_version(meta['version_id']))
        self.assertIsNone(manager.get_version(meta['version_id']))

    def test_delete_missing_version_returns_false(self):
        manager = VersionManager(self.version_dir)
        self.assertFalse(manager.delete_version('v_not_exist'))


if __name__ == '__main__':
    unittest.main()
