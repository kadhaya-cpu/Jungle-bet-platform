#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Detect Python virtualenv
if [ -d "$PROJECT_ROOT/venv" ]; then
    UVICORN="$PROJECT_ROOT/venv/bin/uvicorn"
else
    UVICORN="$(command -v uvicorn)"
fi

echo "============================================================"
echo " RUSH HOUR BET: FastAPI Backend Launcher"
echo "============================================================"
echo "Starting FastAPI on port 8000 with auto-reload..."

exec $UVICORN main:app --reload --host 0.0.0.0 --port 8000
