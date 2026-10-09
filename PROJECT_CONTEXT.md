# Jungle Bet — Project Context & System Architecture

**Last Updated**: October 8, 2026  
**Status**: Production-Ready / Live Telemetry Active  
**Stack**: FastAPI (Python 3.12) | Next.js 16 (React 19) | YOLOv8n (PyTorch / CUDA) | PostgreSQL 16 | Redis 7 | Celery 5.4  

---

## 1. System Overview & Core Concept

**Jungle Bet** is a high-frequency real-time sports betting and optical computer vision telemetry platform. Instead of traditional digital RNGs or human sporting events, Jungle Bet allows users to wager on live physical traffic streams across major world transit arteries (Los Angeles I-405, London Chelsea Bridge, Amsterdam A10).

A bright horizontal **Optical Green Line** is superimposed on the camera feed. Computer vision models (YOLOv8) track vehicles in real-time as they cross this line. Wagers are placed on optical prediction markets (e.g. Under 10, Over 13, Exact 7 Star Pick, Exact 20 High), and bets are resolved with sub-second latency as vehicles cross the trigger line.

---

## 2. Technical Stack & Environment

### Backend
- **Framework**: FastAPI 0.115+ (ASGI / Starlette)
- **Runtime**: Python 3.12 with asyncio
- **Database**: PostgreSQL 16 via SQLAlchemy 2.0 (Asyncpg)
- **Task Queue / Workers**: Celery 5.4 backed by Redis 7
- **Computer Vision**: Ultralytics YOLOv8n (`yolov8n.pt`), OpenCV (`cv2`) with FFMPEG hardware acceleration
- **Real-Time Protocol**: WebSockets (`/ws/count`, `/ws/count/{feed_id}`, `/ws/leo-chat`) and Server-Sent Events (SSE for `/fraud-detector-api/stream`)

### Frontend
- **Framework**: Next.js 16.3.8 (React 19.2.8, App Router)
- **Styling**: Tailwind CSS 4, Framer Motion 13
- **State Management**: Zustand 5 with localStorage persistence
- **Authentication**: NextAuth.js v5 (Credentials, Phone OTP, Google, Apple)
- **Icons & UI**: Lucide React, Sonner, React Hot Toast
- **Language**: TypeScript 5.0+

### Database & Caching
- **PostgreSQL**: `trafficracer_db` running on port 5432
  - Core Tables: `users`, `bets`, `transactions`, `camera_feeds`, `fraud_alerts`
- **Redis**: Port 6379 for Celery broker, WebSocket state, and sliding-window rate tracking

---

## 3. High-Level Architecture Diagram

```
                             +------------------------+
                             |   Live Traffic Feeds   |
                             |  (RTSP / HLS / MP4)    |
                             +-----------+------------+
                                         |
                                         v
                             +------------------------+
                             |  YOLOv8 CV Engine      |
                             |  (traffic_cv.py)       |
                             |  Optical Green Line    |
                             +-----------+------------+
                                         |
                       +-----------------+-----------------+
                       |                                   |
                       v                                   v
          +------------------------+          +------------------------+
          |  FastAPI Backend       |          |  Celery Workers        |
          |  - REST APIs           |          |  - Video Processing    |
          |  - WebSockets /ws/count|          |  - Bet Resolution      |
          |  - Fraud Middleware    |          |  - Autoscaler (1 -> 5) |
          +-----------+------------+          +-----------+------------+
                      |                                   |
                      +-----------------+-----------------+
                                        |
                 +----------------------+----------------------+
                 |                                             |
                 v                                             v
    +------------------------+                    +------------------------+
    |   Next.js Frontend     |                    |   PostgreSQL & Redis   |
    |   - GameBoard (Live)   |                    |   - Users & Balances   |
    |   - Admin Dashboard    |                    |   - Bets & Audit Log   |
    |   - Leo AI Chat        |                    |   - Fraud Alerts       |
    +------------------------+                    +------------------------+
```

---

## 4. Optical Prediction Markets & Odds Structure

Users can place wagers across four core optical prediction markets per camera round:

| Market Key | Market Title | Rule / Target | Odds Multiplier | Tier Description |
|---|---|---|---|---|
| `under_10` | **UNDER 10** | `< 10` vehicles cross Green Line | **2.25x** | Conservative flow tier |
| `over_13` | **OVER 13** | `>= 14` vehicles cross Green Line | **3.60x** | High-velocity rush tier (HOT) |
| `star_pick`| **STAR PICK** | Exactly `7` vehicles cross Green Line | **18.0x** | Mid-range precision jackpot |
| `exact_20` | **EXACT HIGH**| Exactly `20` vehicles cross Green Line | **36.0x** | Mega precision jackpot |

