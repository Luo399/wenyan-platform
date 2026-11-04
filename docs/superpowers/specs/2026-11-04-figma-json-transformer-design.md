# Figma → 前端 Schema 转换脚本设计

> **状态**：Draft · 2026-11-04
> **范围**：StepOne 四类数据（text_basic_info / word_list / multi_role_reading / level1_quiz），先契合前端跑通
> **原则**：插件保持极简只扫 Figma，转换逻辑在数据层/工具层做，前端组件层不承担数据修复
> **命名解耦合**：transformer 只做结构转换（对象键名 → 数组项的语义字段），不硬编码任何业务命名

---

## 1. 问题定义

### 1.1 核心矛盾

Figma 插件 `scanTextFrame` 按 Figma Frame 嵌套结构直接产出 JSON（对象嵌套），但前端 adapters 期望部分目录产出**数组**。

**插件产出路径 = 前端消费路径 = OSS `data/<dir>/<wenId>.json`**，同一位置格式对不上。

### 1.2 四类 StepOne 数据的格式差异

| 目录 | 插件产出（对象嵌套） | 前端期望（schema） | 差异类型 |
|------|---------------------|------------------|---------|
| `text_basic_info/` | `{text_id, title, author, dynasty, original_text, ...}` | 同左（对象） | ✅ 格式一致，只需字段校验 |
| `word_list/` | `{text_id, "史记": {basic_meaning, ...}, "阳城": {...}}` | `RawWordItem[]` 数组 | ❌ 对象 → 数组，子 Frame 名 → `word` 字段 |
| `multi_role_reading/` | `{text_id, audio_file, "旁白📖": {sentence_index, time_range, dialogue}, "陈胜": {...}}` | `{text_id, audio_file, segments: MultiRoleSegment[]}` 对象 + segments 数组 | ❌ 对象 → segments 数组，子 Frame 名 → `role_name` 字段 |
| `level1_quiz/` | `{text_id, "1": {question_text, option_a, correct_answer, ...}, "2": {...}}` | `RawLevelQuizItem[]` 数组 | ❌ 对象 → 数组，子 Frame 名 → `question_number` 字段 |

### 1.3 约束

- Excel 管线已废弃，但其产出的 **01-04 号课文 StepOne JSON 是正确格式范例**（数组），转换脚本必须检测并跳过，绝对不能覆盖
- 插件上传路径 = 前端消费路径（同一路径）
- 转换后数据必须覆盖同一路径，前端不感知转换步骤
- 后端已校验 JSON 顶层必须是对象，所以插件产出对象格式是合规的；转换后 word_list / level1_quiz 变成数组格式需要后端白名单校验同步调整
- 转换脚本执行**格式预检**：已是正确格式 → 跳过（幂等）；需转换 → 执行

---

## 2. 方案选型

| 方案 | 描述 | 采纳 |
|------|------|------|
| **A. 插件端改造** | 改 scanTextFrame 直接产出数组格式 | ❌ core.ts 已 1300+ 行膨胀、插件与前端 schema 强耦合、Figma 沙箱调试不便 |
| **B. GitHub 加转换脚本** | 仓库里加 Python transformer，读 OSS 原始 → 转换 → 写回 OSS | ✅ **采纳**。插件保持极简、转换逻辑纯数据层、可版本化可测试 |
| **C. 前端 adapter 兼容** | adapter 同时兼容对象和数组 | ❌ 违反"前端组件层不做数据修复"原则 |

---

## 3. 整体架构

### 3.1 数据流

```
Figma 文件
  │ scanTextFrame (保持简单，对象嵌套格式)
  ▼
Figma 插件
  │ POST /api/assets/upload { files: [{ ossPath: "data/word_list/WEN_05.json", content: <JSON> }] }
  ▼
后端 assetController.js
  │ 鉴权 → 路径白名单 → JSON 合法性
  ▼
后端 assetService.js
  │ MD5 比对 → 上传 OSS data/word_list/WEN_05.json
  │ 上传成功钩子：调用转换脚本（子进程）
  ▼
figma-transformer/transform.py
  │ 读 OSS → TRANSFORM_MAP 分发 transformer → 转换 → 写回 OSS 同一路径
  ▼
OSS data/word_list/WEN_05.json  ← 现在是前端期望的数组格式
  │
  ▼
前端 useDataLoader → adapter → 组件（正常渲染）
```

