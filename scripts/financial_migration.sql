-- RUSH HOUR BET Financial Core Migration
-- Implements Wallet Segregation, Transaction Ledger, and Direct SQL Update Prevention

-- 1. Wallets Table
CREATE TABLE IF NOT EXISTS wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'PLAYER', 'HOUSE_REVENUE', 'OPERATOR_BANK', 'ESCROW'
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    balance DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    locked_balance DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_wallet_type CHECK (type IN ('PLAYER', 'HOUSE_REVENUE', 'OPERATOR_BANK', 'ESCROW', 'LIQUIDITY_POOL')),
    CONSTRAINT chk_player_balance_non_negative CHECK (type != 'PLAYER' OR balance >= 0.0),
    CONSTRAINT chk_locked_balance_non_negative CHECK (locked_balance >= 0.0)
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_type ON wallets(type);
CREATE INDEX IF NOT EXISTS idx_wallets_status ON wallets(status);

-- 2. Enhance Transactions Table with source/dest wallet, timestamp, status
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source_wallet_id INTEGER REFERENCES wallets(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS dest_wallet_id INTEGER REFERENCES wallets(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'completed';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_transactions_source_wallet ON transactions(source_wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_dest_wallet ON transactions(dest_wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- 3. Daily Settlements Table
CREATE TABLE IF NOT EXISTS settlements (
    id SERIAL PRIMARY KEY,
    settlement_date DATE NOT NULL UNIQUE,
    total_turnover DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    total_payouts DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    total_losses DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    net_profit DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    operator_bank_account VARCHAR(255) NOT NULL DEFAULT 'Stanbic Bank - IBAN GB29JUNGLE8839210',
    status VARCHAR(50) NOT NULL DEFAULT 'PREPARED_FOR_TRANSFER',
    transfer_reference VARCHAR(100),
    prepared_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    settled_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_settlements_date ON settlements(settlement_date);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);

-- 4. Alert Notifications Table (Audit of Instant Alerts sent to Admin)
CREATE TABLE IF NOT EXISTS alert_notifications (
    id SERIAL PRIMARY KEY,
    alert_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    channel VARCHAR(50) NOT NULL DEFAULT 'telegram',
    status VARCHAR(50) NOT NULL DEFAULT 'sent',
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alerts_type ON alert_notifications(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alert_notifications(created_at);

-- 5. Create Default HOUSE_REVENUE and OPERATOR_BANK wallets if not present
INSERT INTO wallets (id, user_id, type, currency, balance, locked_balance, status)
VALUES (1, NULL, 'HOUSE_REVENUE', 'USD', 100000.0, 0.0, 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO wallets (id, user_id, type, currency, balance, locked_balance, status)
VALUES (2, NULL, 'OPERATOR_BANK', 'USD', 0.0, 0.0, 'active')
ON CONFLICT (id) DO NOTHING;

SELECT setval('wallets_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM wallets), 1), 2));

-- 6. Populate PLAYER wallets for existing users
INSERT INTO wallets (user_id, type, currency, balance, locked_balance, status)
SELECT u.id, 'PLAYER', 'USD', COALESCE(u.v_coins, 100.0), 0.0, 'active'
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM wallets w WHERE w.user_id = u.id AND w.type = 'PLAYER'
);

-- 7. Trigger to prevent direct SQL updates to wallet balances
-- Only transactions executed with session variable junglebet.transaction_service = 'active' are allowed!
CREATE OR REPLACE FUNCTION enforce_wallet_update_via_service()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow initial insert or non-balance metadata updates (e.g. status)
    IF (OLD.balance IS DISTINCT FROM NEW.balance) OR (OLD.locked_balance IS DISTINCT FROM NEW.locked_balance) THEN
        IF current_setting('junglebet.transaction_service', true) IS DISTINCT FROM 'active' THEN
            RAISE EXCEPTION 'DIRECT_UPDATE_FORBIDDEN: Direct SQL updates on wallets balance are not permitted. All balance changes must go through transaction_service.';
        END IF;
    END IF;
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_wallet_balance ON wallets;
CREATE TRIGGER trg_protect_wallet_balance
BEFORE UPDATE OF balance, locked_balance ON wallets
FOR EACH ROW
EXECUTE FUNCTION enforce_wallet_update_via_service();
