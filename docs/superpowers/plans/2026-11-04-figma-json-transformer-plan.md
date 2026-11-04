# Figma → 前端 Schema 转换脚本 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 GitHub 仓库 `figma-transformer/` 下实现 Python 转换脚本，把 Figma 插件上传的对象嵌套格式 JSON 转换成前端 adapters 期望的 schema（数组/segments 数组），后端 assetService.js 上传成功后自动触发。

**Architecture:** 4 个 transformer pure functions（word_list / multi_role_reading / level1_quiz / text_basic_info），统一 transform.py 入口做格式预检（is_already_correct）+ 分发 + OSS 读写，每个 transformer 内部也有防御逻辑（双重保险）。后端集成通过 assetService.batchProcessFiles 上传成功后调用 Python 子进程。

**Tech Stack:** Python 3.11 + pytest + ali-oss（后端已用）+ Node.js child_process.spawn

---

## File Structure

### 新建文件

| 文件 | 职责 |
|------|------|
| `figma-transformer/config.py` | TRANSFORM_MAP 目录映射 + META_FIELDS 元数据 + is_already_correct 格式预检 |
| `figma-transformer/transform.py` | 主入口：读 OSS → 格式预检 → 分发 transformer → 写回 OSS |
| `figma-transformer/requirements.txt` | pytest |
| `figma-transformer/__init__.py` | 空文件 |
| `figma-transformer/transformers/__init__.py` | 导出 4 个 transformer |
| `figma-transformer/transformers/text_basic_info.py` | text_basic_info transformer（只校验字段） |
| `figma-transformer/transformers/word_list.py` | word_list transformer（对象→数组 + 内部防御） |
| `figma-transformer/transformers/multi_role_reading.py` | multi_role_reading transformer（对象→segments 数组 + 内部防御） |
| `figma-transformer/transformers/level1_quiz.py` | level1_quiz transformer（对象→数组 + 内部防御） |
| `figma-transformer/__tests__/__init__.py` | 空文件 |
| `figma-transformer/__tests__/fixtures/word_list/WEN_01_legacy_array.json` | 01-04 Excel 遗留 fixture |
| `figma-transformer/__tests__/fixtures/word_list/WEN_05_plugin_object.json` | 插件新上传 fixture |
| `figma-transformer/__tests__/fixtures/multi_role_reading/WEN_01_legacy_segments.json` | 01-04 遗留 fixture |
| `figma-transformer/__tests__/fixtures/multi_role_reading/WEN_05_plugin_object.json` | 插件新上传 fixture |
| `figma-transformer/__tests__/fixtures/level1_quiz/WEN_01_legacy_array.json` | 01-04 遗留 fixture |
| `figma-transformer/__tests__/fixtures/level1_quiz/WEN_05_plugin_object.json` | 插件新上传 fixture |
| `figma-transformer/__tests__/test_word_list.py` | word_list 单元测试 |
| `figma-transformer/__tests__/test_multi_role_reading.py` | multi_role_reading 单元测试 |
| `figma-transformer/__tests__/test_level1_quiz.py` | level1_quiz 单元测试 |
| `figma-transformer/__tests__/test_text_basic_info.py` | text_basic_info 单元测试 |
| `figma-transformer/__tests__/test_is_already_correct.py` | 格式预检测试 |
| `figma-transformer/__tests__/test_pipeline_integration.py` | 集成测试 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `backend/src/services/assetService.js` | batchProcessFiles 上传成功后，对 data/ 目录 JSON 调用 triggerTransform 子进程 |
| `.github/workflows/ci-checks.yml` | 新增 figma-transformer-check job |

---

## Task 1: 目录骨架 + config.py

**Files:**
- Create: `figma-transformer/__init__.py`
- Create: `figma-transformer/requirements.txt`
- Create: `figma-transformer/config.py`

- [ ] **Step 1: 创建空文件和 requirements**

`figma-transformer/__init__.py`：空文件（touch 即可）

`figma-transformer/requirements.txt`：
```
pytest>=7.0
```

- [ ] **Step 2: 创建 config.py**

```python
# figma-transformer/config.py

"""
目录 → transformer 的统一映射表 + 元数据字段定义 + 格式预检规则。
所有目录相关的配置集中在这里，transform.py 和各 transformer 都从这里读。
"""

# 每个目录的元数据字段（跳过不拆，直接透传到顶层）
# 非元数据的 key 一律视为数据项，按 transformer 类型拆入数组/嵌套
META_FIELDS: dict[str, set[str]] = {
    'text_basic_info': set(),                             # 没有元数据，全是字段
    'word_list': {'text_id'},
    'multi_role_reading': {'text_id', 'audio_file'},
    'level1_quiz': {'text_id'},
}

# transformer 函数引用（在 Task 3 各 transformer 创建后填这里）
# 先用占位 None，Task 4 统一注入
TRANSFORM_MAP: dict[str, object] = {}


def is_already_correct(directory: str, data) -> bool:
    """
    格式预检：判断 data 是否已经是前端期望的正确格式。
    返回 True → 应跳过转换，保护 01-04 Excel 管线遗留文件。
    返回 False → 需要转换。
    """
    # 目录不在 transformer 范围内 → 不跳过
    if directory not in TRANSFORM_MAP:
        return False

    if directory in ('word_list', 'level1_quiz'):
        # 正确格式是数组
        return isinstance(data, list)

    if directory == 'multi_role_reading':
        # 正确格式是 {..., segments: [...]}
        return isinstance(data, dict) and 'segments' in data

    if directory == 'text_basic_info':
        # 每次都跑校验，无害
        return False

    return False
```

- [ ] **Step 3: Commit**

```bash
git add figma-transformer/__init__.py figma-transformer/requirements.txt figma-transformer/config.py
git commit -m "feat(data-pipeline): add figma-transformer skeleton and config.py"
```