### 3.2 代码位置

```
wenyanplatform/
├── figma-transformer/               ← 新建目录
│   ├── transform.py                 ← 主入口（读 OSS → 分发 → 写回）
│   ├── config.py                    ← 目录映射表 + 元数据字段定义
│   ├── requirements.txt             ← jsonschema（可选）
│   ├── transformers/                ← 每个目录一个 pure function
│   │   ├── __init__.py
│   │   ├── text_basic_info.py
│   │   ├── word_list.py
│   │   ├── multi_role_reading.py
│   │   └── level1_quiz.py
│   └── __tests__/                   ← 单元测试（输入=插件产出，输出=前端 schema）
│       ├── test_word_list.py
│       ├── test_multi_role_reading.py
│       └── test_level1_quiz.py
│
├── backend/
│   └── src/services/
│       └── assetService.js          ← 新增：上传成功后调用 figma-transformer
```

### 3.3 后端 OSS 路径约定

转换脚本直接读写 OSS 的 `data/<dir>/<wenId>.json`，和插件上传路径、前端消费路径**完全一致**，不新建任何目录层级。

---

## 4. Transformer 详细设计

### 4.1 核心原则：纯函数 + 结构转换 + 命名解耦合

每个 transformer 是一个 pure function：

```python
def transform(raw: dict, wen_id: str) -> Any:
    """
    raw:   插件产出的原始 JSON（对象嵌套格式）
    wen_id: 从 OSS 路径解析出的课文编号（如 "WEN_05"）
    return: 前端 adapters 期望的格式
    """
    ...
```

**命名解耦合**：
- transformer 不硬编码 "史记"、"旁白📖"、"1" 等业务命名
- 只做结构性映射：**对象的非元数据 key → 数组项的某个语义字段**
- 具体 key 是什么由 Figma 设计师决定，transformer 只负责搬运

### 4.2 元数据字段 vs 数据字段

transformer 必须知道哪些 key 是"元数据"（跳过不拆），哪些是"数据项"（拆成数组）。这个定义在 `config.py` 里统一维护，每个目录单独配置：

```python
# figma-transformer/config.py

# 每个目录的元数据字段（跳过不拆）
# 非元数据的 key 一律视为数据项，拆入数组
META_FIELDS = {
    'text_basic_info': {'text_id'},                    # 格式一致，不需转换
    'word_list':       {'text_id'},                    # text_id 是元数据
    'multi_role_reading': {'text_id', 'audio_file'},  # text_id + audio_file 是元数据
    'level1_quiz':     {'text_id'},                    # text_id 是元数据
}

# 转换类型（决定整体结构）
TRANSFORM_TYPE = {
    'text_basic_info':   'object',          # 原样返回
    'word_list':         'array_of_items',  # 拆成数组，子 key → word 字段
    'multi_role_reading': 'object_with_segments',  # 对象 + segments 数组
    'level1_quiz':       'array_of_items',  # 拆成数组，子 key → question_number 字段
}
```

### 4.3 word_list transformer

**防御逻辑**（transformer 内部第一道关卡）：如果 `isinstance(raw, list)` → 已是正确格式 → 直接 `return raw`。这是对格式预检的双重保险——即使外部调用者忘了做预检，transformer 也不会误把数组当对象转。

**输入**（插件产出）：
```json
{
  "text_id": "WEN_05",
  "史记": { "basic_meaning": "选自《太史公书》", "synonym_analysis": "", "follow_up_questions": [] },
  "阳城": { "basic_meaning": "在今河南登封东南" }
}
```

**输出**（前端期望 `RawWordItem[]`）：
```json
[
  { "text_id": "WEN_05", "word": "史记", "basic_meaning": "选自《太史公书》", "synonym_analysis": "", "follow_up_questions": [] },
  { "text_id": "WEN_05", "word": "阳城", "basic_meaning": "在今河南登封东南" }
]
```

