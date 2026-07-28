#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
增量更新模块测试
覆盖内容哈希、差异检测、状态管理、合并逻辑
"""

import json
import os
import tempfile
import unittest
from typing import Dict, List

from .incremental import (
    compute_record_hash,
    compute_records_hashes,
    diff_records,
    PipelineState,
    IncrementalProcessor,
    DEFAULT_STATE_FILE,
    STATE_VERSION,
)


class TestComputeRecordHash(unittest.TestCase):
    """单条记录哈希计算测试"""

    def test_hash_is_stable_for_same_content(self):
        record = {'text_id': 'WEN_01', 'word': '学', 'basic_meaning': '学习'}
        first = compute_record_hash(record)
        second = compute_record_hash(record)
        self.assertEqual(first, second)

    def test_hash_differs_for_different_content(self):
        record_a = {'text_id': 'WEN_01', 'word': '学'}
        record_b = {'text_id': 'WEN_01', 'word': '习'}
        self.assertNotEqual(compute_record_hash(record_a), compute_record_hash(record_b))

    def test_hash_is_order_independent(self):
        record_a = {'a': 1, 'b': 2, 'c': 3}
        record_b = {'c': 3, 'a': 1, 'b': 2}
        self.assertEqual(compute_record_hash(record_a), compute_record_hash(record_b))

    def test_hash_returns_hex_string(self):
        record = {'text_id': 'WEN_01'}
        result = compute_record_hash(record)
        self.assertIsInstance(result, str)
        self.assertEqual(len(result), 40)


class TestComputeRecordsHashes(unittest.TestCase):
    """批量记录哈希测试"""

    def test_uses_text_id_as_key(self):
        records = [
            {'text_id': 'WEN_01', 'word': '学'},
            {'text_id': 'WEN_02', 'word': '习'},
        ]
        hashes = compute_records_hashes(records)
        self.assertIn('WEN_01', hashes)
        self.assertIn('WEN_02', hashes)
        self.assertEqual(len(hashes), 2)

    def test_skips_records_without_text_id(self):
        records = [
            {'text_id': 'WEN_01', 'word': '学'},
            {'word': '习'},
            {'text_id': '', 'word': 'empty'},
        ]
        hashes = compute_records_hashes(records)
        self.assertEqual(len(hashes), 1)
        self.assertIn('WEN_01', hashes)

    def test_empty_input_returns_empty_dict(self):
        self.assertEqual(compute_records_hashes([]), {})


class TestDiffRecords(unittest.TestCase):
    """记录差异检测测试"""

    def test_detect_added_records(self):
        current = {'WEN_01': 'h1', 'WEN_02': 'h2'}
        previous = {'WEN_01': 'h1'}
        added, changed, removed = diff_records(current, previous)
        self.assertEqual(added, ['WEN_02'])
        self.assertEqual(changed, [])
        self.assertEqual(removed, [])

    def test_detect_removed_records(self):
        current = {'WEN_01': 'h1'}
        previous = {'WEN_01': 'h1', 'WEN_02': 'h2'}
        added, changed, removed = diff_records(current, previous)
        self.assertEqual(added, [])
        self.assertEqual(changed, [])
        self.assertEqual(removed, ['WEN_02'])

    def test_detect_changed_records(self):
        current = {'WEN_01': 'h1_new', 'WEN_02': 'h2'}
        previous = {'WEN_01': 'h1_old', 'WEN_02': 'h2'}
        added, changed, removed = diff_records(current, previous)
        self.assertEqual(added, [])
        self.assertEqual(changed, ['WEN_01'])
        self.assertEqual(removed, [])

    def test_mixed_changes(self):
        current = {'WEN_01': 'h1_new', 'WEN_03': 'h3'}
        previous = {'WEN_01': 'h1_old', 'WEN_02': 'h2'}
        added, changed, removed = diff_records(current, previous)
        self.assertEqual(added, ['WEN_03'])
        self.assertEqual(changed, ['WEN_01'])
        self.assertEqual(removed, ['WEN_02'])

    def test_no_changes_returns_empty_lists(self):
        hashes = {'WEN_01': 'h1', 'WEN_02': 'h2'}
        added, changed, removed = diff_records(hashes, dict(hashes))
        self.assertEqual(added, [])
        self.assertEqual(changed, [])
        self.assertEqual(removed, [])

    def test_empty_previous_treats_all_as_added(self):
        current = {'WEN_01': 'h1', 'WEN_02': 'h2'}
        added, changed, removed = diff_records(current, {})
        self.assertEqual(added, ['WEN_01', 'WEN_02'])
        self.assertEqual(changed, [])
        self.assertEqual(removed, [])


class TestPipelineState(unittest.TestCase):
    """状态管理测试"""

    def setUp(self):
        self.tmp_dir = tempfile.mkdtemp()
        self.state_path = os.path.join(self.tmp_dir, 'state.json')

    def tearDown(self):
        if os.path.exists(self.state_path):
            os.remove(self.state_path)
        os.rmdir(self.tmp_dir)

    def test_load_returns_false_when_file_missing(self):
        state = PipelineState(self.state_path)
        self.assertFalse(state.load())

    def test_save_and_load_roundtrip(self):
        state = PipelineState(self.state_path)
        state.set_record_hashes('level1_quiz.json', {'WEN_01': 'h1'})
        state.save()

        loaded = PipelineState(self.state_path)
        self.assertTrue(loaded.load())
        self.assertEqual(
            loaded.get_record_hashes('level1_quiz.json'),
            {'WEN_01': 'h1'},
        )

    def test_corrupted_state_file_resets(self):
        with open(self.state_path, 'w', encoding='utf-8') as f:
            f.write('{ invalid json')
        state = PipelineState(self.state_path)
        self.assertFalse(state.load())
        self.assertEqual(state.get_record_hashes('any.json'), {})

    def test_file_hash_tracking(self):
        state = PipelineState(self.state_path)
        self.assertIsNone(state.get_file_hash('a.json'))
        state.set_file_hash('a.json', 'fp_abc')
        self.assertEqual(state.get_file_hash('a.json'), 'fp_abc')

    def test_save_creates_directory(self):
        nested = os.path.join(self.tmp_dir, 'sub', 'dir', 'state.json')
        state = PipelineState(nested)
        state.save()
        self.assertTrue(os.path.exists(nested))
        # 清理子目录（先删文件再删目录）
        if os.path.exists(nested):
            os.remove(nested)
        inner = os.path.join(self.tmp_dir, 'sub', 'dir')
        outer = os.path.join(self.tmp_dir, 'sub')
        if os.path.exists(inner):
            os.rmdir(inner)
        if os.path.exists(outer):
            os.rmdir(outer)

    def test_state_version_field(self):
        state = PipelineState(self.state_path)
        self.assertEqual(state.state['version'], STATE_VERSION)


class TestIncrementalProcessor(unittest.TestCase):
    """增量处理器测试"""

    def setUp(self):
        self.tmp_dir = tempfile.mkdtemp()
        self.state_path = os.path.join(self.tmp_dir, 'state.json')

    def tearDown(self):
        if os.path.exists(self.state_path):
            os.remove(self.state_path)
        os.rmdir(self.tmp_dir)

    def test_has_changes_when_first_run(self):
        proc = IncrementalProcessor(self.state_path)
        self.assertTrue(proc.has_changes('a.json', {'WEN_01': 'h1'}))

    def test_has_changes_when_no_changes(self):
        proc = IncrementalProcessor(self.state_path)
        proc.commit('a.json', {'WEN_01': 'h1'})
        self.assertFalse(proc.has_changes('a.json', {'WEN_01': 'h1'}))

    def test_has_changes_when_content_changed(self):
        proc = IncrementalProcessor(self.state_path)
        proc.commit('a.json', {'WEN_01': 'h1'})
        self.assertTrue(proc.has_changes('a.json', {'WEN_01': 'h2'}))

    def test_has_changes_when_keys_changed(self):
        proc = IncrementalProcessor(self.state_path)
        proc.commit('a.json', {'WEN_01': 'h1'})
        self.assertTrue(proc.has_changes('a.json', {'WEN_01': 'h1', 'WEN_02': 'h2'}))

    def test_collect_changes_returns_correct_diff(self):
        proc = IncrementalProcessor(self.state_path)
        proc.commit('a.json', {'WEN_01': 'h1', 'WEN_02': 'h2'})
        added, changed, removed = proc.collect_changes(
            'a.json',
            {'WEN_01': 'h1_new', 'WEN_03': 'h3'},
        )
        self.assertEqual(added, ['WEN_03'])
        self.assertEqual(changed, ['WEN_01'])
        self.assertEqual(removed, ['WEN_02'])

    def test_commit_updates_state(self):
        proc = IncrementalProcessor(self.state_path)
        proc.commit('a.json', {'WEN_01': 'h1'})
        self.assertEqual(proc.state.get_record_hashes('a.json'), {'WEN_01': 'h1'})
        self.assertIsNotNone(proc.state.get_file_hash('a.json'))

    def test_flush_persists_to_disk(self):
        proc = IncrementalProcessor(self.state_path)
        proc.commit('a.json', {'WEN_01': 'h1'})
        proc.flush()
        self.assertTrue(os.path.exists(self.state_path))

        fresh = IncrementalProcessor(self.state_path)
        self.assertEqual(fresh.state.get_record_hashes('a.json'), {'WEN_01': 'h1'})


class TestMergeRecords(unittest.TestCase):
    """记录合并测试"""

    def setUp(self):
        self.tmp_dir = tempfile.mkdtemp()
        self.state_path = os.path.join(self.tmp_dir, 'state.json')

    def tearDown(self):
        for name in os.listdir(self.tmp_dir):
            os.remove(os.path.join(self.tmp_dir, name))
        os.rmdir(self.tmp_dir)

    def test_merges_new_with_existing(self):
        path = os.path.join(self.tmp_dir, 'data.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump([
                {'text_id': 'WEN_01', 'word': '学'},
                {'text_id': 'WEN_02', 'word': '习'},
            ], f, ensure_ascii=False)

        proc = IncrementalProcessor(self.state_path)
        merged = proc.merge_records(
            path,
            [{'text_id': 'WEN_02', 'word': '习_v2'}],
            removed_keys=[],
        )

        keys = [r['text_id'] for r in merged]
        self.assertIn('WEN_01', keys)
        self.assertIn('WEN_02', keys)
        w02 = next(r for r in merged if r['text_id'] == 'WEN_02')
        self.assertEqual(w02['word'], '习_v2')

    def test_removes_deleted_keys(self):
        path = os.path.join(self.tmp_dir, 'data.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump([
                {'text_id': 'WEN_01', 'word': '学'},
                {'text_id': 'WEN_02', 'word': '习'},
            ], f, ensure_ascii=False)

        proc = IncrementalProcessor(self.state_path)
        merged = proc.merge_records(path, [], removed_keys=['WEN_02'])
        keys = [r['text_id'] for r in merged]
        self.assertIn('WEN_01', keys)
        self.assertNotIn('WEN_02', keys)

    def test_returns_only_new_when_no_existing_file(self):
        path = os.path.join(self.tmp_dir, 'missing.json')
        proc = IncrementalProcessor(self.state_path)
        merged = proc.merge_records(
            path,
            [{'text_id': 'WEN_01', 'word': '学'}],
            removed_keys=[],
        )
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]['text_id'], 'WEN_01')

    def test_handles_corrupted_existing_file(self):
        path = os.path.join(self.tmp_dir, 'broken.json')
        with open(path, 'w', encoding='utf-8') as f:
            f.write('not json')
        proc = IncrementalProcessor(self.state_path)
        merged = proc.merge_records(
            path,
            [{'text_id': 'WEN_01', 'word': '学'}],
            removed_keys=[],
        )
        self.assertEqual(len(merged), 1)


if __name__ == '__main__':
    unittest.main()
