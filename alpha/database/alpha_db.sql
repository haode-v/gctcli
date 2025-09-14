-- 数据库名: alpha_db

-- 首先，为订单方向和状态创建 ENUM 类型，这能确保数据一致性，比使用字符串更高效。
CREATE TYPE order_side AS ENUM ('BUY', 'SELL');
CREATE TYPE order_status AS ENUM (
    'PENDING_SUBMIT', -- 待提交 (程序内部状态)
    'NEW',            -- 已提交 (交易所状态)
    'PARTIALLY_FILLED',-- 部分成交
    'FILLED',         -- 完全成交
    'CANCELED',       -- 已取消
    'REJECTED'        -- 已拒绝
);

-- 创建订单表
CREATE TABLE orders (
    -- 核心ID
    id BIGSERIAL PRIMARY KEY,  -- 自增主键，作为内部唯一标识
    user_id BIGINT NOT NULL, -- 关联用户的ID
    uuid VARCHAR(255) NOT NULL, -- 关联用户的UUID
    email VARCHAR(255) NOT NULL, -- 关联用户的Email
    exchange_order_id VARCHAR(255) UNIQUE, -- 交易所返回的订单ID，非常重要，需要唯一

    -- 订单基本信息 (来自您的 exchange.Order 和提交逻辑)
    symbol VARCHAR(255) NOT NULL,             -- 复合格式的 symbol，例如 "0x...@56:ALPHA_295/USDT"
    base_asset VARCHAR(50) NOT NULL,          -- 基础资产，例如 "ALPHA_295"
    quote_asset VARCHAR(50) NOT NULL,         -- 计价资产，例如 "USDT"
    side order_side NOT NULL,                 -- 订单方向 (BUY 或 SELL)

    -- 价格与数量信息 (使用 DECIMAL 避免浮点数精度问题)
    quantity_requested DECIMAL(36, 18) NOT NULL, -- 请求的下单数量
    price_requested DECIMAL(36, 18) NOT NULL,    -- 请求的下单价格 (经过滑点计算后的价格)

    quantity_executed DECIMAL(36, 18) DEFAULT 0, -- 已成交的数量
    price_executed DECIMAL(36, 18),              -- 成交的平均价格

    -- 状态与API响应
    status order_status NOT NULL DEFAULT 'PENDING_SUBMIT', -- 订单的当前状态
    api_response_code VARCHAR(50),               -- API响应码，用于调试，例如 "481002"
    api_response_message TEXT,                   -- API响应消息，用于调试

    -- 时间戳 (使用带时区的时间戳)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- 记录创建时间
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- 记录最后更新时间
    exchange_timestamp TIMESTAMPTZ                 -- 交易所处理该订单的时间
);

-- 为经常查询的字段创建索引以提高性能
CREATE INDEX idx_orders_user_id ON orders (user_id);
CREATE INDEX idx_orders_symbol ON orders (symbol);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_created_at ON orders (created_at);

-- 创建一个触发器，在行更新时自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