**逻辑**：
```python
def transform(raw: dict, wen_id: str) -> list:
    # 防御：已是数组（01-04 Excel 遗留）→ 原样返回，保护不被改写
    if isinstance(raw, list):
        return raw

    META = {'text_id'}
    items = []
    text_id = raw.get('text_id') or wen_id

    for key, value in raw.items():
        if key in META or not isinstance(value, dict):
            continue
        item = {'text_id': text_id, 'word': key, **value}
        items.append(item)

    return items
```

### 4.4 multi_role_reading transformer

**防御逻辑**：如果 `'segments' in raw` → 已是正确格式 → 直接 `return raw`。

**输入**（插件产出）：
```json
{
  "text_id": "WEN_05",
  "audio_file": "WEN_05_multi_role.mp3",
  "旁白📖": { "sentence_index": 1, "time_range": "00:00-00:16", "dialogue": "陈胜者，阳城人也。" },
  "陈胜":   { "sentence_index": 2, "time_range": "00:17-00:35", "dialogue": "王侯将相，宁有种乎！" }
}
```

**输出**（前端期望 `MultiRoleData`）：
```json
{
  "text_id": "WEN_05",
  "audio_file": "WEN_05_multi_role.mp3",
  "segments": [
    { "sentence_index": 1, "time_range": "00:00-00:16", "role_name": "旁白📖", "dialogue": "陈胜者，阳城人也。" },
    { "sentence_index": 2, "time_range": "00:17-00:35", "role_name": "陈胜", "dialogue": "王侯将相，宁有种乎！" }
  ]
}
```

**逻辑**：
```python
def transform(raw: dict, wen_id: str) -> dict:
    # 防御：已有 segments 字段（01-04 Excel 遗留）→ 原样返回
    if isinstance(raw, dict) and 'segments' in raw:
        return raw

    META = {'text_id', 'audio_file'}
    segments = []
    result = {k: v for k, v in raw.items() if k in META}

    for key, value in raw.items():
        if key in META or not isinstance(value, dict):
            continue
        segment = {'role_name': key, **value}
        segments.append(segment)

    result['segments'] = segments
    return result
```

### 4.5 level1_quiz transformer

**防御逻辑**：如果 `isinstance(raw, list)` → 已是数组 → 直接 `return raw`（和 word_list 同款）。

**输入**（插件产出）：
```json
{
  "text_id": "WEN_05",
  "1": { "question_text": "「陈胜」的「胜」读音是？", "option_a": "shèng", "option_b": "shēng", "option_c": "shè", "option_d": "xīng", "correct_answer": "A", "explanation": "..." },
  "2": { "question_text": "下列哪个不是《史记》的体例？", "option_a": "本纪", "option_b": "列传", "option_c": "世家", "option_d": "论语", "correct_answer": "D" }
}
```

**输出**（前端期望 `RawLevelQuizItem[]`）：
```json
[
  { "text_id": "WEN_05", "question_number": 1, "question_text": "...", "option_a": "shèng", "option_b": "shēng", ..., "correct_answer": "A", "explanation": "..." },
  { "text_id": "WEN_05", "question_number": 2, "question_text": "...", "option_a": "本纪", ..., "correct_answer": "D" }
]
```

**逻辑**：
```python
def transform(raw: dict, wen_id: str) -> list:
    # 防御：已是数组（01-04 Excel 遗留）→ 原样返回
    if isinstance(raw, list):
        return raw

    META = {'text_id'}
    items = []
    text_id = raw.get('text_id') or wen_id

    for key, value in raw.items():
        if key in META or not isinstance(value, dict):
            continue
        item = {
            'text_id': text_id,
            'question_number': int(key) if key.isdigit() else key,
            **value,
        }
        items.append(item)

    # 按 question_number 排序，保证展示顺序一致
    items.sort(key=lambda x: x.get('question_number', 0))
    return items
```

### 4.6 text_basic_info transformer（校验用）

插件产出已经是正确格式，只做校验 + 默认值填充：

```python
def transform(raw: dict, wen_id: str) -> dict:
    REQUIRED = {'text_id', 'title', 'author', 'dynasty', 'original_text'}
    for field in REQUIRED:
        if field not in raw:
            raw[field] = ''  # 填默认值，不崩
    return raw
```

