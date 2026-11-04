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

    有 bucket → 用 oss2 读
    无 bucket → 从 local_data_root/<oss_path> 读（开发/测试环境 fallback）
    """
    if bucket:
        try:
            import oss2
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

    返回: { status: 'skipped' | 'transformed' | 'error' | 'not_found' | 'no_transformer', oss_path, message? }
    """
    oss_config = oss_config or {}

    # 1. 解析目录和 wenId
    parts = oss_path.replace('data/', '', 1).split('/')
    if len(parts) < 2:
        return {'status': 'error', 'oss_path': oss_path, 'message': f'路径格式错误: {oss_path}'}
    directory = parts[0]
    wen_id = parts[1].replace('.json', '')

    # 2. 分发 transformer（无 transformer 的目录跳过转换）
    transform_func = TRANSFORM_MAP.get(directory)
    if transform_func is None:
        log.info(f'目录 {directory} 无 transformer，跳过转换: {oss_path}')
        return {'status': 'no_transformer', 'oss_path': oss_path}

    # 3. 读 JSON
    raw = read_oss_json(oss_path, **oss_config)
    if raw is None:
        log.warning(f'文件不存在或读取失败: {oss_path}')
        return {'status': 'not_found', 'oss_path': oss_path}

    # 4. 格式预检：已是正确格式 → skip
    if is_already_correct(directory, raw):
        log.info(f'已是正确格式，跳过: {oss_path}')
        return {'status': 'skipped', 'oss_path': oss_path}

    # 5. 执行转换
    try:
        result = transform_func(raw, wen_id)
    except Exception as e:
        log.error(f'转换失败 ({oss_path}): {e}', exc_info=True)
        return {'status': 'error', 'oss_path': oss_path, 'message': str(e)}

    # 6. 写回
    ok = write_oss_json(oss_path, result, **oss_config)
    if not ok:
        return {'status': 'error', 'oss_path': oss_path, 'message': '写入失败'}

    log.info(f'转换完成: {oss_path}')
    return {'status': 'transformed', 'oss_path': oss_path}


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
