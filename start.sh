#!/usr/bin/env bash
# ClaudeBridge launcher — Linux / macOS
set -e

export ANTHROPIC_BASE_URL="https://api.oneprovider.dev"
export ANTHROPIC_API_KEY="sk-5fc31868f0fe5418836c246ab599c60268689e7795606f5ff45a9cf1f1341e97"
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Prefer python3, fall back to python
PYTHON=$(command -v python3 2>/dev/null || command -v python 2>/dev/null)
if [ -z "$PYTHON" ]; then
  echo "Error: Python no encontrado. Instala Python 3.10+" >&2
  exit 1
fi

# Install / upgrade dependencies silently if pip is available
if command -v pip3 &>/dev/null; then
  pip3 install -q -r requirements.txt
elif command -v pip &>/dev/null; then
  pip install -q -r requirements.txt
fi

exec "$PYTHON" app.py "$@"