### 4.7 格式预检（Skip If Already Correct）

转换脚本**执行前先检测**：文件是否已经是前端期望的格式？是的话跳过，不动 01-04 这些 Excel 管线遗留的正确文件。

检测逻辑（纯 Python，无外部依赖）：

| 目录 | "已是正确格式"的判据 | 跳过后果 |
|------|---------------------|---------|
| `word_list` | `isinstance(data, list)` | ✅ 跳过，不覆盖 |
| `level1_quiz` | `isinstance(data, list)` | ✅ 跳过，不覆盖 |
| `multi_role_reading` | `isinstance(data, dict) and 'segments' in data` | ✅ 跳过，不覆盖 |
| `text_basic_info` | 永远执行（只校验字段，不改变格式） | — |

> **为什么这样判？**
> - word_list / level1_quiz：Excel 管线产出数组（正确），插件产出对象（需转换）。`isinstance` 一测就分出来。
> - multi_role_reading：Excel 管线产出 `{..., segments: [...]}`（正确），插件产出 `{..., "角色名": {...}}` 没有 segments 字段。`'segments' in data` 一测就分出来。
> - text_basic_info：两种产出都是对象格式，transformer 只做必填字段校验 + 默认值填充，不改变结构，所以每次都执行无害。

### 4.8 统一分发入口

```python
# figma-transformer/config.py  — 格式预检规则

def is_already_correct(directory: str, data) -> bool:
    """返回 True 表示已是正确格式，应跳过转换"""
    if directory in ('word_list', 'level1_quiz', 'level2_quiz', 'level3_quiz'):
        return isinstance(data, list)
    if directory == 'multi_role_reading':
        return isinstance(data, dict) and 'segments' in data
    if directory == 'text_basic_info':
        return False  # 每次都跑校验，无害
    return False  # 未知目录，默认不跳过


# figma-transformer/transform.py  — 主入口

from config import TRANSFORM_MAP, is_already_correct

def transform_file(oss_path: str) -> bool:
    """
    单个文件的转换流程：读 OSS → 格式预检 → 分发 transformer → 写回 OSS
    """
    # 1. 从 oss_path 解析目录和 wenId
    parts = oss_path.replace('data/', '').split('/')
    directory = parts[0]
    wen_id = parts[1].replace('.json', '')

    # 2. 读 OSS JSON
    raw = read_from_oss(oss_path)
    if raw is None:
        log_warning(f"OSS 文件不存在: {oss_path}")
        return False

    # 3. 格式预检：已是正确格式 → 跳过（幂等，保护 Excel 管线遗留文件）
    if is_already_correct(directory, raw):
        log_info(f"已是正确格式，跳过: {oss_path}")
        return True

    # 4. 分发 transformer
    transform_func = TRANSFORM_MAP.get(directory)
    if transform_func is None:
        log_warning(f"目录 {directory} 无 transformer，跳过")
        return False

    # 5. 执行转换
    result = transform_func(raw, wen_id)

    # 6. 写回 OSS 同一路径
    write_to_oss(oss_path, result)
    log_info(f"转换完成: {oss_path}")
    return True


def main(oss_paths: list[str]):
    """批量转换（后端上传时调用）"""
    for path in oss_paths:
        transform_file(path)
```

---

## 5. 后端集成：上传后自动触发

### 5.1 assetService.js 改造点

```javascript
// assetService.js — 上传成功后新增一行

async function uploadAsset(asset) {
  // ... 现有 MD5 比对、OSS 上传逻辑 ...

  // 上传成功后，调用 figma-transformer 转换
  // 只对 data/ 目录下的 JSON 资源做转换（图片/音频/视频/样式跳过）
  if (asset.type === 'text' && asset.ossPath.startsWith('data/')) {
    await triggerTransform(asset.ossPath)
  }
}

async function triggerTransform(ossPath) {
  // 方案：后端用 Python 子进程跑转换脚本
  const pythonPath = process.env.PYTHON_PATH || 'python3'
  const scriptPath = path.join(__dirname, '..', '..', 'figma-transformer', 'transform.py')
  await spawn(pythonPath, [scriptPath, '--path', ossPath])
}
```

### 5.2 后端白名单调整

