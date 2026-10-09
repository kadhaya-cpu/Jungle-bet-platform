#!/usr/bin/env bash
# ==============================================================================
# Jungle Bet - Instant Emergency Rollback Utility
# ==============================================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

COMPOSE_FILE="$PROJECT_ROOT/docker-compose.prod.yml"
STATE_FILE="$PROJECT_ROOT/nginx/active_color.state"
UPSTREAM_CONF="$PROJECT_ROOT/nginx/active_upstream.conf"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${RED}====================================================================${NC}"
echo -e "${RED} Jungle Bet: Emergency Rollback Triggered${NC}"
echo -e "${RED}====================================================================${NC}"

CURRENT_ENV="blue"
if [ -f "$STATE_FILE" ]; then
    CURRENT_ENV="$(tr -d '[:space:]' < "$STATE_FILE")"
fi

if [ "$CURRENT_ENV" = "blue" ]; then
    PREV_ENV="green"
else
    PREV_ENV="blue"
fi

echo -e "Current Active Environment: ${YELLOW}$CURRENT_ENV${NC}"
echo -e "Rolling back to:            ${GREEN}$PREV_ENV${NC}"

# Detect Docker Compose
if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose -f $COMPOSE_FILE"
elif command -v docker-compose >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker-compose -f $COMPOSE_FILE"
else
    DOCKER_COMPOSE="true"
fi

# 1. Restart standby environment if needed
if [ "$DOCKER_COMPOSE" != "true" ]; then
    echo "Starting $PREV_ENV containers..."
    $DOCKER_COMPOSE up -d "backend-$PREV_ENV" "frontend-$PREV_ENV"
fi

# 2. Update upstream config
cat <<EOF > "$UPSTREAM_CONF"
# Emergency Rollback to: $PREV_ENV
upstream active_backend {
    server backend-${PREV_ENV}:8000 max_fails=3 fail_timeout=10s;
    keepalive 32;
}

upstream active_frontend {
    server frontend-${PREV_ENV}:3000 max_fails=3 fail_timeout=10s;
    keepalive 32;
}
EOF

# 3. Reload Nginx
if [ "$DOCKER_COMPOSE" != "true" ]; then
    echo "Reloading Nginx proxy..."
    $DOCKER_COMPOSE exec -T nginx nginx -s reload

    # 4. Stop faulty environment
    echo "Stopping failed $CURRENT_ENV containers..."
    $DOCKER_COMPOSE stop "backend-$CURRENT_ENV" "frontend-$CURRENT_ENV"
fi

# 5. Persist state
echo "$PREV_ENV" > "$STATE_FILE"

echo -e "\n${GREEN}====================================================================${NC}"
echo -e "${GREEN}✅ Emergency Rollback Completed! Active Environment: $PREV_ENV${NC}"
echo -e "${GREEN}====================================================================${NC}"
