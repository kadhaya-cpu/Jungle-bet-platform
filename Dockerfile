# ==============================================================================
# Jungle Bet Backend - Production Dockerfile
# Base: python:3.12-slim (migrated from nvidia/cuda base for lightweight deployment)
# Features: FastAPI, Uvicorn, PyTorch/torch, Ultralytics YOLOv8, OpenCV, Asyncpg
# ==============================================================================

FROM python:3.12-slim

# Labels
LABEL maintainer="Jungle Bet Team"
LABEL description="Production FastAPI backend for Jungle Bet traffic telemetry and sports betting"

# Python runtime and environment flags
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DEBIAN_FRONTEND=noninteractive \
    PORT=8000 \
    YOLO_DEVICE=cpu

# Install system dependencies required for OpenCV headless, FFmpeg video stream processing, and healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root system user and group for production container security
RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -m -s /bin/bash appuser

# Set application working directory
WORKDIR /app

# Copy dependency definition first for optimal layer caching
COPY requirements.txt /app/requirements.txt

# Install Python dependencies (torch, torchvision, fastapi, uvicorn, etc.)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/requirements.txt

# Copy application source code with non-root ownership
COPY --chown=appuser:appgroup . /app

# Prepare writable runtime directories for static video feeds and Ultralytics cache
RUN mkdir -p /app/static/videos /home/appuser/.config/Ultralytics && \
    chown -R appuser:appgroup /app /home/appuser

# Switch to non-root user
USER appuser

# Expose FastAPI application port
EXPOSE 8000

# Container lifecycle health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start Uvicorn ASGI server in production mode
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
