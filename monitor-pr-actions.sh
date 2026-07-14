#!/usr/bin/env bash
set -euo pipefail

REPO="Luo399/wenyan-platform"
POLL_INTERVAL="${POLL_INTERVAL:-60}"

echo "=== PR Actions 监控启动 ==="
echo "仓库: $REPO"
echo "轮询间隔: ${POLL_INTERVAL}s"
echo ""

# 获取最近的 open PR
PR_JSON=$(gh pr list --repo "$REPO" --state open --limit 1 --json number,headRefName,title || true)
if [ -z "$PR_JSON" ] || [ "$PR_JSON" = "[]" ]; then
    echo "当前没有未合并的 PR，退出。"
    exit 0
fi

PR_NUMBER=$(echo "$PR_JSON" | jq -r '.[0].number')
PR_BRANCH=$(echo "$PR_JSON" | jq -r '.[0].headRefName')
PR_TITLE=$(echo "$PR_JSON" | jq -r '.[0].title')

echo "监控 PR: #$PR_NUMBER - $PR_TITLE"
echo "分支: $PR_BRANCH"
echo ""

while true; do
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

    # 获取 checks 状态
    CHECKS_OUTPUT=$(gh pr checks "$PR_NUMBER" --repo "$REPO" 2>&1 || true)

    if echo "$CHECKS_OUTPUT" | grep -q "All checks were successful"; then
        echo "[$TIMESTAMP] PR #$PR_NUMBER Actions 已全部通过！"
        exit 0
    fi

    if echo "$CHECKS_OUTPUT" | grep -q "Some checks were not successful"; then
        echo "[$TIMESTAMP] PR #$PR_NUMBER Actions 存在失败，正在获取失败日志..."
        echo ""

        # 获取失败的具体 checks
        FAILED_CHECKS=$(echo "$CHECKS_OUTPUT" | grep -E "fail|failure" || true)
        echo "失败的 Checks:"
        echo "$FAILED_CHECKS"
        echo ""

        # 尝试获取失败日志
        RUN_IDS=$(gh run list --repo "$REPO" --branch "$PR_BRANCH" --limit 5 --json databaseId,status,conclusion -q '.[] | select(.conclusion == "failure") | .databaseId')

        if [ -n "$RUN_IDS" ]; then
            for RUN_ID in $RUN_IDS; do
                echo "--- Run #$RUN_ID 失败日志 ---"
                gh run view "$RUN_ID" --repo "$REPO" --log-failed || true
                echo ""
            done
        else
            echo "未能获取到失败的 run ID，可能是 checks 名称不匹配。"
        fi

        echo "[$TIMESTAMP] 失败日志已输出，继续监控下一轮..."
    else
        echo "[$TIMESTAMP] PR #$PR_NUMBER Actions 仍在运行中，等待 ${POLL_INTERVAL}s 后重试..."
    fi

    echo ""
    sleep "$POLL_INTERVAL"
done
