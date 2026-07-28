# 07 - 数据管道优化（P2）

> 返回 [README.md](file:///e:/cpp_discipline/wenyan-platform/docs/refactor/README.md)

---

## P01. data-pipeline 测试未在 CI 运行
- **优先级**: P2
- **状态**: [ ] 未开始
- **文件**: `.github/workflows/ci-checks.yml`（全文）
- **问题描述**: `data-pipeline/python/data_processor/` 下有 `test_*.py`（test_config.py、test_incremental.py、test_modules.py、test_validators.py、test_version.py），但 CI 无 Python job，数据管道无回归保护
- **修复方案**:
  1. 在 ci-checks.yml 添加 Python job
  2. `cd data-pipeline/python && python -m pytest`
  3. 设置 Python 版本 3.9+
- **验证方式**: CI 中 Python 测试 step 出现且通过
- **分支建议**: `refactor/pipeline-01`
- **依赖**: 06-engineering-config.md E02

## P02. generate_all_json.py 使用相对路径
- **优先级**: P2
- **状态**: [ ] 未开始
- **文件**: `data-pipeline/python/generate_all_json.py`（第 51、99 行）
- **问题描述**: `EXCEL_FILE = '../source/开发需求填写.dbt.xlsx'` 依赖当前工作目录，从其他位置调用必失败。`main.py` 第 37 行已正确使用 `__file__` 计算绝对路径
- **修复方案**: 改为基于 `__file__` 计算绝对路径
  ```python
  BASE_DIR = Path(__file__).resolve().parent
  EXCEL_FILE = BASE_DIR / '..' / 'source' / '开发需求填写.dbt.xlsx'
  ```
- **验证方式**: 从任意目录执行 `python generate_all_json.py` 成功
- **分支建议**: `refactor/pipeline-02`
- **依赖**: 无

## P03. generate_all_json.py 与 main.py 功能重叠
- **优先级**: P2
- **状态**: [ ] 未开始
- **文件**:
  - `data-pipeline/python/generate_all_json.py`（使用 `transformers/`）
  - `data-pipeline/python/data_processor/main.py`（使用 `data_processor/`）
- **问题描述**: 两个入口都做 Excel->JSON 转换，两套并行实现，维护成本高。README 推荐 `data_processor/main.py`
- **修复方案**: 弃用 `generate_all_json.py`，统一使用 `python -m data_processor.main`
- **验证方式**: `generate_all_json.py` 标记为 deprecated 或删除
- **分支建议**: `refactor/pipeline-03`
- **依赖**: P02

## P04. config.py 重复代码（transform_correct_index / transform_correct_answer）
- **优先级**: P2
- **状态**: [ ] 未开始
- **文件**: `data-pipeline/python/data_processor/config.py`（第 80-113 行、第 134-191 行）
- **问题描述**:
  1. `transform_correct_index` 与 `transform_correct_answer` 逻辑重复（A/B/C/D 映射）
  2. `post_process_quiz` 与 `post_process_level2_quiz` 高度重复
  3. 第 139、173 行直接修改入参 `data`，有副作用风险
- **修复方案**:
  1. 提取 `map_answer_to_index(answer)` 公共函数
  2. 提取 `post_process_quiz_generic(data, prefix)` 通用函数
  3. 修改前先 `data = dict(data)` 复制
- **验证方式**: 单元测试通过；`config.py` 代码量减少 40%
- **分支建议**: `refactor/pipeline-04`
- **依赖**: 无

## P05. main.py 手动修改 sys.path
- **优先级**: P2
- **状态**: [ ] 未开始
- **文件**: `data-pipeline/python/data_processor/main.py`（第 19 行）
- **问题描述**: `sys.path.append` 手动修改路径，应改用 `pyproject.toml` + `pip install -e .` 安装为包
- **修复方案**:
  1. 创建 `pyproject.toml` 声明包结构和依赖
  2. 移除 `sys.path.append`
  3. 通过 `pip install -e .` 安装
- **验证方式**: `python -m data_processor.main` 无需 sys.path 修改
- **分支建议**: `refactor/pipeline-05`
- **依赖**: 无

## P06. 缺少 requirements.txt / pyproject.toml
- **优先级**: P2
- **状态**: [ ] 未开始
- **文件**: `data-pipeline/`（无依赖声明文件）
- **问题描述**: `openpyxl` 等依赖未记录，README 仅文字提示。新开发者无法快速搭建环境
- **修复方案**:
  1. 创建 `data-pipeline/python/requirements.txt` 或 `pyproject.toml`
  2. 锁定依赖版本
  3. 更新 README 安装说明
- **验证方式**: `pip install -r requirements.txt` 后所有测试通过
- **分支建议**: `refactor/pipeline-06`
- **依赖**: P05

## P07. JSON 数据嵌入绝对路径
- **优先级**: P2
- **状态**: [ ] 未开始
- **文件**: `public/data/` 下的 `multi_role_reading`、`word_list`、`text_basic_info` JSON
- **问题描述**: 项目规则禁止 JSON 中嵌入绝对路径，必须用相对路径或 `VITE_OSS_BASE_URL` 拼接
- **修复方案**:
  1. 审查所有 JSON 文件，替换绝对路径为相对路径
  2. 数据管道 `config.py` 输出时校验路径格式
  3. 添加单元测试确保输出不含绝对路径
- **验证方式**: `grep -r "http.*://" public/data/` 无命中（或仅命中允许的 CDN URL）
- **分支建议**: `refactor/pipeline-07`
- **依赖**: P03