---

## Task 2: Transformer 单元测试（TDD：先写测试）

**Files:**
- Create: `figma-transformer/__tests__/__init__.py`
- Create: `figma-transformer/__tests__/test_word_list.py`
- Create: `figma-transformer/__tests__/test_is_already_correct.py`

> 这一步只写 word_list 和 is_already_correct 两组最关键的测试。其他 transformer 的测试在 Task 5 里补。
> **TDD 顺序**：先写测试 → 运行（会 fail，因为 transformer 还没创建）→ 写实现 → 运行（应该 pass）

- [ ] **Step 1: 创建测试目录骨架**

`figma-transformer/__tests__/__init__.py`：空文件

- [ ] **Step 2: 写 test_is_already_correct.py（格式预检测试，最关键）**

```python
# figma-transformer/__tests__/test_is_already_correct.py

"""
格式预检测试：is_already_correct() 对正确格式返回 True（skip），对插件格式返回 False（转换）。
保护 01-04 Excel 遗留文件不被误覆盖。
"""

import sys, os
# 把 figma-transformer 加到 sys.path，pytest 运行时能 import config
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from config import is_already_correct


class TestWordListPreCheck:
    """word_list：正确格式是数组，插件产出是对象"""

    def test_legacy_array_should_skip(self):
        """01-04 Excel 遗留的数组格式 → skip"""
        data = [{"text_id": "WEN_01", "word": "史记", "basic_meaning": "..."}]
        assert is_already_correct('word_list', data) is True

    def test_plugin_object_should_convert(self):
        """插件产出的对象格式 → 需要转换"""
        data = {"text_id": "WEN_05", "史记": {"basic_meaning": "..."}}
        assert is_already_correct('word_list', data) is False


class TestMultiRolePreCheck:
    """multi_role_reading：正确格式已有 segments 字段"""

    def test_legacy_with_segments_should_skip(self):
        """01-04 已有 segments → skip"""
        data = {"text_id": "WEN_01", "audio_file": "...", "segments": []}
        assert is_already_correct('multi_role_reading', data) is True

    def test_plugin_without_segments_should_convert(self):
        """插件产出没有 segments → 需要转换"""
        data = {"text_id": "WEN_05", "audio_file": "...", "旁白📖": {}}
        assert is_already_correct('multi_role_reading', data) is False


class TestLevel1QuizPreCheck:
    """level1_quiz：和 word_list 同款，正确格式是数组"""

    def test_legacy_array_should_skip(self):
        data = [{"text_id": "WEN_01", "question_number": 1}]
        assert is_already_correct('level1_quiz', data) is True

    def test_plugin_object_should_convert(self):
        data = {"text_id": "WEN_05", "1": {"question_text": "..."}}
        assert is_already_correct('level1_quiz', data) is False


class TestTextBasicInfoPreCheck:
    """text_basic_info：永远返回 False，每次都跑校验"""

    def test_always_should_run(self):
        data = {"text_id": "WEN_01", "title": "陈涉世家"}
        assert is_already_correct('text_basic_info', data) is False


class TestUnknownDirectoryPreCheck:
    """未知目录：默认不跳过"""

    def test_unknown_should_not_skip(self):
        assert is_already_correct('unknown_dir', {'foo': 'bar'}) is False
```

- [ ] **Step 3: 写 test_word_list.py（word_list transformer 单测）**

```python
# figma-transformer/__tests__/test_word_list.py

"""
word_list transformer 纯函数测试。
测试命名解耦合：key 名（史记/阳城/项伯）不硬编码，transformer 只负责搬运。
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# 等 transformer 创建后取消注释
# from transformers.word_list import transform


class TestWordListTransform:
    """word_list transformer 的转换逻辑测试"""

    def test_basic_conversion(self):
        """插件对象格式 → 前端数组格式"""
        from transformers.word_list import transform

        raw = {
            "text_id": "WEN_05",
            "史记": {"basic_meaning": "选自《太史公书》", "follow_up_questions": []},
            "阳城": {"basic_meaning": "在今河南登封东南"}
        }
        result = transform(raw, "WEN_05")

        assert isinstance(result, list)
        assert len(result) == 2
        # 排序不稳定，用 any 查
        assert any(item['word'] == '史记' and item['basic_meaning'] == '选自《太史公书》' for item in result)
        assert any(item['word'] == '阳城' and item['basic_meaning'] == '在今河南登封东南' for item in result)
        # 每个项的 text_id 都是 wen_id
        assert all(item['text_id'] == 'WEN_05' for item in result)

    def test_internal_defense_array_passthrough(self):
        """内部防御：传入数组（01-04 Excel 遗留）→ 原样返回，不动"""
        from transformers.word_list import transform

        legacy = [{"text_id": "WEN_01", "word": "史记", "basic_meaning": "选自《太史公书》"}]
        result = transform(legacy, "WEN_01")

        assert result is legacy  # 同一个对象引用，证明没被改写
        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0]['word'] == '史记'

    def test_empty_returns_empty_list(self):
        """只有 text_id，没有子 Frame → 空数组"""
        from transformers.word_list import transform

        result = transform({"text_id": "WEN_05"}, "WEN_05")
        assert result == []

    def test_preserves_all_sub_fields(self):
        """子 Frame 里所有字段都要原样透传到数组项"""
        from transformers.word_list import transform

        raw = {
            "text_id": "WEN_05",
            "项伯": {
                "basic_meaning": "项羽的叔父",
                "synonym_analysis": "无",
                "follow_up_questions": ["谁是项伯？"]
            }
        }
        result = transform(raw, "WEN_05")
        assert result[0]['synonym_analysis'] == '无'
        assert result[0]['follow_up_questions'] == ['谁是项伯？']

    def test_text_id_fallback(self):
        """插件漏写 text_id → fallback 用 wen_id 参数"""
        from transformers.word_list import transform

        raw = {"司马迁": {"basic_meaning": "西汉史学家"}}
        result = transform(raw, "WEN_05")
        assert result[0]['text_id'] == 'WEN_05'
        assert result[0]['word'] == '司马迁'
```

