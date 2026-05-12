#!/usr/bin/env bash
# ClaudeBridge launcher — Linux / macOS
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export ANTHROPIC_BASE_URL="https://api.oneprovider.dev"
export ANTHROPIC_API_KEY="sk-5fc31868f0fe5418836c246ab599c60268689e7795606f5ff45a9cf1f1341e97"
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1"

# Auto-activate .venv si existe (recomendado en distros con PEP 668)
if [ -f ".venv/bin/activate" ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

# Prefer python3, fall back to python
PYTHON=$(command -v python3 2>/dev/null || command -v python 2>/dev/null)
if [ -z "$PYTHON" ]; then
  echo "Error: Python no encontrado. Instala Python 3.10+" >&2
  exit 1
fi

# Install deps. Captura PEP 668 y da un mensaje útil.
PIP_ERR=$(mktemp)
if ! "$PYTHON" -m pip install -q -r requirements.txt 2>"$PIP_ERR"; then
  if grep -q "externally-managed-environment" "$PIP_ERR" 2>/dev/null; then
    cat >&2 <<EOF

  ✗ pip rechazó instalar en el sistema (PEP 668).
    Usa un virtualenv:

      python3 -m venv .venv
      source .venv/bin/activate
      pip install -r requirements.txt
      ./start.sh

EOF
    rm -f "$PIP_ERR"
    exit 1
  fi
  echo "  ⚠ pip install falló — intentando arrancar de todas formas..." >&2
  cat "$PIP_ERR" >&2
fi
rm -f "$PIP_ERR"

exec "$PYTHON" app.py "$@"
