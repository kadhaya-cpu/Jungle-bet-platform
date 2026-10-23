#!/usr/bin/env bash
# ==============================================================================
# RUSH HOUR BET - Docker Image Build Pipeline
# Tags:
#   - jungle-bet-backend:latest  (GPU CUDA + YOLOv8 + FastAPI)
#   - jungle-bet-frontend:latest (Next.js 16 Standalone Production)
# ==============================================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${CYAN}====================================================================${NC}"
echo -e "${CYAN} RUSH HOUR BET: Production Docker Image Builder${NC}"
echo -e "${CYAN}====================================================================${NC}"

if ! command -v docker >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker CLI is not installed or not in PATH on this system.${NC}"
    echo -e "${YELLOW}Please install Docker Engine (e.g. 'sudo apt install docker.io') to execute live builds.${NC}"
    exit 1
fi

# 1. Build Backend Image (GPU Enabled)
echo -e "\n${CYAN}📦 [1/2] Building Backend Image: jungle-bet-backend:latest...${NC}"
START_TIME=$(date +%s)

docker build \
    --file "$PROJECT_ROOT/Dockerfile" \
    --tag jungle-bet-backend:latest \
    --progress=plain \
    "$PROJECT_ROOT"

BACKEND_DURATION=$(( $(date +%s) - START_TIME ))
echo -e "${GREEN}✅ Backend image built successfully in ${BACKEND_DURATION}s: jungle-bet-backend:latest${NC}"

# 2. Build Frontend Image (Next.js Standalone)
echo -e "\n${CYAN}📦 [2/2] Building Frontend Image: jungle-bet-frontend:latest...${NC}"
START_TIME=$(date +%s)

docker build \
    --file "$PROJECT_ROOT/jungle-bet-frontend/Dockerfile" \
    --tag jungle-bet-frontend:latest \
    --progress=plain \
    "$PROJECT_ROOT/jungle-bet-frontend"

FRONTEND_DURATION=$(( $(date +%s) - START_TIME ))
echo -e "${GREEN}✅ Frontend image built successfully in ${FRONTEND_DURATION}s: jungle-bet-frontend:latest${NC}"

echo -e "\n${GREEN}====================================================================${NC}"
echo -e "${GREEN}🎉 All Production Images Successfully Built and Tagged!${NC}"
echo -e "  - jungle-bet-backend:latest  (GPU YOLOv8, PyTorch, FastAPI)"
echo -e "  - jungle-bet-frontend:latest (Next.js 16 Standalone)"
echo -e "${GREEN}====================================================================${NC}"