- [ ] **Step 4: 装 pytest 并跑格式预检测试（会 fail，因为 config.TRANSFORM_MAP 是空的）**

Run:
```bash
cd d:\wenyanplatform && pip install pytest && python -m pytest figma-transformer/__tests__/test_is_already_correct.py -v
```

Expected: 大部分 pass（config.py 的 is_already_correct 对未知目录默认 False），但 word_list/multi_role_reading/level1_quiz 相关测试可能需要 TRANSFORM_MAP 有值。这没关系——现在只是确保测试文件能被收集。

- [ ] **Step 5: word_list 测试暂时会 fail（transformer 还没创建），先跑一下确认 pytest 能发现它**

Run:
```bash
python -m pytest figma-transformer/__tests__/test_word_list.py --collect-only -q
```

Expected: 5 tests collected (全部 test_function_name 可枚举)

- [ ] **Step 6: Commit**

```bash
git add figma-transformer/__tests__/
git commit -m "test(data-pipeline): add is_already_correct and word_list transformer tests (TDD)"
```

---

## Task 3: 4 个 Transformer 实现（带内部防御）

**Files:**
- Create: `figma-transformer/transformers/__init__.py`
- Create: `figma-transformer/transformers/word_list.py`
- Create: `figma-transformer/transformers/multi_role_reading.py`
- Create: `figma-transformer/transformers/level1_quiz.py`
- Create: `figma-transformer/transformers/text_basic_info.py`
- Modify: `figma-transformer/config.py` (注入 TRANSFORM_MAP)

- [ ] **Step 1: 创建 transformers/__init__.py**

```python
# figma-transformer/transformers/__init__.py

from .text_basic_info import transform as text_basic_info_transform
from .word_list import transform as word_list_transform
from .multi_role_reading import transform as multi_role_reading_transform
from .level1_quiz import transform as level1_quiz_transform

__all__ = [
    'text_basic_info_transform',
    'word_list_transform',
    'multi_role_reading_transform',
    'level1_quiz_transform',
]
```

- [ ] **Step 2: 创建 word_list.py**

```python
# figma-transformer/transformers/word_list.py

"""
word_list transformer：插件对象格式 → 前端 RawWordItem[] 数组。
命名解耦合：不硬编码词名，只做结构性搬运。
"""


def transform(raw, wen_id: str):
    """
    raw:   插件产出的原始 JSON（对象嵌套格式）
           {text_id: "WEN_05", "史记": {basic_meaning: "...", ...}, "阳城": {...}}
    wen_id: 课文编号，raw 里没有 text_id 时用作 fallback
    return: 前端期望的数组
           [{text_id: "WEN_05", word: "史记", basic_meaning: "...", ...}, ...]
    """
    # 内部防御：已是数组（01-04 Excel 遗留）→ 原样返回，不被改写
    if isinstance(raw, list):
        return raw

    META = {'text_id'}
    items = []
    text_id = raw.get('text_id') if isinstance(raw, dict) else None
    text_id = text_id or wen_id

    if isinstance(raw, dict):
        for key, value in raw.items():
            if key in META or not isinstance(value, dict):
                continue
            item = {'text_id': text_id, 'word': key}
            item.update(value)
            items.append(item)

    return items
```

- [ ] **Step 3: 创建 multi_role_reading.py**

```python
# figma-transformer/transformers/multi_role_reading.py

"""
multi_role_reading transformer：插件对象格式 → 前端 MultiRoleData。
插件产出: {text_id, audio_file, "角色名": {sentence_index, time_range, dialogue}}
前端期望: {text_id, audio_file, segments: [{role_name, sentence_index, time_range, dialogue}]}
"""


def transform(raw, wen_id: str):
    """
    raw:   插件产出的原始 JSON
    wen_id: 课文编号，raw 里没有 text_id 时用作 fallback
    return: 前端期望的对象（带 segments 数组）
    """
    # 内部防御：已有 segments 字段（01-04 Excel 遗留）→ 原样返回
    if isinstance(raw, dict) and 'segments' in raw:
        return raw

    META = {'text_id', 'audio_file'}
    segments = []

    if isinstance(raw, dict):
        # 元数据字段原样保留在顶层
        result = {k: v for k, v in raw.items() if k in META}
        # 没有 text_id 时 fallback
        if 'text_id' not in result:
            result['text_id'] = wen_id

        for key, value in raw.items():
            if key in META or not isinstance(value, dict):
                continue
            segment = {'role_name': key}
            segment.update(value)
            segments.append(segment)

        result['segments'] = segments
        return result

    # 非 dict 兜底：返回空结构，不崩
    return {'text_id': wen_id, 'segments': []}
```

- [ ] **Step 4: 创建 level1_quiz.py**

```python
# figma-transformer/transformers/level1_quiz.py

"""
level1_quiz transformer：插件对象格式 → 前端 RawLevelQuizItem[] 数组。
命名解耦合：不硬编码题号，只做结构性搬运。
"""


def transform(raw, wen_id: str):
    """
    raw:   插件产出的原始 JSON
    wen_id: 课文编号，raw 里没有 text_id 时用作 fallback
    return: 前端期望的数组
    """
    # 内部防御：已是数组（01-04 Excel 遗留）→ 原样返回
    if isinstance(raw, list):
        return raw

    META = {'text_id'}
    items = []
    text_id = raw.get('text_id') if isinstance(raw, dict) else None
    text_id = text_id or wen_id

    if isinstance(raw, dict):
        for key, value in raw.items():
            if key in META or not isinstance(value, dict):
                continue
            item = {'text_id': text_id}
            # 子 Frame 名是题号：纯数字 → 转 int，否则保留字符串
            item['question_number'] = int(key) if str(key).isdigit() else key
            item.update(value)
            items.append(item)

        # 按 question_number 排序，保证展示顺序一致
        items.sort(key=lambda x: x.get('question_number', 0))

    return items
```