### Supported Currencies & Auto Geo-Detection
- **USD ($)**: Base currency
- **UGX (USh)**: Uganda Shilling (Fixed rate: $1 = UGX 3,750)
- **KES (KSh)**: Kenya Shilling (Fixed rate: $1 = KES 130)
- **NGN (₦)**: Nigerian Naira (Fixed rate: $1 = NGN 1,500)
- **GBP (£)**: British Pound (Fixed rate: $1 = £0.79)
- **EUR (€)**: Euro (Fixed rate: $1 = €0.92)

---

## 5. Real-Time WebSockets & Counter Synchronization

### `/ws/count` and `/ws/count/{feed_id}`
- **Purpose**: Provides sub-second vehicle crossing events and live optical counts directly to `GameBoard.tsx`.
- **Payload Schema**:
  ```json
  {
    "type": "CAR_DETECTED",
    "feed_id": 1,
    "count": 15,
    "crossing_x": 48.2,
    "vehicle_type": "car",
    "confidence": 0.94,
    "timestamp": 1791464000.12
  }
  ```
- **Heartbeat**: Ping/Pong protocol every 20 seconds.
- **Frontend Hook**: `useWebSocketCount(feedId)` binds incoming counts, triggers the optical laser sweep animation, spawns floating `+1` indicators at the exact `crossing_x` coordinate, and synchronizes market target progress.

---

## 6. Fraud Detection & Security Architecture

### Rules & Thresholds
1. **High-Frequency Betting Anomaly**:
   - Triggers if a user places **more than 10 bets within a 60-second sliding window**.
   - Severity: **HIGH**
   - Action: User account is automatically marked `is_flagged = True`, security alert is logged in PostgreSQL, and alert is broadcast in real-time via SSE and WebSocket.
2. **Instant Large Win Anomaly**:
   - Triggers if a user wins **more than $1,000.00 instantly** on a single bet resolution.
   - Severity: **CRITICAL**
   - Action: Flagged immediately for administrative audit.
3. **Automated Enforcement**:
   - `FraudDetectionMiddleware` checks incoming requests for banned users.
   - Any request from a banned user returns **403 Forbidden** with `{"isBanned": true}`.

### Admin Dashboard (`/admin/dashboard`)
- Security Gate Passcode: `jungleadmin2026`
- Real-time Fraud Alerts Stream via SSE (`/fraud-detector-api/stream`)
- Registered Racers Dossier with filter by Clean, Flagged, and Banned
- Immediate **Ban User**, **Unban User**, and **Dismiss Flag** action controls
- Interactive Simulator bar for testing rapid bets (>10/min) and large wins (>$1,000)

---

## 7. Verified Camera Feeds

The system automatically verifies and streams the top 3 live camera junctions:
1. **Feed #1**: `Los Angeles - I-405` (Caltrans I-405 Culver Overpass, USA)
2. **Feed #2**: `London - Chelsea Bridge` (TfL Chelsea Bridge Junction, UK)
3. **Feed #3**: `Amsterdam - A10 / A1` (Rijkswaterstaat A1 Hoevelaken, Netherlands)

---

## 8. Deployment & Autoscaling Topology

- **Docker Production**: `docker-compose.prod.yml` with Blue/Green deployment strategy (`scripts/deploy-bluegreen.sh`).
- **GPU Backend**: `Dockerfile` utilizing `nvidia/cuda:12.1.0-runtime-ubuntu22.04` with PyTorch CUDA acceleration for YOLOv8.
- **Celery Autoscaler**: `scripts/celery_autoscaler.py` dynamically scales Celery worker replicas from 1 to 5 when Redis queue depth exceeds 50 tasks.

---

## 9. Test Suites Directory

| Test File | Scope | Command |
|---|---|---|
| `test_traffic_cv.py` | YOLOv8 model, Centroid Tracker, Celery video processing | `python test_traffic_cv.py` |
| `test_fraud_detection.py` | Backend fraud thresholds, ban/unban, alerts listing | `python test_fraud_detection.py` |
| `test_cameras.py` | Camera RTSP/HLS signal and lane visibility verification | `python test_cameras.py` |
| `scripts/test_infrastructure.py` | Dockerfiles, Compose, Autoscaler, Blue/Green | `python scripts/test_infrastructure.py` |
| `src/lib/__tests__/websocket-count.test.ts` | Frontend `/ws/count` hook and connectivity | `npx tsx src/lib/__tests__/websocket-count.test.ts` |
| `src/lib/__tests__/fraud-and-ai.test.ts` | Fraud hooks, ban action, Leo AI chatbot | `npx tsx src/lib/__tests__/fraud-and-ai.test.ts` |
| `src/lib/__tests__/payment-webhooks-validation.test.ts` | Stripe & M-Pesa webhooks & balance update | `npx tsx src/lib/__tests__/payment-webhooks-validation.test.ts` |
