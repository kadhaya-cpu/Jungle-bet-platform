# RUSH HOUR BET — Smart Feed Agent & Business Continuity Guide

This document explains the architecture, scoring algorithms, content filtering rules, emergency failover (`< 2s` SLA), load balancing, and admin override controls of the **RUSH HOUR BET Smart Feed Agent** (`/services/smart_feed_agent.py`).

---

## 1. System Architecture

The Smart Feed Agent (`SmartFeedAgent`) guarantees uninterrupted, high-angle vehicular traffic streams across **29 global cities** spanning 5 continents:

- **Asia**: Tokyo, Shanghai, Beijing, Mumbai, Bangkok, Singapore
- **Africa**: Casablanca, Lagos, Cairo, Nairobi, Johannesburg
- **Americas**: New York, Los Angeles, São Paulo, Mexico City, Toronto
- **Europe**: London, Paris, Berlin, Madrid, Rome, Amsterdam, Vienna, Prague, Zurich, Brussels
- **Oceania**: Sydney, Melbourne, Auckland

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    RUSH HOUR BET SMART FEED AGENT                       │
├───────────────────┬─────────────────────────┬───────────────────────────┤
│ 1. Discovery APIs │ 2. Content Filter & CV  │ 3. Continuity & Routing   │
│ • YouTube Live v3 │ • Keyword Whitelist     │ • 30s Health Monitor      │
│ • EarthCam API    │ • Pedestrian/Park Block │ • <2s Emergency Failover  │
│ • Municipal DOT   │ • OpenCV Frame Check    │ • Multi-Source Load Bal.  │
│ • Config Registry │ • Quality Score (0-100) │ • Local MP4 Loop Fallback │
└───────────────────┴─────────────────────────┴───────────────────────────┘
```

---

## 2. Multi-Source Live Feed Discovery

The agent discovers candidate streams per city from three live providers plus the static configuration in `config/feed_sources.json`:

1. **YouTube Data API v3 (`discover_youtube_feeds`)**:
   - Queries live broadcasts matching `"{City} live traffic highway camera road"`.
   - Uses `YOUTUBE_API_KEY` from `.env`.
2. **EarthCam API (`discover_earthcam_feeds`)**:
   - Queries highway/interchange cameras matching city coordinates.
   - Uses `EARTHCAM_API_KEY` from `.env`.
3. **Municipal & National DOT Traffic Camera APIs (`discover_traffic_camera_feeds`)**:
   - Integrates with Caltrans (Los Angeles), NYCDOT (New York), TfL JamCams (London), Rijkswaterstaat (Amsterdam), LTA (Singapore), COMPASS (Toronto), SANRAL (Johannesburg), LiveTraffic NSW (Sydney), and NZTA (Auckland).

---

## 3. Content Filtering (Traffic/Road Only — Reject Pedestrian/Park Feeds)

Every candidate feed must pass `is_valid_traffic_feed()` before being admitted into the active pool:

- **Required Traffic Keywords (at least 1 required)**:
  `traffic`, `highway`, `freeway`, `expressway`, `motorway`, `autobahn`, `autoroute`, `ring road`, `bridge`, `intersection`, `junction`, `overpass`, `interchange`, `boulevard`, `avenue`, `lanes`, `cars`, `vehicles`, `road`, `corridor`, `flyover`, `toll`, `periferico`, `marginal`, `shuto`.
- **Forbidden Keywords (immediate rejection)**:
  `pedestrian`, `park`, `garden`, `zoo`, `beach`, `boardwalk`, `walking tour`, `footpath`, `hiking`, `trail`, `playground`, `aquarium`, `museum`, `cathedral interior`, `shopping mall`, `cafe`, `restaurant`, `bird feeder`, `wildlife`, `nature reserve`, `skatepark`, `plaza fountain`.
- **OpenCV Frame Inspection (`analyze_frame_for_traffic`)**:
  Verifies frame dimensions, road contrast, and non-black/non-frozen pixel variance.

---

## 4. Quality Scoring System (`0 - 100`)

`calculate_quality_score(source, health)` ranks each valid traffic feed using a weighted composite formula:

| Factor | Weight | Criteria |
| :--- | :--- | :--- |
| **Camera Angle** | 35 pts | `overhead_highway` (35), `elevated_overpass` (34), `elevated_bridge` (32), `elevated_junction` (30), `roadside` (24), `street_level` (15) |
| **Zoom Level** | 25 pts | `optimal_multi_lane` (25), `medium_highway` (23), `wide_corridor` (21), `close_single_lane` (15), `extreme_wide` (12) |
| **Resolution** | 20 pts | `1080p` / `4K` (20), `720p` (16), `480p` (10) |
| **Frame Rate (FPS)** | 10 pts | `>= 30 FPS` (10), `>= 25 FPS` (8), `< 25 FPS` (5) |
| **Priority & Latency Bonus** | 10 pts | Priority 1 (+6), Priority 2 (+4), Latency `< 250ms` (+4) |

Feeds are sorted in descending order of their composite quality score.

---

## 5. Business Continuity Features

### 5.1 Health Monitoring (Every 30 Seconds)
- `start_background_monitor()` runs an async loop every `30 seconds` (`HEALTH_CHECK_INTERVAL_SECONDS = 30`).
- Probes each city's feed sources and updates live latency, availability, and quality scores.

### 5.2 Emergency Feed Switching (`< 2 Seconds` SLA)
- When a stream fails or times out, `emergency_switch_feed(city, failed_source_id, reason)` executes immediately with a strict `1.8s` internal timeout budget (`EMERGENCY_SWITCH_SLA_SECONDS = 2.0`).
- Automatically promotes the next highest-scoring healthy live feed, or seamlessly switches to `/static/fallback_videos/{city}.mp4` if all external live feeds are unreachable.
- Dispatches real-time **Telegram** and **Email** alerts via `notification_service.alert_feed_failure()`.

### 5.3 Multi-Source Load Balancing
- `get_optimal_feed(city, use_load_balancing=True)` distributes viewer sessions across top-tier healthy feeds (within 8 quality points of the top feed) using weighted round-robin selection so no single upstream camera proxy is overwhelmed.

### 5.4 Pre-Downloaded Fallback Video Library
- Stored in `/static/fallback_videos/{city}.mp4` for all 29 cities (plus `default.mp4`).
- Served with `Accept-Ranges: bytes` via `GET /static/fallback_videos/{city}.mp4`.

---

## 6. Admin Override Controls & API Reference

### Get Optimal Feed for All Cities or a Specific City
```http
GET /api/feed-manager
GET /api/feed-manager?city=Tokyo
GET /api/feed-manager?region=Asia
GET /api/feed-manager/London
```

### Manually Override a City's Feed Source (Admin)
```http
POST /api/feed-manager/override
Content-Type: application/json

{
  "city": "Tokyo",
  "video_url": "https://www.youtube.com/watch?v=HpdO5Kq3o7Y",
  "reason": "Scheduled maintenance on primary Shuto camera",
  "admin_user": "ops_lead"
}
```

### Clear Manual Admin Override
```http
DELETE /api/feed-manager/override/Tokyo
```

### Trigger Emergency Failover (`< 2s` Switch + Alert)
```http
POST /api/feed-manager/failover
Content-Type: application/json

{
  "city": "London",
  "failed_source_id": "lon_yt_1",
  "reason": "Upstream RTSP timeout"
}
```

### Trigger Immediate Global Health Scan
```http
POST /api/feed-manager/scan
```