- [ ] **Step 5: 创建 text_basic_info.py**

```python
# figma-transformer/transformers/text_basic_info.py

"""
text_basic_info transformer：插件和 Excel 管线产出格式一致，只做必填字段校验 + 默认值填充。
不改变结构，每次都跑（内部不需要防御，因为永远只校验）。
"""


def transform(raw, wen_id: str):
    """
    raw:   对象格式，两种来源产出相同
    wen_id: fallback 用
    return: 原样 dict，补全缺失的必填字段
    """
    if not isinstance(raw, dict):
        raw = {}

    REQUIRED = {'text_id', 'title', 'author', 'dynasty', 'original_text'}
    for field in REQUIRED:
        if field not in raw or raw[field] is None:
            raw[field] = ''  # 填默认值，不崩

    # text_id 缺失时 fallback
    if not raw.get('text_id'):
        raw['text_id'] = wen_id

    return raw
```

- [ ] **Step 6: 更新 config.py 注入 TRANSFORM_MAP**

在 `figma-transformer/config.py` 的 TRANSFORM_MAP 占位处填入真实引用（在文件末尾追加）：

```python
# figma-transformer/config.py 末尾追加

# 延迟导入避免循环（transformers 内部 import config 时可能触发）
def _inject_transforms():
    global TRANSFORM_MAP
    from transformers import (
        text_basic_info_transform,
        word_list_transform,
        multi_role_reading_transform,
        level1_quiz_transform,
    )
    TRANSFORM_MAP.update({
        'text_basic_info': text_basic_info_transform,
        'word_list': word_list_transform,
        'multi_role_reading': multi_role_reading_transform,
        'level1_quiz': level1_quiz_transform,
    })
    return TRANSFORM_MAP


# 模块加载时注入
_inject_transforms()
```

- [ ] **Step 7: 跑测试验证 transformer 实现正确**

Run:
```bash
python -m pytest figma-transformer/__tests__/test_word_list.py -v
python -m pytest figma-transformer/__tests__/test_is_already_correct.py -v
```

Expected: 全部 PASS

- [ ] **Step 8: Commit**

```bash
git add figma-transformer/transformers/ figma-transformer/config.py
git commit -m "feat(data-pipeline): implement 4 figma-transformers with internal defense"
```

---

## Task 4: transform.py 主入口 + 单元测试

**Files:**
- Create: `figma-transformer/transform.py`
- Create: `figma-transformer/__tests__/fixtures/word_list/WEN_01_legacy_array.json`
- Create: `figma-transformer/__tests__/fixtures/word_list/WEN_05_plugin_object.json`
- Create: `figma-transformer/__tests__/test_pipeline_integration.py`

- [ ] **Step 1: 创建 fixture 文件**

`figma-transformer/__tests__/fixtures/word_list/WEN_01_legacy_array.json`:
```json
[
  {"text_id": "WEN_01", "word": "史记", "basic_meaning": "选自《太史公书》", "follow_up_questions": []},
  {"text_id": "WEN_01", "word": "阳城", "basic_meaning": "在今河南登封东南", "follow_up_questions": []}
]
```

`figma-transformer/__tests__/fixtures/word_list/WEN_05_plugin_object.json`:
```json
{
  "text_id": "WEN_05",
  "史记": {"basic_meaning": "选自《太史公书》", "follow_up_questions": []},
  "阳城": {"basic_meaning": "在今河南登封东南"}
}
```

- [ ] **Step 2: 创建 transform.py 主入口**