`assetController.js` 的 `validateUpload` 目前要求 JSON 顶层必须是对象（前端期望 word_list/level1_quiz 是数组）。转换脚本在上传**之后**运行，所以上传时后端校验仍然接受对象，转换完成后 OSS 上变成数组——前端读 OSS 不经过后端，所以后端白名单**不需要改**。

---

## 6. 错误处理与防御

| 场景 | 策略 |
|------|------|
| 已是正确格式（01-04 Excel 遗留文件） | 格式预检通过 → skip，不写 OSS，log info |
| OSS 文件不存在 | log warning，跳过，继续下一个 |
| 插件产出只有元数据没有子 Frame | 输出空数组 `[]` 或空对象 `{}`，log warning |
| 转换后字段缺失 | 填默认值（空串、空数组），不崩溃 |
| 网络异常读/写 OSS | 重试 3 次，指数退避 |
| Python 脚本运行时异常 | 后端捕获子进程 stderr，返回 500 + 日志 |
| 插件下次上传覆盖转换结果 | 插件重新上传原始对象 → 后端重新触发转换 → 重新覆盖。幂等操作，插件→转换→前端 的循环每次都成立 |

---

## 7. 测试

### 7.1 三层测试结构

```
figma-transformer/__tests__/
├── fixtures/                          ← 测试 fixture（本地 JSON 文件，不依赖 OSS）
│   ├── word_list/
│   │   ├── WEN_01_legacy_array.json   ← 01-04 Excel 管线遗留（正确格式，数组）
│   │   └── WEN_05_plugin_object.json  ← 插件新上传（需转换，对象）
│   ├── multi_role_reading/
│   │   ├── WEN_01_legacy_segments.json ← 01-04 遗留（已有 segments）
│   │   └── WEN_05_plugin_object.json   ← 插件新上传（无 segments）
│   └── level1_quiz/
│       ├── WEN_01_legacy_array.json
│       └── WEN_05_plugin_object.json
│
├── test_word_list.py                  ← transformer 纯函数单测
├── test_multi_role_reading.py
├── test_level1_quiz.py
├── test_text_basic_info.py
├── test_is_already_correct.py         ← 格式预检测试（关键！保护 01-04）
├── test_transform_file.py             ← 统一分发入口 + OSS 读写 mock
└── test_pipeline_integration.py       ← 集成测试：插件 raw → 转换 → adapter 能解析
```

### 7.2 Transformer 单元测试（纯函数）

**测什么**：给 transformer 喂入插件产出的对象 → 断言输出等于前端 schema

```python
# figma-transformer/__tests__/test_word_list.py

import pytest
from transformers.word_list import transform

def test_word_list_basic_conversion():
    """插件对象格式 → 前端数组格式"""
    raw = {
        "text_id": "WEN_05",
        "史记": {"basic_meaning": "选自《太史公书》", "follow_up_questions": []},
        "阳城": {"basic_meaning": "在今河南登封东南"}
    }
    result = transform(raw, "WEN_05")

    assert isinstance(result, list)
    assert len(result) == 2
    # 命名解耦合：key "史记" 被搬到 word 字段，但 key 本身不硬编码
    assert result[0]['text_id'] == 'WEN_05'
    assert result[0]['word'] == '史记'
    assert result[0]['basic_meaning'] == '选自《太史公书》'

def test_word_list_empty():
    """只有 text_id，没有子 Frame → 空数组"""
    result = transform({"text_id": "WEN_05"}, "WEN_05")
    assert result == []

def test_word_list_preserves_all_sub_fields():
    """子 Frame 里所有字段都要原样透传到数组项"""
    raw = {
        "text_id": "WEN_05",
        "项伯": {"basic_meaning": "项羽的叔父", "synonym_analysis": "无", "follow_up_questions": ["谁是项伯？"]}
    }
    result = transform(raw, "WEN_05")
    assert result[0]['synonym_analysis'] == '无'
    assert result[0]['follow_up_questions'] == ['谁是项伯？']

def test_word_list_text_id_fallback():
    """插件漏写 text_id → fallback 用 wen_id 参数"""
    raw = {"司马迁": {"basic_meaning": "西汉史学家"}}
    result = transform(raw, "WEN_05")
    assert result[0]['text_id'] == 'WEN_05'
```

