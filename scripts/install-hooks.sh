#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

git config --global --add safe.directory "$REPO_ROOT" 2>/dev/null || true

git config --local alias.push '!f() { command git push "$@" && npm run notify:feishu -- "🏮 代码已推送 ($(git branch --show-current): $(git log -1 --oneline))"; }; f'

echo "Git hooks configured"
echo "  - safe.directory added"
echo "  - git push will notify Feishu"
echo ""
echo "Next: ~/.local/bin/origin auth login"