```python
# figma-transformer/transform.py

"""
Figma → 前端 Schema 转换脚本 主入口。

职责：
1. 从 OSS（或本地 data 目录）读 JSON
2. 格式预检：已是正确格式 → skip
3. TRANSFORM_MAP 分发 transformer
4. 写回同一路径

用法：
  python transform.py --path data/word_list/WEN_05.json
  python transform.py --batch paths.txt       # 文件里每行一个 ossPath
"""

import argparse
import json
import logging
import os
import sys

# 把 figma-transformer 加到 sys.path，确保能 import config
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if _SCRIPT_DIR not in sys.path:
    sys.path.insert(0, _SCRIPT_DIR)

from config import TRANSFORM_MAP, is_already_correct

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
)
log = logging.getLogger('transform')


# ============================================================
# OSS 读写（后端没配置时 fallback 到本地 data 目录）
# ============================================================

def _resolve_local_path(oss_path: str, local_data_root: str) -> str:
    """把 OSS 路径解析为本地文件路径"""
    safe = os.path.normpath(oss_path)
    if safe.startswith('..'):
        raise ValueError(f'非法路径穿越: {oss_path}')
    return os.path.join(local_data_root, safe)


def read_oss_json(oss_path: str, local_data_root: str | None = None,
                  bucket: str | None = None, **_oss_config) -> dict | list | None:
    """
    从 OSS 或本地读 JSON。

    有 bucket → 用 ali-oss 读
    无 bucket → 从 local_data_root/<oss_path> 读（开发/测试环境 fallback）
    """
    if bucket:
        try:
            import oss2  # 后端用的是 ali-oss，这里统一用 ali-oss 的 OSS class
            auth = oss2.Auth(_oss_config['accessKeyId'], _oss_config['accessKeySecret'])
            store = oss2.Bucket(auth, f"https://oss-{_oss_config['region'] or 'oss-cn-guangzhou'}.aliyuncs.com", bucket)
            result = store.get_object(oss_path)
            return json.loads(result.read())
        except ImportError:
            log.warning('oss2 未安装，fallback 本地读')
        except Exception as e:
            log.warning(f'OSS 读取失败 ({oss_path}): {e}，尝试本地')

    # 本地 fallback
    if local_data_root:
        local_path = _resolve_local_path(oss_path, local_data_root)
        if os.path.exists(local_path):
            with open(local_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        log.warning(f'本地文件不存在: {local_path}')
    return None


def write_oss_json(oss_path: str, data, local_data_root: str | None = None,
                   bucket: str | None = None, **_oss_config) -> bool:
    """写 JSON 到 OSS 或本地（和 read_oss_json 对称）"""
    content = json.dumps(data, ensure_ascii=False, indent=2)

    if bucket:
        try:
            import oss2
            auth = oss2.Auth(_oss_config['accessKeyId'], _oss_config['accessKeySecret'])
            store = oss2.Bucket(auth, f"https://oss-{_oss_config['region'] or 'oss-cn-guangzhou'}.aliyuncs.com", bucket)
            store.put_object(oss_path, content.encode('utf-8'), headers={'x-oss-object-acl': 'public-read'})
            return True
        except ImportError:
            log.warning('oss2 未安装，fallback 本地写')
        except Exception as e:
            log.error(f'OSS 写入失败 ({oss_path}): {e}')
            return False

    # 本地 fallback
    if local_data_root:
        local_path = _resolve_local_path(oss_path, local_data_root)
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        with open(local_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False


# ============================================================
# 主转换逻辑
# ============================================================

def transform_file(oss_path: str, oss_config: dict | None = None) -> dict:
    """
    单个文件的转换流程。

    返回: { status: 'skipped' | 'transformed' | 'error' | 'not_found', oss_path, message? }
    """
    oss_config = oss_config or {}

    # 1. 解析目录和 wenId
    parts = oss_path.replace('data/', '', 1).split('/')
    if len(parts) < 2:
        return {'status': 'error', 'oss_path', 'message': f'路径格式错误: {oss_path}'}
    directory = parts[0]
    wen_id = parts[1].replace('.json', '')

    # 2. 分发 transformer（无 transformer 的目录跳过转换）
    transform_func = TRANSFORM_MAP.get(directory)
    if transform_func is None:
        # 目录不在 transformer 范围，不读写，直接放行
        log.info(f'目录 {directory} 无 transformer，跳过转换: {oss_path}')
        return {'status': 'no_transformer', 'oss_path'}

    # 3. 读 JSON
    raw = read_oss_json(oss_path, **oss_config)
    if raw is None:
        log.warning(f'文件不存在或读取失败: {oss_path}')
        return {'status': 'not_found', 'oss_path'}

    # 4. 格式预检：已是正确格式 → skip
    if is_already_correct(directory, raw):
        log.info(f'已是正确格式，跳过: {oss_path}')
        return {'status': 'skipped', 'oss_path'}

    # 5. 执行转换
    try:
        result = transform_func(raw, wen_id)
    except Exception as e:
        log.error(f'转换失败 ({oss_path}): {e}', exc_info=True)
        return {'status': 'error', 'oss_path', 'message': str(e)}

    # 6. 写回
    ok = write_oss_json(oss_path, result, **oss_config)
    if not ok:
        return {'status': 'error', 'oss_path', 'message': '写入失败'}

    log.info(f'转换完成: {oss_path}')
    return {'status': 'transformed', 'oss_path'}


def main():
    parser = argparse.ArgumentParser(description='Figma JSON → 前端 Schema 转换脚本')
    parser.add_argument('--path', '-p', help='单个 OSS 路径，如 data/word_list/WEN_05.json')
    parser.add_argument('--batch', '-b', help='批量：文件里每行一个路径')
    parser.add_argument('--local-data-root', default=None, help='本地 data 根目录（无 OSS 配置时 fallback）')
    parser.add_argument('--oss-bucket', default=None)
    parser.add_argument('--oss-region', default='oss-cn-hangzhou')
    parser.add_argument('--oss-access-key-id', default=None)
    parser.add_argument('--oss-access-key-secret', default=None)
    args = parser.parse_args()

    if not args.path and not args.batch:
        parser.print_help()
        sys.exit(1)

    oss_config = {
        'local_data_root': args.local_data_root,
        'bucket': args.oss_bucket,
        'region': args.oss_region,
        'accessKeyId': args.oss_access_key_id,
        'accessKeySecret': args.oss_access_key_secret,
    }

    results = []
    if args.path:
        results.append(transform_file(args.path, oss_config))
    elif args.batch:
        with open(args.batch, 'r', encoding='utf-8') as f:
            paths = [line.strip() for line in f if line.strip()]
        for p in paths:
            results.append(transform_file(p, oss_config))

    # 汇总
    summary = {}
    for r in results:
        summary[r['status']] = summary.get(r['status'], 0) + 1
    log.info(f'批量完成: {summary}')
    sys.exit(0 if all(r['status'] != 'error' for r in results) else 1)


if __name__ == '__main__':
    main()
```

- [ ] **Step 3: 创建集成测试**

