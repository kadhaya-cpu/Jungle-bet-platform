# RUSH HOUR BET — Production Deployment & Setup Guide

Welcome to the official deployment and setup guide for **RUSH HOUR BET**, the global real-time optical traffic prediction and betting platform powered by YOLOv8 Computer Vision, USD-only internal wallet accounting, and the autonomous Smart Feed Agent system.

---

## 1. Architecture Overview

- **Backend API (`main.py`)**: FastAPI 2.0 asynchronous server with SlowAPI rate limiting, Helmet security headers, `CurrencyConversionMiddleware`, `FraudDetectionMiddleware`, and WebSocket/SSE real-time telemetry.
- **Database (`models.py`, `database.py`)**: PostgreSQL 15+ with asyncpg, double-entry ledger (`wallets`, `transactions`), USD-only internal balance enforcement, global camera feed registry (`camera_feeds`), and dynamic FX spread pool (`fx_rates`, `reserve_pool`).
- **Smart Feed Agent (`services/smart_feed_agent.py`)**: Autonomous live camera discovery (YouTube Data API v3, EarthCam API, Municipal DOT traffic APIs), road-traffic content filtering, quality scoring, 30-second health monitoring, `< 2s` emergency failover, load balancing, and local MP4 loop fallback (`/static/fallback_videos/{city}.mp4`).
- **Computer Vision Worker (`tasks.py`, `traffic_cv.py`)**: Celery + Redis distributed worker pool running YOLOv8n vehicle detection and optical tripwire crossing verification.
- **Frontend (`frontend/` & `jungle-bet-frontend/`)**: React 18 / Next.js + Tailwind CSS dark/gold UI with interactive 28+ city global map across Asia, Africa, Americas, Europe, and Oceania.

---

## 2. Prerequisites

- **Python**: 3.11 or 3.12+
- **Node.js**: 18.x or 20.x+
- **PostgreSQL**: 14+ (running locally or managed via Railway/Supabase/RDS)
- **Redis**: 6.x or 7.x+ (for Celery broker, result backend, and rate-limiting state)
- **FFmpeg / libGL**: Required by OpenCV (`opencv-python`) for RTSP/HLS stream ingestion

---

## 3. Environment Configuration

Copy `.env.example` to `.env` in the project root and populate all required secrets:

```bash
cp .env.example .env
```

### Key Environment Variables

| Variable | Description | Example |
| :--- | :--- | :--- |
| `RUSH_HOUR_BET_PLATFORM_NAME` | Platform brand identifier | `RUSH HOUR BET` |
| `RUSH_HOUR_BET_INTERNAL_CURRENCY` | Strictly enforced internal accounting currency | `USD` |
| `DATABASE_URL` / `RUSH_HOUR_BET_DATABASE_URL` | PostgreSQL connection URL | `postgresql://trafficuser:pass@localhost:5432/trafficracer_db` |
| `REDIS_URL` / `RUSH_HOUR_BET_REDIS_URL` | Redis connection URL | `redis://localhost:6379/0` |
| `SECRET_KEY` / `RUSH_HOUR_BET_SECRET_KEY` | Cryptographic secret for JWT signing (must not be default) | `openssl rand -hex 32` |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key for live traffic feed discovery | `AIzaSy...` |
| `EARTHCAM_API_KEY` | EarthCam API key for global highway camera feeds | `ec_live_...` |
| `FALLBACK_VIDEO_PATH` | Directory containing pre-downloaded city traffic MP4 loops | `/static/fallback_videos` |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot token for instant feed failure & treasury alerts | `123456:ABC-DEF...` |
| `TELEGRAM_CHAT_ID` | Admin Telegram chat ID | `-100123456789` |
| `ADMIN_EMAIL` | Operations email for critical feed & compliance alerts | `ops@rushhourbet.io` |

---

## 4. Backend Installation & Startup

### Step 1: Create Virtual Environment & Install Dependencies

```bash
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 2: Verify Fallback Video Library

Ensure all city fallback MP4 loops are present in `/static/fallback_videos/{city}.mp4`:

```bash
ls -lh static/fallback_videos/
```

### Step 3: Start the FastAPI Backend Server

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

On startup, `main.py` automatically:
1. Validates cryptographic environment variables (`validate_security_env()`).
2. Runs database schema migrations and seeds all 22 global FX rates and USD wallet rules (`init_db()`).
3. Launches the **Smart Feed Agent** 30-second background health monitor (`smart_feed_agent.start_background_monitor()`).

### Step 4: Start the Celery Computer Vision Worker

```bash
celery -A celery_app worker --loglevel=info --concurrency=4
```

---

## 5. Frontend Installation & Startup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

For production builds:

```bash
npm run build
npm run preview
```

---

## 6. Global API Verification Checklist

Run these checks after deployment to verify all subsystems:

1. **Health & USD Accounting Check**:
   ```bash
   curl -s http://localhost:8000/health | jq .
   ```
2. **Supported Local Currencies (`GET /api/currencies`)**:
   ```bash
   curl -s http://localhost:8000/api/currencies | jq .
   ```
3. **Withdrawal Payout Preview (`POST /api/withdraw-preview`)**:
   ```bash
   curl -s -X POST http://localhost:8000/api/withdraw-preview \
     -H "Content-Type: application/json" \
     -d '{"amount_usd": 50.0, "currency": "JPY"}' | jq .
   ```
4. **Global Cities Registry (`GET /api/cities`)**:
   ```bash
   curl -s http://localhost:8000/api/cities | jq '.count, .regions'
   ```
5. **Smart Feed Manager (`GET /api/feed-manager`)**:
   ```bash
   curl -s "http://localhost:8000/api/feed-manager?city=Tokyo" | jq .
   ```

---

## 7. Running the Automated Validation Suite

```bash
./venv/bin/python test_rush_hour_bet_transformation.py
./venv/bin/python test_security_enterprise.py
./venv/bin/python test_financial_core.py
./venv/bin/python test_treasury.py
```