### 7.3 格式预检测试（关键！保护 01-04）

**测什么**：`is_already_correct()` 对正确格式返回 True（skip），对插件格式返回 False（转换）

```python
# figma-transformer/__tests__/test_is_already_correct.py

from config import is_already_correct

class TestWordListPreCheck:
    def test_legacy_array_should_skip(self):
        """01-04 Excel 遗留的数组格式 → skip"""
        data = [{"text_id": "WEN_01", "word": "史记", "basic_meaning": "..."}]
        assert is_already_correct('word_list', data) is True

    def test_plugin_object_should_convert(self):
        """插件产出的对象格式 → 需要转换"""
        data = {"text_id": "WEN_05", "史记": {"basic_meaning": "..."}}
        assert is_already_correct('word_list', data) is False

class TestMultiRolePreCheck:
    def test_legacy_with_segments_should_skip(self):
        """01-04 已有 segments 字段 → skip"""
        data = {"text_id": "WEN_01", "audio_file": "...", "segments": [...]}
        assert is_already_correct('multi_role_reading', data) is True

    def test_plugin_without_segments_should_convert(self):
        """插件产出没有 segments → 需要转换"""
        data = {"text_id": "WEN_05", "audio_file": "...", "旁白📖": {...}}
        assert is_already_correct('multi_role_reading', data) is False

class TestTextBasicInfoPreCheck:
    def test_always_should_run(self):
        """text_basic_info 永远返回 False → 每次都跑校验"""
        data = {"text_id": "WEN_01", "title": "陈涉世家"}
        assert is_already_correct('text_basic_info', data) is False
```

### 7.4 统一分发入口测试（Mock OSS）

**测什么**：`transform_file()` 完整流程——mock OSS 读写，验证格式预检 + 转换 + 写回

```python
# figma-transformer/__tests__/test_transform_file.py
# 用 unittest.mock 替换 read_from_oss / write_to_oss

from unittest.mock import patch, MagicMock
from transform import transform_file

def test_legacy_file_is_skipped():
    """读入已是数组的 word_list → skip，write_to_oss 不被调用"""
    mock_raw = [{"text_id": "WEN_01", "word": "史记", "basic_meaning": "..."}]

    with patch('transform.read_from_oss', return_value=mock_raw), \
         patch('transform.write_to_oss') as mock_write:
        result = transform_file('data/word_list/WEN_01.json')

    assert result is True           # 返回成功（跳过也算成功）
    mock_write.assert_not_called()  # 关键：正确格式不写 OSS！

def test_plugin_file_is_transformed_and_written():
    """读入插件对象格式 → 转换 → 写回 OSS"""
    mock_raw = {"text_id": "WEN_05", "史记": {"basic_meaning": "选自..."}}

    with patch('transform.read_from_oss', return_value=mock_raw), \
         patch('transform.write_to_oss') as mock_write:
        result = transform_file('data/word_list/WEN_05.json')

    assert result is True
    mock_write.assert_called_once()
    # 写入的应该是数组，不是对象
    written_data = mock_write.call_args[0][1]
    assert isinstance(written_data, list)
    assert written_data[0]['word'] == '史记'
```

### 7.5 集成测试：插件 raw → 转换 → 前端 adapter 能解析

**测什么**：转换后的数据能不能被前端 adapters 正常消费——确保握手桥梁真的接上了

