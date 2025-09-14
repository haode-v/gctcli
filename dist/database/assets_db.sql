-- 数据库名: alpha_db

-- 清理旧的定义 (如果存在)，使脚本可重复执行
DROP TABLE IF EXISTS asset_history;
DROP TABLE IF EXISTS user_assets;
DROP TYPE IF EXISTS asset_change_type;

-- 首先，为资产历史记录的变更类型创建 ENUM
CREATE TYPE asset_change_type AS ENUM (
    'TRADE',          -- 交易导致
    'SYNC',           -- 定期同步导致
    'DEPOSIT',        -- 充值
    'WITHDRAWAL',     -- 提现
    'FEE'             -- 手续费
);

-- 创建用户当前资产表
-- This table stores the most recent state of a user's assets.
CREATE TABLE user_assets (
    id BIGSERIAL PRIMARY KEY,
    uuid VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    asset VARCHAR(50) NOT NULL,                 -- 资产名称, e.g., 'USDT', 'BNB'
    wallet_type VARCHAR(50) NOT NULL,           -- 钱包类型, e.g., 'SPOT', 'FUNDING'
    
    -- 余额信息 (使用 DECIMAL 保证精度)
    available DECIMAL(36, 18) NOT NULL DEFAULT 0,
    locked DECIMAL(36, 18) NOT NULL DEFAULT 0,
    frozen DECIMAL(36, 18) NOT NULL DEFAULT 0,
    withdrawing DECIMAL(36, 18) NOT NULL DEFAULT 0,
    valuation DECIMAL(36, 18) NOT NULL DEFAULT 0, -- 以计价货币(e.g., BTC)为单位的估值

    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 确保每个用户、每种资产、每种钱包类型只有一条记录
    CONSTRAINT unique_user_asset_wallet UNIQUE (uuid, asset, wallet_type)
);

-- 创建资产历史记录表
-- This table acts as a ledger, recording every transaction that affects an asset's balance.
CREATE TABLE asset_history (
    id BIGSERIAL PRIMARY KEY,
    user_asset_id BIGINT NOT NULL REFERENCES user_assets(id), -- 关联到 user_assets 表
    
    change_type asset_change_type NOT NULL,     -- 变更类型
    change_amount DECIMAL(36, 18) NOT NULL,     -- 本次变动的数量 (正数或负数)
    balance_before DECIMAL(36, 18) NOT NULL,    -- 变动前的可用余额
    balance_after DECIMAL(36, 18) NOT NULL,     -- 变动后的可用余额

    -- 关联信息
    related_order_id VARCHAR(255),              -- 关联的交易所订单ID (如果是交易导致)
    notes TEXT,                                 -- 备注信息, e.g., "Manual sync discrepancy"

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 为常用查询字段创建索引
CREATE INDEX idx_user_assets_uuid_asset ON user_assets (uuid, asset);
CREATE INDEX idx_asset_history_user_asset_id ON asset_history (user_asset_id);
CREATE INDEX idx_asset_history_related_order_id ON asset_history (related_order_id);

-- 创建触发器，在 user_assets 更新时自动更新 last_updated_at 字段
CREATE OR REPLACE FUNCTION update_last_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.last_updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_assets_last_updated_at
BEFORE UPDATE ON user_assets
FOR EACH ROW
EXECUTE FUNCTION update_last_updated_at_column();
