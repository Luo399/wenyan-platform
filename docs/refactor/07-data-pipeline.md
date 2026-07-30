# 07 - 数据管道优化（P2）

> 返回 [README.md](file:///e:/cpp_discipline/wenyan-platform/docs/refactor/README.md)

> **专题状态**：已完成（7/7）。所有问题在分支 `trae/agent-07-data-pipeline` 修复，CI 通过后合并到 `feature-1`。

---

## P01. data-pipeline 测试未在 CI 运行
- **优先级**: P2
- **状态**: [x] 已完成
- **文件**: `.github/workflows/ci-checks.yml`
- **问题描述**: `data-pipeline/python/data_processor/` 下有 `test_*.py`，但 CI 无 Python job，数据管道无回归保护
- **修复方案**: 在 ci-checks.yml 新增 `pipeline-test` job：Setup Python 3.11 → `pip install -e data-pipeline/python[test]`（含 pytest）→ `cd data-pipeline/python && pytest -v`
- **验证方式**: CI 中 `pipeline-test` job 出现且通过
- **分支建议**: `refactor/pipeline-01`
- **依赖**: 06-engineering-config.md E02

## P02. generate_all_json.py 使用相对路径
- **优先级**: P2
- **状态**: [x] 已完成（代码早已修复，本次仅同步文档状态）
- **文件**: `data-pipeline/python/generate_all_json.py`
- **问题描述**: 原实现 `EXCEL_FILE = '../source/开发需求填写.dbt.xlsx'` 依赖 cwd
- **修复方案**: 已改为基于 `__file__` 计算绝对路径（`_SCRIPT_DIR` / `_PIPELINE_ROOT`，第 24-31 行）
- **验证方式**: 从任意目录执行 `python generate_all_json.py` 成功
- **分支建议**: `refactor/pipeline-02`
- **依赖**: 无

## P03. generate_all_json.py 与 main.py 功能重叠
- **优先级**: P2
- **状态**: [x] 已完成（架构目标已达成，本次仅同步文档状态）
- **文件**:
  - `data-pipeline/python/generate_all_json.py`（转换层唯一事实源）
  - `data-pipeline/python/data_processor/main.py`（协调层，调用 generate_all_json.main）
- **问题描述**: 两个入口都做 Excel->JSON 转换，两套并行实现
- **修复方案**: `data_processor/main.py` 的 `_cmd_run` 已委托调用 `generate_all_json.main(excel_file=..., public_data_dir=...)`，不再重复实现转换
- **验证方式**: `generate_all_json.py` 作为转换层唯一事实源，`data_processor/main.py` 仅做协调
- **分支建议**: `refactor/pipeline-03`
- **依赖**: P02

## P04. config.py 重复代码（transform_correct_index / transform_correct_answer）
- **优先级**: P2
- **状态**: [x] 已完成
- **文件**: `data-pipeline/python/data_processor/config.py`
- **问题描述**:
  1. `transform_correct_index` 与 `transform_correct_answer` 逻辑重复（A/B/C/D 映射）
  2. `post_process_quiz` 与 `post_process_level2_quiz` 高度重复
  3. 直接修改入参 `data`，有副作用风险
- **修复方案**:
  1. 提取 `ANSWER_TO_INDEX` 映射表 + `map_answer_to_index(answer)` 公共函数，`transform_correct_index` 委托之
  2. 提取 `post_process_quiz_generic(data, field_order)` 通用函数 + `LEVEL1_QUIZ_FIELD_ORDER` / `LEVEL2_QUIZ_FIELD_ORDER` 常量
  3. `post_process_quiz_generic` 内部 `data = dict(data)` 复制入参，杜绝副作用
  4. 补充 `TestMapAnswerToIndex` / `TestPostProcessSideEffects` / `TestPostProcessQuizGeneric` 测试
- **验证方式**: 单元测试通过；副作用测试验证入参不被修改
- **分支建议**: `refactor/pipeline-04`
- **依赖**: 无

## P05. main.py 手动修改 sys.path
- **优先级**: P2
- **状态**: [x] 已完成
- **文件**: `data-pipeline/python/data_processor/main.py`
- **问题描述**: `sys.path.append` 手动修改路径
- **修复方案**:
  1. 创建 `data-pipeline/python/pyproject.toml` 声明包结构（`data_processor` / `utils` / `transformers`）与 `generate_all_json` 顶层模块
  2. 移除 `main.py` 的 `sys.path.append(_PYTHON_DIR)`，保留 `_SCRIPT_DIR` / `_PYTHON_DIR` 仅用于 `_resolve_paths` 路径解析
  3. 通过 `pip install -e data-pipeline/python` 安装为包
  4. pyproject.toml 配置 `[tool.pytest.ini_options] pythonpath = ["."]`，pytest 无需 sys.path hack 即可收集测试
- **验证方式**: `python -m data_processor.main` 无需 sys.path 修改
- **分支建议**: `refactor/pipeline-05`
- **依赖**: 无

## P06. 缺少 requirements.txt / pyproject.toml
- **优先级**: P2
- **状态**: [x] 已完成
- **文件**: `data-pipeline/python/pyproject.toml`（新建）
- **问题描述**: `openpyxl` 等依赖未记录
- **修复方案**:
  1. 创建 `data-pipeline/python/pyproject.toml`，声明 `openpyxl>=3.1.0` 为运行依赖、`pytest>=7.0` 为 `[test]` 可选依赖
  2. 更新 `data-pipeline/README.md` 安装说明为 `pip install -e data-pipeline/python`
  3. CI 的 `pipeline-test` job 通过 `pip install -e "data-pipeline/python[test]"` 一步安装依赖
- **验证方式**: `pip install -e data-pipeline/python` 后所有测试通过
- **分支建议**: `refactor/pipeline-06`
- **依赖**: P05

## P07. JSON 数据嵌入绝对路径
- **优先级**: P2
- **状态**: [x] 已完成
- **文件**:
  - `public/data/` 下的 JSON（已无绝对路径，grep 无命中）
  - `data-pipeline/python/data_processor/validators.py`（新增校验）
  - `data-pipeline/python/data_processor/test_validators.py`（新增测试）
- **问题描述**: 项目规则禁止 JSON 中嵌入绝对路径，必须用相对路径或 `VITE_OSS_BASE_URL` 拼接
- **修复方案**:
  1. 审查 `public/data/` 所有 JSON，确认无绝对路径（grep `https?://|^[A-Z]:\\|/home/|/Users/` 无命中）
  2. 在 `validators.py` 新增 `is_absolute_path(value)` + `validate_no_absolute_path(data, fields)`，作为数据管道输出时的最后防线
  3. 补充 `TestIsAbsolutePath` / `TestValidateNoAbsolutePath` 单元测试覆盖 Windows 盘符 / Unix 绝对路径 / http URL / 相对路径 / None 各类场景
- **验证方式**: `grep -r "http.*://" public/data/` 无命中；`validate_no_absolute_path` 单元测试通过
- **分支建议**: `refactor/pipeline-07`
- **依赖**: P03
