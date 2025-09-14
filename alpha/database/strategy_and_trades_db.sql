-- Drop tables if they exist to ensure a clean setup
DROP TABLE IF EXISTS trades;
DROP TABLE IF EXISTS strategies;

-- strategies table defines configurable strategy instances.
CREATE TABLE IF NOT EXISTS strategies (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    -- Increased length to 255 to accommodate complex identifiers like contract addresses with tags.
    symbol VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'inactive', -- active, inactive, paused, completed, failed

    -- Funding logic: 'FIXED_AMOUNT' or 'PERCENTAGE_LOCAL_ASSET'
    -- PERCENTAGE_LOCAL_ASSET means it will query the local DB for asset balance.
    funding_type VARCHAR(30) NOT NULL,
    funding_value DECIMAL NOT NULL, -- e.g., 15.0 for USDT, or 50.0 for 50%

    -- Core strategy parameters
    profit_margin_percent DECIMAL NOT NULL,
    stop_loss_percent DECIMAL,
    speed INTEGER, -- 每次刷量时间（秒）

    -- Lifecycle & cumulative limits
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    max_total_volume_usdt DECIMAL,
    fee_buffer_quantity DOUBLE PRECISION DEFAULT 0.0 NOT NULL,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- trades table stores the record of each buy-sell cycle executed by a strategy.
CREATE TABLE IF NOT EXISTS trades (
    id BIGSERIAL PRIMARY KEY,
    strategy_id BIGINT NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
    -- Increased length to 255 to match the strategies table.
    symbol VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL, -- PENDING_BUY, BUY_FILLED, PENDING_SELL, SELL_FILLED, CANCELLED, FAILED

    -- Order details
    buy_order_id VARCHAR(255),
    buy_price DECIMAL,
    buy_quantity DECIMAL,
    buy_quote_quantity DECIMAL NOT NULL,
    buy_timestamp TIMESTAMPTZ,

    sell_order_id VARCHAR(255),
    sell_price DECIMAL,
    sell_quantity DECIMAL,
    sell_target_price DECIMAL,
    sell_timestamp TIMESTAMPTZ,
    user_id BIGINT NOT NULL,

    -- Outcome
    pnl DECIMAL,
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- user_strategy_tracking table tracks the individual progress of each user for each strategy.
CREATE TABLE IF NOT EXISTS user_strategy_tracking (
    user_id BIGINT NOT NULL, -- Assuming this references a 'users' table.
    strategy_id BIGINT NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
    initial_balance DECIMAL(30, 8) NOT NULL,
    consumed_amount DECIMAL(30, 8) NOT NULL DEFAULT 0.0,
    current_balance DECIMAL(30, 8) NOT NULL,
    achieved_trade_volume DECIMAL(30, 8) NOT NULL DEFAULT 0.0,
    fee_buffer_quantity DECIMAL(30, 8) NOT NULL DEFAULT 0.0,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- e.g., active, paused, completed, failed
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, strategy_id) -- Ensures each user has only one tracking entry per strategy
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_strategy_tracking_user ON user_strategy_tracking (user_id);
CREATE INDEX IF NOT EXISTS idx_user_strategy_tracking_strategy ON user_strategy_tracking (strategy_id);
CREATE INDEX IF NOT EXISTS idx_strategies_active ON strategies (symbol, status);
CREATE INDEX IF NOT EXISTS idx_trades_active_by_strategy ON trades (strategy_id, status);

-- Trigger function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to both tables
CREATE TRIGGER update_strategies_updated_at
BEFORE UPDATE ON strategies
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trades_updated_at
BEFORE UPDATE ON trades
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

---
--- INITIAL STRATEGY CONFIGURATION
---
INSERT INTO strategies (
    name,
    symbol,
    status,
    funding_type,
    funding_value,
    profit_margin_percent,
    stop_loss_percent,
    start_time,
    end_time,
    max_total_volume_usdt
) VALUES (
    'alpha_half_balance_500_limit',
    '0xf970706063b7853877f39515c96932d49d5ac9cd@56:ALPHA_286/USDT',
    'active',
    'PERCENTAGE_LOCAL_ASSET', -- Use 50% of the USDT balance found in the local user_assets table
    50.0,
    1.5, -- A default 1.5% profit margin, can be adjusted
    NULL, -- No stop-loss for now
    NOW(), -- Start immediately
    '2025-08-05 11:30:00+08', -- Stop at Beijing time 11:30 AM
    500.0 -- Stop when total traded volume reaches 500 USDT
);
