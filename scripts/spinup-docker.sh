#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "============================================================"
echo " RUSH HOUR BET: Local PostgreSQL & Redis Dependency Manager"
echo "============================================================"

# Check if docker is installed
if command -v docker >/dev/null 2>&1; then
    echo "🐳 Docker detected. Spinning up PostgreSQL and Redis in detached containers..."
    
    # Check if docker compose or docker-compose is available
    if docker compose version >/dev/null 2>&1; then
        DOCKER_COMPOSE="docker compose"
    elif command -v docker-compose >/dev/null 2>&1; then
        DOCKER_COMPOSE="docker-compose"
    else
        echo "❌ Docker Compose not found. Running containers directly..."
        docker run -d --name junglebet-postgres -p 5432:5432 \
          -e POSTGRES_USER=trafficuser \
          -e POSTGRES_PASSWORD=mypassword \
          -e POSTGRES_DB=trafficracer_db \
          -v junglebet_postgres_data:/var/lib/postgresql/data \
          postgres:16-alpine || true
          
        docker run -d --name junglebet-redis -p 6379:6379 \
          -v junglebet_redis_data:/data \
          redis:7-alpine redis-server --appendonly yes || true
        DOCKER_COMPOSE=""
    fi

    if [ -n "$DOCKER_COMPOSE" ]; then
        $DOCKER_COMPOSE -f "$PROJECT_ROOT/docker-compose.yml" up -d postgres redis
    fi
else
    echo "ℹ️  Docker is not installed on this host."
    echo "Checking native local PostgreSQL and Redis services..."
fi

# Verify Redis Connectivity
echo -n "Checking Redis (port 6379)... "
if redis-cli ping >/dev/null 2>&1; then
    echo "✅ Redis is UP and responding (PONG)"
else
    echo "⚠️ Redis ping failed. Starting local redis-server..."
    redis-server --daemonize yes 2>/dev/null || true
    sleep 1
    if redis-cli ping >/dev/null 2>&1; then
        echo "✅ Redis started successfully (PONG)"
    else
        echo "❌ Could not reach Redis on localhost:6379"
    fi
fi

# Verify PostgreSQL Connectivity
echo -n "Checking PostgreSQL (port 5432)... "
if pg_isready -h localhost -p 5432 -U trafficuser -d trafficracer_db >/dev/null 2>&1; then
    echo "✅ PostgreSQL is UP and accepting connections"
else
    echo "⚠️ PostgreSQL connection test with pg_isready..."
    if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
        echo "✅ PostgreSQL service is active on port 5432"
    else
        echo "❌ Could not reach PostgreSQL on localhost:5432"
    fi
fi

# Verify Database Tables
echo -n "Verifying database tables... "
TABLE_COUNT=$(PGPASSWORD=mypassword psql -U trafficuser -h localhost -d trafficracer_db -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null | tr -d ' ' || echo "0")
echo "✅ Found $TABLE_COUNT public tables in trafficracer_db"

echo "============================================================"
echo " Dependencies initialization check complete."
echo "============================================================"