`figma-transformer/__tests__/test_pipeline_integration.py`:
```python
# figma-transformer/__tests__/test_pipeline_integration.py

"""
集成测试：用真实 fixtures 验证转换后的 JSON 能被前端 schema 正常消费。
不走 OSS mock，直接调 transformer，验证输出结构。
"""

import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), 'fixtures')


def load_fixture(rel_path):
    with open(os.path.join(FIXTURES_DIR, rel_path), 'r', encoding='utf-8') as f:
        return json.load(f)


class TestWordListIntegration:
    """word_list 集成测试"""

    def test_plugin_fixture_becomes_adapter_compatible(self):
        """插件 fixture → 转换 → 前端 RawWordItem[] schema"""
        raw = load_fixture('word_list/WEN_05_plugin_object.json')
        from transformers.word_list import transform
        result = transform(raw, 'WEN_05')

        assert isinstance(result, list)
        assert len(result) == 2
        for item in result:
            # 必填字段（wordListAdapter.processWordList 会用 .filter(item.word && item.basic_meaning)）
            assert 'text_id' in item
            assert 'word' in item
            assert 'basic_meaning' in item
            assert item['text_id'] == 'WEN_05'

    def test_legacy_fixture_stays_unchanged(self):
        """Excel 遗留 fixture → 内部防御 → 原样返回"""
        original = load_fixture('word_list/WEN_01_legacy_array.json')
        from transformers.word_list import transform
        result = transform(original, 'WEN_01')

        # 内部防御：isinstance(array) → return raw
        assert result is original
        assert json.dumps(result, ensure_ascii=False) == json.dumps(original, ensure_ascii=False)
```

- [ ] **Step 4: 跑全部测试验证**

Run:
```bash
cd d:\wenyanplatform\figma-transformer && python -m pytest __tests__/ -v
```

Expected: 全部 PASS（transformer + 预检 + 集成）

- [ ] **Step 5: Commit**

```bash
git add figma-transformer/transform.py figma-transformer/__tests__/
git commit -m "feat(data-pipeline): add transform.py main entry + integration tests + fixtures"
```

---

## Task 5: 补全其余 Transformer 测试

**Files:**
- Create: `figma-transformer/__tests__/fixtures/multi_role_reading/WEN_01_legacy_segments.json`
- Create: `figma-transformer/__tests__/fixtures/multi_role_reading/WEN_05_plugin_object.json`
- Create: `figma-transformer/__tests__/fixtures/level1_quiz/WEN_01_legacy_array.json`
- Create: `figma-transformer/__tests__/fixtures/level1_quiz/WEN_05_plugin_object.json`
- Create: `figma-transformer/__tests__/test_multi_role_reading.py`
- Create: `figma-transformer/__tests__/test_level1_quiz.py`
- Create: `figma-transformer/__tests__/test_text_basic_info.py`

- [ ] **Step 1: 创建 multi_role_reading fixtures**

`figma-transformer/__tests__/fixtures/multi_role_reading/WEN_01_legacy_segments.json`:
```json
{
  "text_id": "WEN_01",
  "audio_file": "WEN_01_multi_role.mp3",
  "segments": [
    {"sentence_index": 1, "time_range": "00:00-00:16", "role_name": "旁白📖", "dialogue": "陈胜者，阳城人也。"},
    {"sentence_index": 2, "time_range": "00:17-00:35", "role_name": "陈胜", "dialogue": "王侯将相，宁有种乎！"}
  ]
}
```

`figma-transformer/__tests__/fixtures/multi_role_reading/WEN_05_plugin_object.json`:
```json
{
  "text_id": "WEN_05",
  "audio_file": "WEN_05_multi_role.mp3",
  "旁白📖": {"sentence_index": 1, "time_range": "00:00-00:16", "dialogue": "陈胜者，阳城人也。"},
  "陈胜": {"sentence_index": 2, "time_range": "00:17-00:35", "dialogue": "王侯将相，宁有种乎！"}
}
```

- [ ] **Step 2: 创建 level1_quiz fixtures**

`figma-transformer/__tests__/fixtures/level1_quiz/WEN_01_legacy_array.json`:
```json
[
  {"text_id": "WEN_01", "question_number": 1, "question_text": "「陈胜」的「胜」读音是？", "option_a": "shèng", "option_b": "shēng", "option_c": "shè", "option_d": "xīng", "correct_answer": "A", "explanation": "shèng 指有名有姓"},
  {"text_id": "WEN_01", "question_number": 2, "question_text": "下列哪个不是《史记》的体例？", "option_a": "本纪", "option_b": "列传", "option_c": "世家", "option_d": "论语", "correct_answer": "D", "explanation": "论语是儒家经典"}
]
```

`figma-transformer/__tests__/fixtures/level1_quiz/WEN_05_plugin_object.json`:
```json
{
  "text_id": "WEN_05",
  "1": {"question_text": "「陈胜」的「胜」读音是？", "option_a": "shèng", "option_b": "shēng", "option_c": "shè", "option_d": "xīng", "correct_answer": "A"},
  "2": {"question_text": "下列哪个不是《史记》的体例？", "option_a": "本纪", "option_b": "列传", "option_c": "世家", "option_d": "论语", "correct_answer": "D"}
}
```

- [ ] **Step 3: 写 test_multi_role_reading.py**

```python
# figma-transformer/__tests__/test_multi_role_reading.py

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from transformers.multi_role_reading import transform


class TestMultiRoleReadingTransform:
    def test_basic_conversion(self):
        raw = {
            "text_id": "WEN_05",
            "audio_file": "WEN_05_multi_role.mp3",
            "旁白📖": {"sentence_index": 1, "time_range": "00:00-00:16", "dialogue": "ABC"},
            "陈胜": {"sentence_index": 2, "time_range": "00:17-00:35", "dialogue": "DEF"},
        }
        result = transform(raw, "WEN_05")

        assert 'segments' in result
        assert isinstance(result['segments'], list)
        assert len(result['segments']) == 2
        # 元数据保留
        assert result['text_id'] == 'WEN_05'
        assert result['audio_file'] == 'WEN_05_multi_role.mp3'
        # segments 里每个项有 role_name
        assert any(s['role_name'] == '旁白📖' and s['sentence_index'] == 1 for s in result['segments'])

    def test_internal_defense_segments_passthrough(self):
        legacy = {"text_id": "WEN_01", "segments": [{"role_name": "旁白📖", "dialogue": "ABC"}]}
        result = transform(legacy, "WEN_01")
        assert result is legacy  # 同一个对象引用

    def test_empty_has_empty_segments(self):
        """只有 text_id，没有角色子 Frame → segments: []"""
        result = transform({"text_id": "WEN_05", "audio_file": "a.mp3"}, "WEN_05")
        assert result['segments'] == []
```