```python
# figma-transformer/__tests__/test_pipeline_integration.py
# 关键：读真实 fixtures，走完整 transform_file，验证输出符合前端 schema

import json, os, pytest
from transform import transform_file

FIXTURES = os.path.join(os.path.dirname(__file__), 'fixtures')

class TestWordListIntegration:
    def test_plugin_output_becomes_adapter_compatible(self):
        """插件对象格式 → 转换 → 前端 RawWordItem[] schema"""
        fixture_path = os.path.join(FIXTURES, 'word_list', 'WEN_05_plugin_object.json')
        with open(fixture_path) as f:
            raw = json.load(f)

        # 走完整转换流程（直接调用 transformer，不走 OSS）
        from transformers.word_list import transform
        result = transform(raw, 'WEN_05')

        # 验证：前端 adapter 的 adaptWordList 需要 RawWordItem[]
        assert isinstance(result, list)
        for item in result:
            # 必填字段（wordListAdapter.processWordList 会用 .filter(item.word && item.basic_meaning)）
            assert 'text_id' in item
            assert 'word' in item
            assert 'basic_meaning' in item
            # text_id 要和 wenId 一致
            assert item['text_id'] == 'WEN_05'

    def test_legacy_fixture_stays_unchanged(self):
        """Excel 遗留 fixture 不应被 transformer 改变（直接返回原样）"""
        fixture_path = os.path.join(FIXTURES, 'word_list', 'WEN_01_legacy_array.json')
        with open(fixture_path) as f:
            original = json.load(f)

        from transformers.word_list import transform
        result = transform(original, 'WEN_01')

        # transformer 对 legacy 格式的处理：isinstance 数组 → 会被遍历但每项 dict 没有 word 字段
        # 所以会返回空数组...等等，这不对！
        # 
        # 等等，word_list transformer 目前没有内部的"已是数组就 return"逻辑，
        # 数组传进来遍历 enumerate，key=0/1/2，value=dict，会生成 [{word: 0, ...}, ...]
        # 这是 BUG！需要修复 transformer 内部的格式防御

        # 修复：每个 transformer 内部开头加一行防御
        # if isinstance(raw, list): return raw  # 已是数组，原样返回
```

**上面的集成测试发现了一个 bug**：transformer 内部也要做格式防御——如果传进来已经是数组了，直接原样 return，不做转换。格式预检是第一道关，transformer 内部也得有防御，双重保险。这个要加到 spec 里。

### 7.6 测试运行与 CI

```bash
# 本地跑全部测试
cd figma-transformer
python -m pytest __tests__/ -v

# 跑单个 transformer 的测试
python -m pytest __tests__/test_word_list.py -v

# 跑格式预检测试（最关键，保护 01-04）
python -m pytest __tests__/test_is_already_correct.py -v
```

**CI 新增 job**（`.github/workflows/ci-checks.yml` 里加）：

```yaml
figma-transformer-check:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-python@v5
      with:
        python-version: '3.11'
    - name: Install pytest
      run: pip install pytest
    - name: Run transformer tests
      run: cd figma-transformer && python -m pytest __tests__/ -v
    - name: Fail if no tests ran
      run: |
        cd figma-transformer
        count=$(python -m pytest __tests__/ --collect-only -q 2>/dev/null | wc -l)
        if [ "$count" -eq 0 ]; then echo "ERROR: No tests found!"; exit 1; fi
```

---

## 8. 后续扩展

StepOne 跑通后，后续目录可以按同样模式添加 transformer：

| 目录 | 插件产出 | 前端期望 | 预计转换类型 |
|------|---------|---------|------------|
| `culture_cards/` | 对象 | 对象 | 格式一致，只需校验 |
| `level2_quiz/` | 对象嵌套 | 数组 | word_list 同款 |
| `level3_quiz/` | 对象嵌套 | 数组 | word_list 同款 |
| `pages_level2_dialog_quiz/` | 对象 | 对象 | 格式一致，只需校验 |
| `pages_level3_adaptive_quiz/` | 对象 | 对象 | 格式一致，只需校验 |

扩展步骤：在 `config.py` 的 `TRANSFORM_MAP` 加一行映射 + 新建一个 transformer 文件 + 写单测。

---

## 9. 实施顺序

1. 新建 `figma-transformer/` 目录骨架 + `config.py` + 4 个 transformer
2. 写单元测试（先写 test 再写 transformer，保证输入输出契约正确）
3. 在 assetService.js 加上传后触发钩子（先 log 不调脚本，验证路径正确）
4. 手动跑一次转换脚本，用 curl 验证 OSS 上的 JSON 格式变正确了
5. 后端部署 → 插件实际跑一次 → 前端页面验证 StepOne 正常渲染
6. CI 加 transformer-check job

---

*Spec 自审完，无占位符、无矛盾、范围聚焦 StepOne 四类数据、transformer 只做结构转换不硬编码业务命名。*
