#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== Setup ==="
npm install
bash scripts/install-hooks.sh

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env"
fi
if [ ! -f .cursor/mcp.json ]; then
  cp .cursor/mcp.json.example .cursor/mcp.json
  echo "Created .cursor/mcp.json"
fi

if command -v origin >/dev/null 2>&1; then
  origin auth status || echo "Run: origin auth login"
else
  echo "Install Origin CLI:"
  echo "  curl -fsSL https://downloads.cursor.com/origin/install.sh | sh"
fi

echo ""
echo "Commands:"
echo "  npm run push          # push + Feishu notify"
echo "  npm run watch:chat    # poll group messages"
echo "  npm run dev:ws        # realtime listen"
