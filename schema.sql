-- Jungle Bet Database Migration / Schema
-- Ensures User schema contains phone (unique), provider, and providerAccountId

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255),
    phone VARCHAR(50) UNIQUE,
    provider VARCHAR(50) NOT NULL DEFAULT 'credentials',
    "providerAccountId" VARCHAR(255),
    v_coins DOUBLE PRECISION DEFAULT 100.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for phone queries
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider, "providerAccountId");

-- NextAuth OAuth Accounts Table
CREATE TABLE IF NOT EXISTS accounts (
    id VARCHAR(255) PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    provider_account_id VARCHAR(255) NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at BIGINT,
    token_type VARCHAR(50),
    scope VARCHAR(255),
    id_token TEXT,
    session_state VARCHAR(255),
    CONSTRAINT uk_provider_account UNIQUE (provider, provider_account_id)
);

-- Bets Table
CREATE TABLE IF NOT EXISTS bets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    bet_type VARCHAR(50) NOT NULL,
    criteria JSONB NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    resolution_data JSONB,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITHOUT TIME ZONE
);

-- Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    amount DOUBLE PRECISION NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Camera Feeds Table
CREATE TABLE IF NOT EXISTS camera_feeds (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    rtsp_url TEXT NOT NULL,
    country_code VARCHAR(10) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    lane_mask JSONB,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed with 5 high-quality, lane-visible traffic camera streams
INSERT INTO camera_feeds (id, name, location, rtsp_url, country_code, status, lane_mask)
VALUES
  (1, 'Caltrans I-405 Culver Overpass', 'Los Angeles - I-405', 'https://wzmedia.dot.ca.gov/D12/SB405CulverBlvd.stream/playlist.m3u8', 'US', 'active', '{"coordinates": [[0.10, 0.45], [0.90, 0.45], [0.95, 0.95], [0.05, 0.95]]}'::jsonb),
  (2, 'TfL Chelsea Bridge Junction', 'London - Chelsea Bridge', 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.04641.mp4', 'UK', 'active', '{"coordinates": [[0.15, 0.40], [0.85, 0.40], [0.90, 0.95], [0.10, 0.95]]}'::jsonb),
  (3, 'Rijkswaterstaat A1 Hoevelaken Overpass', 'Amsterdam - A10 / A1', 'https://stream.inmoves.nl/rtplive/IB_55.stream/playlist.m3u8', 'NL', 'active', '{"coordinates": [[0.05, 0.45], [0.95, 0.45], [0.98, 0.95], [0.02, 0.95]]}'::jsonb),
  (4, 'Ultralytics Speedway Camera', 'Simulation - Ultralytics Speedway', 'https://github.com/ultralytics/notebooks/releases/download/v0.0.0/solutions-ci-demo.mp4', 'SIM', 'active', '{"coordinates": [[0.10, 0.50], [0.90, 0.50], [0.95, 0.95], [0.05, 0.95]]}'::jsonb),
  (5, 'Highway Flow Simulator', 'Simulation - Highway Loop', 'https://raw.githubusercontent.com/intel-iot-devkit/sample-videos/master/car-detection.mp4', 'SIM', 'active', '{"coordinates": [[0.15, 0.40], [0.85, 0.40], [0.90, 0.95], [0.10, 0.95]]}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  location = EXCLUDED.location,
  rtsp_url = EXCLUDED.rtsp_url,
  country_code = EXCLUDED.country_code,
  status = EXCLUDED.status,
  lane_mask = EXCLUDED.lane_mask,
  updated_at = CURRENT_TIMESTAMP;

SELECT setval('camera_feeds_id_seq', COALESCE((SELECT MAX(id) FROM camera_feeds), 1));

-- Payments Table (Stripe, M-Pesa, Flutterwave, Paystack)
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64),
    bet_id VARCHAR(64),
    amount DOUBLE PRECISION NOT NULL,
    currency VARCHAR(10) NOT NULL,
    provider VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    phone_number VARCHAR(32),
    customer_email VARCHAR(128),
    country VARCHAR(8),
    metadata JSONB,
    provider_reference VARCHAR(128),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