- [ ] **Step 4: 写 test_level1_quiz.py**

```python
# figma-transformer/__tests__/test_level1_quiz.py

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from transformers.level1_quiz import transform


class TestLevel1QuizTransform:
    def test_basic_conversion(self):
        raw = {
            "text_id": "WEN_05",
            "1": {"question_text": "Q1", "option_a": "A", "correct_answer": "A"},
            "2": {"question_text": "Q2", "option_a": "X", "correct_answer": "D"},
        }
        result = transform(raw, "WEN_05")

        assert isinstance(result, list)
        assert len(result) == 2
        # 按 question_number 排序
        assert result[0]['question_number'] == 1
        assert result[1]['question_number'] == 2
        assert result[0]['text_id'] == 'WEN_05'

    def test_internal_defense_array_passthrough(self):
        legacy = [{"text_id": "WEN_01", "question_number": 1, "question_text": "Q1"}]
        result = transform(legacy, "WEN_01")
        assert result is legacy

    def test_non_numeric_key_kept_as_string(self):
        """如果子 Frame 名不是纯数字 → question_number 保留字符串"""
        raw = {"text_id": "WEN_05", "题一": {"question_text": "..."}}
        result = transform(raw, "WEN_05")
        assert result[0]['question_number'] == '题一'
```

- [ ] **Step 5: 写 test_text_basic_info.py**

```python
# figma-transformer/__tests__/test_text_basic_info.py

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from transformers.text_basic_info import transform


class TestTextBasicInfoTransform:
    def test_fills_missing_required_fields(self):
        raw = {"text_id": "WEN_05", "title": "陈涉世家"}
        result = transform(raw, "WEN_05")
        assert result['author'] == ''
        assert result['dynasty'] == ''
        assert result['original_text'] == ''

    def test_fills_missing_text_id_from_wen_id(self):
        raw = {"title": "陈涉世家", "author": "司马迁", "dynasty": "西汉", "original_text": "..."}
        result = transform(raw, "WEN_05")
        assert result['text_id'] == 'WEN_05'

    def test_preserves_existing_fields(self):
        raw = {"text_id": "WEN_05", "title": "陈涉世家", "author": "司马迁", "dynasty": "西汉", "original_text": "...", "bgm": "bgm.mp3"}
        result = transform(raw, "WEN_05")
        assert result['bgm'] == 'bgm.mp3'  # 非必填字段原样保留
```

- [ ] **Step 6: 跑全部测试**

Run:
```bash
cd d:\wenyanplatform\figma-transformer && python -m pytest __tests__/ -v
```

Expected: 全部 PASS

- [ ] **Step 7: Commit**

```bash
git add figma-transformer/__tests__/
git commit -m "test(data-pipeline): complete transformer test coverage for multi_role/level1_quiz/text_basic_info"
```

---

## Task 6: 后端 assetService.js 集成

**Files:**
- Modify: `backend/src/services/assetService.js:283-301`（batchProcessFiles 函数体）

- [ ] **Step 1: 在 batchProcessFiles 里加转换触发**

找到 `batchProcessFiles` 函数（约 283-301 行），在 `processFileUpload` 调用的 `else` 分支（上传成功）之后，加一个"对 data/ 目录 JSON 触发转换"的逻辑：

```javascript
// backend/src/services/assetService.js
// 在 batchProcessFiles 的 for 循环里，"上传成功"的 else 分支后追加：

  } else {
    results.uploaded.push(result)
    // ===== 新增：对 data/ 目录 JSON 自动触发 figma-transformer =====
    if (file.type === 'text' && file.ossPath.startsWith('data/')) {
      try {
        await triggerFigmaTransform(file.ossPath)
      } catch (transformErr) {
        // 转换失败不阻断上传流程，只记录日志
        logger.error(`[AssetService] figma-transformer 转换失败: ${file.ossPath}`, transformErr.message)
      }
    }
    // ===== 新增结束 =====
  }
```

然后在 module.exports 前追加 `triggerFigmaTransform` 函数：

```javascript
/**
 * 调用 figma-transformer Python 脚本对上传后的 data/ JSON 做格式转换。
 * 
 * 转换脚本位置：仓库根目录 figma-transformer/transform.py
 * 运行方式：Python 子进程
 * 
 * 注意：转换是"上传后覆盖"，会把插件上传的对象格式转成前端期望的数组格式。
 * 已是正确格式的文件（01-04 Excel 遗留）会被 is_already_correct 跳过。
 * 
 * @param {string} ossPath - 上传的 OSS 路径，如 data/word_list/WEN_05.json
 */
async function triggerFigmaTransform(ossPath) {
  const { spawn } = require('child_process')
  const { promisify } = require('util')
  const execFile = promisify(require('child_process').execFile)

  const repoRoot = path.resolve(__dirname, '..', '..', '..')  // backend/src/services → 仓库根
  const scriptPath = path.join(repoRoot, 'figma-transformer', 'transform.py')

  logger.info(`[AssetService] 触发 figma-transformer: ${ossPath}`)

  try {
    const pythonCmd = process.env.PYTHON_CMD || 'python3'
    const { stdout, stderr } = await execFile(pythonCmd, [scriptPath, '--path', ossPath], {
      cwd: repoRoot,
      timeout: 30000,  // 30s 超时
      env: { ...process.env },
    })
    logger.info(`[AssetService] figma-transformer stdout: ${stdout.trim()}`)
    if (stderr && stderr.trim()) {
      logger.warn(`[AssetService] figma-transformer stderr: ${stderr.trim()}`)
    }
  } catch (err) {
    logger.error(`[AssetService] figma-transformer 执行异常: ${err.message}`)
    throw err
  }
}
```

