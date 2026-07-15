#!/usr/bin/env bash
set -euo pipefail

REPO="Luo399/wenyan-platform"
LOG_FILE="/workspace/pr_actions_monitor.log"

echo "=== $(date '+%Y-%m-%d %H:%M:%S') 检查 PR Actions ===" | tee -a "$LOG_FILE"

# 检查 gh CLI 是否已认证
GH_AUTH_STATUS=$(gh auth status 2>&1 || true)
if echo "$GH_AUTH_STATUS" | grep -q "not logged in\|To use GitHub CLI in automation"; then
    echo "错误: gh CLI 未认证，请设置 GH_TOKEN 环境变量或运行 gh auth login。" | tee -a "$LOG_FILE"
    echo "认证状态: $GH_AUTH_STATUS" | tee -a "$LOG_FILE"
    exit 1
fi

# 获取最近的 open PR
PR_JSON=$(gh pr list --repo "$REPO" --state open --limit 1 --json number,headRefName,title || true)
if [ -z "$PR_JSON" ] || [ "$PR_JSON" = "[]" ]; then
    echo "当前没有未合并的 PR。" | tee -a "$LOG_FILE"
    exit 0
fi

PR_NUMBER=$(echo "$PR_JSON" | jq -r '.[0].number')
PR_BRANCH=$(echo "$PR_JSON" | jq -r '.[0].headRefName')
PR_TITLE=$(echo "$PR_JSON" | jq -r '.[0].title')

echo "PR: #$PR_NUMBER - $PR_TITLE (分支: $PR_BRANCH)" | tee -a "$LOG_FILE"

# 获取 checks 状态
CHECKS_OUTPUT=$(gh pr checks "$PR_NUMBER" --repo "$REPO" 2>&1 || true)

if echo "$CHECKS_OUTPUT" | grep -q "All checks were successful"; then
    echo "状态: 全部通过" | tee -a "$LOG_FILE"
    exit 0
fi

if echo "$CHECKS_OUTPUT" | grep -q "Some checks were not successful"; then
    echo "状态: 存在失败" | tee -a "$LOG_FILE"

    # 获取失败的具体 checks
    FAILED_CHECKS=$(echo "$CHECKS_OUTPUT" | grep -E "fail|failure" || true)
    echo "失败的 Checks:" | tee -a "$LOG_FILE"
    echo "$FAILED_CHECKS" | tee -a "$LOG_FILE"

    # 尝试获取失败日志
    RUN_IDS=$(gh run list --repo "$REPO" --branch "$PR_BRANCH" --limit 5 --json databaseId,status,conclusion -q '.[] | select(.conclusion == "failure") | .databaseId' || true)

    if [ -n "$RUN_IDS" ]; then
        for RUN_ID in $RUN_IDS; do
            echo "--- Run #$RUN_ID 失败日志 ---" | tee -a "$LOG_FILE"
            gh run view "$RUN_ID" --repo "$REPO" --log-failed 2>&1 | tee -a "$LOG_FILE" || true
        done
    else
        echo "未能获取到失败的 run ID。" | tee -a "$LOG_FILE"
    fi
else
    echo "状态: 仍在运行中" | tee -a "$LOG_FILE"
fi

echo "" | tee -a "$LOG_FILE"
