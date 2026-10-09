#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Detect Python virtualenv
if [ -d "$PROJECT_ROOT/venv" ]; then
    PYTHON="$PROJECT_ROOT/venv/bin/python3"
    CELERY="$PROJECT_ROOT/venv/bin/celery"
else
    PYTHON="$(command -v python3)"
    CELERY="$(command -v celery)"
fi

echo "============================================================"
echo " Jungle Bet: YOLOv8-Tuned Celery Worker Launcher"
echo "============================================================"

# Automatic Concurrency and Hardware Detection
HW_INFO=$($PYTHON -c "
import os, sys
try:
    import torch
    has_gpu = torch.cuda.is_available()
    gpu_count = torch.cuda.device_count() if has_gpu else 0
except Exception:
    has_gpu = False
    gpu_count = 0

cpu_count = os.cpu_count() or 1

if has_gpu and gpu_count > 0:
    # GPU tuning: limit concurrency to prevent CUDA VRAM OOM
    concurrency = max(1, gpu_count * 2)
    mode = f'GPU ({gpu_count} device(s))'
else:
    # CPU tuning: balance PyTorch intra-op threads and OpenCV decoders
    concurrency = max(1, cpu_count // 2)
    mode = f'CPU ({cpu_count} core(s))'

omp_threads = max(1, cpu_count // concurrency)
print(f'{concurrency} {omp_threads} {mode}')
")

CONCURRENCY=$(echo "$HW_INFO" | awk '{print $1}')
OMP_THREADS=$(echo "$HW_INFO" | awk '{print $2}')
MODE=$(echo "$HW_INFO" | cut -d' ' -f3-)

echo "Hardware Mode Detected: $MODE"
echo "Calculated Optimal Concurrency: $CONCURRENCY"
echo "Tuning PyTorch/OpenMP Threads: OMP_NUM_THREADS=$OMP_THREADS"

export OMP_NUM_THREADS="$OMP_THREADS"
export MKL_NUM_THREADS="$OMP_THREADS"
export OPENBLAS_NUM_THREADS="$OMP_THREADS"
export VECLIB_MAXIMUM_THREADS="$OMP_THREADS"
export NUMEXPR_NUM_THREADS="$OMP_THREADS"

echo "Tuning Settings:"
echo "  - Optimization: Fair dispatch (-O fair)"
echo "  - Max tasks per child: 50 (prevents OpenCV/PyTorch memory bloat)"
echo "  - Prefetch multiplier: 1 (fair load distribution for video processing)"
echo "  - Log level: INFO"
echo "============================================================"

exec $CELERY -A tasks worker \
    --loglevel=info \
    --concurrency="$CONCURRENCY" \
    -O fair \
    --max-tasks-per-child=50 \
    --prefetch-multiplier=1
