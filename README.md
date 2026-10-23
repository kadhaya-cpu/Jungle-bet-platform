# RUSH HOUR BET — Global Real-Time Optical Traffic Betting Platform

**RUSH HOUR BET** is an enterprise-grade, real-time computer-vision traffic prediction and wagering platform. Players watch live highway and urban arterial traffic streams across **29 global cities** on 5 continents and wager on how many vehicles will cross the optical YOLOv8 detection line within a target time window.

---

## Key Platform Capabilities

### 1. Global Map Expansion (29 Cities Across 5 Continents)
- **Asia**: Tokyo 🇯🇵, Shanghai 🇨🇳, Beijing 🇨🇳, Mumbai 🇮🇳, Bangkok 🇹🇭, Singapore 🇸🇬
- **Africa**: Casablanca 🇲🇦, Lagos 🇳🇬, Cairo 🇪🇬, Nairobi 🇰🇪, Johannesburg 🇿🇦
- **Americas**: New York 🇺🇸, Los Angeles 🇺🇸, São Paulo 🇧🇷, Mexico City 🇲🇽, Toronto 🇨🇦
- **Europe**: London 🇬🇧, Paris 🇫🇷, Berlin 🇩🇪, Madrid 🇪🇸, Rome 🇮🇹, Amsterdam 🇳🇱, Vienna 🇦🇹, Prague 🇨🇿, Zurich 🇨🇭, Brussels 🇧🇪
- **Oceania**: Sydney 🇦🇺, Melbourne 🇦🇺, Auckland 🇳🇿
- Every city includes geographic coordinates (`lat`/`long`), IANA `timezone`, ISO `country_code`, and `flag_emoji`.

### 2. USD-Only Internal Accounting & Global Currency System
- **Strict USD Internal Ledger**: All database balances (`users.balance_usd` and `wallets.balance`) are stored and audited strictly in **USD**.
- **22 Supported Local Currencies**: `USD`, `EUR`, `GBP`, `UGX`, `KES`, `TZS`, `NGN`, `JPY`, `CNY`, `INR`, `THB`, `SGD`, `MAD`, `EGP`, `ZAR`, `BRL`, `MXN`, `CAD`, `CHF`, `CZK`, `AUD`, `NZD`.
- **Automatic Conversion Middleware (`CurrencyConversionMiddleware`)**:
  - **Deposits (`POST /deposit`)**: Converts local currency → USD using proprietary FX spread capture before crediting the player's USD wallet.
  - **Withdrawals (`POST /withdraw`)**: Deducts USD from the player's internal balance and converts USD → local currency for payout.
  - **Withdrawal Preview (`POST /api/withdraw-preview`)**: Real-time calculation of local currency payout, custom rate, and spread before submitting a withdrawal.

### 3. Autonomous Smart Feed Agent (`/services/smart_feed_agent.py`)
- **Multi-Source Discovery**: Discovers live streams via YouTube Data API v3, EarthCam API, and municipal DOT traffic camera feeds.
- **Traffic Content Filtering**: Enforces road/highway content whitelists and automatically rejects pedestrian, park, beach, or indoor cameras.
- **Quality Scoring (`0–100`)**: Ranks feeds by camera angle (overhead/elevated), zoom level (multi-lane), resolution (1080p/720p), FPS, and latency.
- **30-Second Health Monitoring & `< 2s` Emergency Failover**: Continuously monitors stream availability, load-balances across healthy feeds, and switches to backup streams or `/static/fallback_videos/{city}.mp4` within 2 seconds of failure while alerting admins via Telegram and email.

### 4. Enterprise Security, Fraud Shield & Treasury Guardrails
- **25% Safety Float Guardrail**: Hard blocks any house profit sweep that would dip the `HOUSE_REVENUE` wallet below `25%` of active player USD liabilities.
- **Real-Time Fraud Detection**: Flags accounts exceeding 10 bets/minute or instant wins above $1,000 USD.

---

## Quick Start

See **[RUSH_HOUR_BET_SETUP.md](RUSH_HOUR_BET_SETUP.md)** for full deployment instructions and **[FEED_MANAGEMENT_GUIDE.md](FEED_MANAGEMENT_GUIDE.md)** for the Smart Feed Agent documentation.

```bash
# 1. Configure environment
cp .env.example .env

# 2. Start FastAPI backend
./venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000

# 3. Run verification test suite
./venv/bin/python test_rush_hour_bet_transformation.py
```

---

## Core API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Platform health check (`RUSH HOUR BET`, DB, Redis, Smart Feed Agent) |
| `GET` | `/api/currencies` | List all 22 supported local currencies & FX rates |
| `POST` | `/api/withdraw-preview` | Preview local currency payout for a USD withdrawal amount |
| `POST` | `/deposit` | Deposit local currency (converted to USD internally) |
| `POST` | `/withdraw` | Withdraw USD balance (paid out in local currency) |
| `GET` | `/api/cities` | List all 29 global cities with `lat`, `long`, `timezone`, `country_code`, `flag_emoji` |
| `GET` | `/api/feed-manager` | Get optimal live or fallback video URL per city |
| `POST` | `/api/feed-manager/override` | Admin manual override of a city's feed source |
| `POST` | `/api/feed-manager/failover` | Trigger `< 2s` emergency feed switch & Telegram/email alert |
| `POST` | `/bet/place` | Place a real-time optical vehicle count wager |