同时把 `triggerFigmaTransform` 加到 module.exports：

```javascript
module.exports = {
  computeMd5,
  processFileUpload,
  batchProcessFiles,
  listOssObjects,
  deleteOssObject,
  removeVersionRecord,
  getVersionInfo,
  readVersionFile,
  writeVersionFile,
  VERSION_FILE,
  triggerFigmaTransform,  // 新增，便于单独调用
}
```

- [ ] **Step 2: 跑后端 lint + type check**

Run:
```bash
cd d:\wenyanplatform && npm --prefix backend run lint 2>&1 | head -20
```

Expected: 无语法错误（后端用 JS，lint 只需要通过）

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/assetService.js
git commit -m "feat(data-pipeline): integrate figma-transformer trigger in assetService batchProcessFiles"
```

---

## Task 7: CI 新增 figma-transformer-check job

**Files:**
- Modify: `.github/workflows/ci-checks.yml`

- [ ] **Step 1: 在 ci-checks.yml 末尾追加新 job**

在现有 jobs 列表末尾加：

```yaml
  figma-transformer-check:
    name: Figma Transformer Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install pytest
        run: pip install pytest

      - name: Run transformer tests
        run: |
          cd figma-transformer
          python -m pytest __tests__/ -v --tb=short

      - name: Fail if no tests ran
        run: |
          cd figma-transformer
          count=$(python -m pytest __tests__/ --collect-only -q 2>/dev/null | tail -1 | grep -oP '\d+(?= test)' || echo 0)
          echo "Collected $count tests"
          if [ "$count" -eq 0 ]; then echo "ERROR: No tests collected!"; exit 1; fi
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci-checks.yml
git commit -m "ci: add figma-transformer-check job to CI pipeline"
```

---

## Task 8: 端到端验证（手动测试）

**Files:** 无代码改动，只做验证

- [ ] **Step 1: 手动模拟插件上传场景**

用 fixture 文件模拟：把 `WEN_05_plugin_object.json` 当插件上传的原始 JSON，让 transform.py 处理，验证输出正确。

Run:
```bash
cd d:\wenyanplatform\figma-transformer

# 模拟：创建一个临时目录，放插件对象格式的 JSON
mkdir -p /tmp/test-transform/data/word_list
copy __tests__/fixtures/word_list/WEN_05_plugin_object.json /tmp/test-transform/data/word_list/WEN_05.json

# 运行 transform（--local-data-root 模拟本地 data 目录）
python transform.py --path data/word_list/WEN_05.json --local-data-root /tmp/test-transform

# 验证输出格式
python -c "import json; d=json.load(open('/tmp/test-transform/data/word_list/WEN_05.json')); print(type(d).__name__, len(d)); print(d[0]['word'], d[0]['basic_meaning'])"
```

Expected: `list 2`，然后打印正确的词名和释义

- [ ] **Step 2: 验证 legacy 格式被跳过**

Run:
```bash
# 同上，但用 legacy fixture（数组格式）
copy __tests__/fixtures/word_list/WEN_01_legacy_array.json /tmp/test-transform/data/word_list/WEN_01.json
python transform.py --path data/word_list/WEN_01.json --local-data-root /tmp/test-transform

# 应该打印 "已是正确格式，跳过" 且文件不变
```

Expected: 日志里看到 "已是正确格式，跳过"，文件内容不变

- [ ] **Step 3: 跑全部测试做最终确认**

Run:
```bash
cd d:\wenyanplatform\figma-transformer && python -m pytest __tests__/ -v
```

Expected: 全部 PASS（14-16 tests）

- [ ] **Step 4: 所有改动合并推送**

```bash
git add -A
git commit -m "feat(data-pipeline): complete figma-transformer end-to-end — StepOne 四类 JSON 格式转换"
```

然后按规则推送到 CI 分支并等待 Actions 通过。

---

## Plan Self-Review

**1. Spec 覆盖检查：**
- 问题定义（1.1-1.3）→ Task 1（骨架 + config 含 META_FIELDS + TRANSFORM_MAP + is_already_correct）✅
- 方案选型 Pipeline B → 全文架构一致 ✅
- 架构 3.1 数据流 → Task 6 后端集成完整流程 ✅
- 架构 3.2 文件位置 → Task 1-4 全部路径精确 ✅
- Transformer 4.3-4.6 详细逻辑 → Task 3 四个 transformer + 内部防御 ✅
- 格式预检 4.7 → Task 1 is_already_correct + 内部防御双重 ✅
- 统一分发 4.8 → Task 4 transform.py 完整实现 ✅
- 后端集成 5.1 → Task 6 assetService.js 完整改造 ✅
- 后端白名单 5.2 → spec 明确说不需要改 ✅
- 错误处理 6 → Task 3-4 transformer 防御 + transform.py fallback + 后端 try/catch ✅
- 测试 7 → Task 2 + 4 + 5 三层测试 + fixtures ✅
- 测试运行与 CI 7.6 → Task 7 ci-checks.yml ✅
- 后续扩展 8 → TRANSFORM_MAP 按目录扩展，模式统一 ✅

**2. Placeholder 扫描：**
- 无 TBD/TODO，每个代码块都是完整实现
- 无 "类似 Task N" 引用，所有 transformer 和测试都有完整独立实现
- 每个 step 都有具体命令和期望输出

**3. Type 一致性：**
- transformer 签名统一：`transform(raw, wen_id: str)` → 返回 list 或 dict
- is_already_correct 签名：`(directory: str, data) -> bool`
- transform_file 签名：`(oss_path: str, oss_config: dict | None) -> dict`
- triggerFigmaTransform 签名：`(ossPath: string) -> Promise<void>`

无类型矛盾。
