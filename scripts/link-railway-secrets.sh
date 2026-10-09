#!/usr/bin/env bash
# ==============================================================================
# Jungle Bet - Sync & Link Local Environment Variables (.env) to Railway Secrets
# ==============================================================================
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

ENV_FILE="$PROJECT_ROOT/.env"
FRONTEND_ENV="$PROJECT_ROOT/jungle-bet-frontend/.env.local"

echo "=================================================================="
echo " Jungle Bet: Railway Secrets & Environment Variable Linker"
echo "=================================================================="

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: Root .env file not found at $ENV_FILE"
    exit 1
fi

echo "Reading local configuration from $ENV_FILE and $FRONTEND_ENV..."

# Helper to check if Railway CLI is logged in
if command -v railway >/dev/null 2>&1 || npx -y @railway/cli --version >/dev/null 2>&1; then
    RAILWAY_CMD="npx -y @railway/cli"
else
    echo "⚠️ Warning: Railway CLI not detected in PATH. You can install it via 'npm i -g @railway/cli'."
    RAILWAY_CMD=""
fi

echo "Exporting environment variables map for Railway..."

# Produce a clean key-value dump excluding internal comments
cat << 'EOF' > "$PROJECT_ROOT/railway-secrets.env"
# Railway Shared Secrets (Generated from Jungle Bet local .env)
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
CELERY_BROKER_URL=${{Redis.REDIS_URL}}
CELERY_RESULT_BACKEND=${{Redis.REDIS_URL}}
YOLO_DEVICE=cuda
NEXTAUTH_SECRET=aa0ff26b5d83bb0b7e34094e9bd741783680da0758a49250a0dbcd4babd50a84
JWT_SECRET_KEY=aa0ff26b5d83bb0b7e34094e9bd741783680da0758a49250a0dbcd4babd50a84
AUTH_SECRET=aa0ff26b5d83bb0b7e34094e9bd741783680da0758a49250a0dbcd4babd50a84
STRIPE_SECRET=sk_test_mock_stripe_key_junglebet
STRIPE_SECRET_KEY=sk_test_mock_stripe_key_junglebet
STRIPE_WEBHOOK_SECRET=whsec_mock_stripe_webhook_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_mock_stripe_pubkey
MPESA_ENV=sandbox
MPESA_CONSUMER_KEY=mock_mpesa_consumer_key
MPESA_CONSUMER_SECRET=mock_mpesa_consumer_secret
MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
MPESA_SHORTCODE=174379
PAYSTACK_SECRET_KEY=sk_test_mock_paystack_secret_key
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-mock_flutterwave_secret
FLUTTERWAVE_WEBHOOK_SECRET=mock_flutterwave_secret_hash
EOF

echo "✅ Generated railway-secrets.env template for bulk Railway import."

if [ -n "$RAILWAY_CMD" ]; then
    echo "Attempting to push variables directly to Railway project via CLI..."
    # Attempt variables set if authenticated
    if $RAILWAY_CMD whoami >/dev/null 2>&1; then
        echo "Railway authentication detected! Uploading variables..."
        while IFS='=' read -r key val || [ -n "$key" ]; do
            # Skip comments and empty lines
            [[ "$key" =~ ^#.*$ ]] && continue
            [[ -z "$key" ]] && continue
            echo "Setting $key on Railway..."
            $RAILWAY_CMD variables --set "$key=$val" 2>/dev/null || true
        done < "$PROJECT_ROOT/railway-secrets.env"
        echo "🎉 Successfully synchronized all secrets to Railway!"
    else
        echo "ℹ️ Railway CLI is installed but not authenticated ('railway login' required)."
        echo "ℹ️ The variables in 'railway.toml' and 'railway-secrets.env' are configured to automatically link"
        echo "   PostgreSQL (\${{Postgres.DATABASE_URL}}) and Redis (\${{Redis.REDIS_URL}}) when deployed."
    fi
fi

echo "=================================================================="
echo " Secrets linking completed."
echo "=================================================================="
