-- 数据库优化相关表的迁移脚本
-- 创建时间: 2024年
-- 用途: 支持增量更新、缓存管理和性能监控

-- 1. 数据变更日志表 (用于增量更新)
CREATE TABLE IF NOT EXISTS data_change_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
    record_id INTEGER NOT NULL,
    old_data TEXT, -- JSON格式的旧数据
    new_data TEXT, -- JSON格式的新数据
    changed_fields TEXT, -- JSON数组，记录变更的字段
    user_id INTEGER, -- 操作用户ID（如果适用）
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT FALSE -- 是否已被处理/同步
);

-- 为数据变更日志表创建索引
CREATE INDEX IF NOT EXISTS idx_data_change_log_table_timestamp 
    ON data_change_log(table_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_data_change_log_timestamp 
    ON data_change_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_data_change_log_processed 
    ON data_change_log(processed);

-- 2. 缓存统计表 (用于监控缓存性能)
CREATE TABLE IF NOT EXISTS cache_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cache_key TEXT NOT NULL,
    hit_count INTEGER DEFAULT 0,
    miss_count INTEGER DEFAULT 0,
    last_access DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 为缓存统计表创建索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_cache_stats_key 
    ON cache_stats(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_stats_last_access 
    ON cache_stats(last_access);

-- 3. API性能监控表
CREATE TABLE IF NOT EXISTS api_performance_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    response_time INTEGER NOT NULL, -- 响应时间(毫秒)
    status_code INTEGER NOT NULL,
    request_size INTEGER, -- 请求大小(字节)
    response_size INTEGER, -- 响应大小(字节)
    cache_hit BOOLEAN DEFAULT FALSE,
    user_agent TEXT,
    ip_address TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 为API性能监控表创建索引
CREATE INDEX IF NOT EXISTS idx_api_performance_endpoint_timestamp 
    ON api_performance_log(endpoint, timestamp);
CREATE INDEX IF NOT EXISTS idx_api_performance_timestamp 
    ON api_performance_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_api_performance_response_time 
    ON api_performance_log(response_time);

-- 4. 系统配置表 (用于存储优化相关配置)
CREATE TABLE IF NOT EXISTS system_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    config_type TEXT DEFAULT 'string' CHECK (config_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 为系统配置表创建索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_config_key 
    ON system_config(config_key);

-- 5. 插入默认的系统配置
INSERT OR IGNORE INTO system_config (config_key, config_value, config_type, description) VALUES
('cache_default_ttl', '300000', 'number', '默认缓存TTL(毫秒)'),
('incremental_sync_enabled', 'true', 'boolean', '是否启用增量同步'),
('batch_size_limit', '1000', 'number', '批量操作的最大记录数'),
('api_rate_limit', '100', 'number', '每分钟API请求限制'),
('performance_monitoring_enabled', 'true', 'boolean', '是否启用性能监控'),
('cache_cleanup_interval', '3600000', 'number', '缓存清理间隔(毫秒)'),
('log_retention_days', '30', 'number', '日志保留天数');

-- 6. 为现有表添加优化相关字段

-- 为users表添加索引优化
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_admin_id ON users(admin_id);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- 为orders表添加索引优化
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol);

-- 为user_assets表添加索引优化
CREATE INDEX IF NOT EXISTS idx_user_assets_user_id ON user_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_assets_asset_type ON user_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_user_assets_updated_at ON user_assets(updated_at);

-- 为strategies表添加索引优化
CREATE INDEX IF NOT EXISTS idx_strategies_name ON strategies(name);
CREATE INDEX IF NOT EXISTS idx_strategies_status ON strategies(status);
CREATE INDEX IF NOT EXISTS idx_strategies_created_at ON strategies(created_at);

-- 为trades表添加索引优化
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_strategy_id ON trades(strategy_id);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at);
CREATE INDEX IF NOT EXISTS idx_trades_trade_type ON trades(trade_type);

-- 为user_strategy_tracking表添加索引优化
CREATE INDEX IF NOT EXISTS idx_user_strategy_tracking_user_id ON user_strategy_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_user_strategy_tracking_strategy_id ON user_strategy_tracking(strategy_id);
CREATE INDEX IF NOT EXISTS idx_user_strategy_tracking_status ON user_strategy_tracking(status);
CREATE INDEX IF NOT EXISTS idx_user_strategy_tracking_created_at ON user_strategy_tracking(created_at);

-- 7. 创建触发器用于自动记录数据变更

-- Users表的变更触发器
CREATE TRIGGER IF NOT EXISTS users_change_log_insert
AFTER INSERT ON users
FOR EACH ROW
BEGIN
    INSERT INTO data_change_log (table_name, operation, record_id, new_data)
    VALUES ('users', 'insert', NEW.id, json_object(
        'id', NEW.id,
        'username', NEW.username,
        'nickname', NEW.nickname,
        'email', NEW.email,
        'mobile', NEW.mobile,
        'uuid', NEW.uuid,
        'admin_id', NEW.admin_id,
        'status', NEW.status,
        'created_at', NEW.created_at,
        'updated_at', NEW.updated_at
    ));
END;

CREATE TRIGGER IF NOT EXISTS users_change_log_update
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    INSERT INTO data_change_log (table_name, operation, record_id, old_data, new_data, changed_fields)
    VALUES ('users', 'update', NEW.id, 
        json_object(
            'id', OLD.id,
            'username', OLD.username,
            'nickname', OLD.nickname,
            'email', OLD.email,
            'mobile', OLD.mobile,
            'uuid', OLD.uuid,
            'admin_id', OLD.admin_id,
            'status', OLD.status,
            'created_at', OLD.created_at,
            'updated_at', OLD.updated_at
        ),
        json_object(
            'id', NEW.id,
            'username', NEW.username,
            'nickname', NEW.nickname,
            'email', NEW.email,
            'mobile', NEW.mobile,
            'uuid', NEW.uuid,
            'admin_id', NEW.admin_id,
            'status', NEW.status,
            'created_at', NEW.created_at,
            'updated_at', NEW.updated_at
        ),
        json_array(
            CASE WHEN OLD.username != NEW.username THEN 'username' END,
            CASE WHEN OLD.nickname != NEW.nickname THEN 'nickname' END,
            CASE WHEN OLD.email != NEW.email THEN 'email' END,
            CASE WHEN OLD.mobile != NEW.mobile THEN 'mobile' END,
            CASE WHEN OLD.uuid != NEW.uuid THEN 'uuid' END,
            CASE WHEN OLD.admin_id != NEW.admin_id THEN 'admin_id' END,
            CASE WHEN OLD.status != NEW.status THEN 'status' END,
            CASE WHEN OLD.updated_at != NEW.updated_at THEN 'updated_at' END
        )
    );
END;

CREATE TRIGGER IF NOT EXISTS users_change_log_delete
AFTER DELETE ON users
FOR EACH ROW
BEGIN
    INSERT INTO data_change_log (table_name, operation, record_id, old_data)
    VALUES ('users', 'delete', OLD.id, json_object(
        'id', OLD.id,
        'username', OLD.username,
        'nickname', OLD.nickname,
        'email', OLD.email,
        'mobile', OLD.mobile,
        'uuid', OLD.uuid,
        'admin_id', OLD.admin_id,
        'status', OLD.status,
        'created_at', OLD.created_at,
        'updated_at', OLD.updated_at
    ));
END;

-- 8. 创建视图用于快速查询

-- 活跃用户视图
CREATE VIEW IF NOT EXISTS active_users AS
SELECT u.*, 
       COUNT(t.id) as trade_count,
       MAX(t.created_at) as last_trade_date
FROM users u
LEFT JOIN trades t ON u.id = t.user_id
WHERE u.status = 'active'
GROUP BY u.id;

-- 策略统计视图
CREATE VIEW IF NOT EXISTS strategy_stats AS
SELECT s.*,
       COUNT(t.id) as trade_count,
       COUNT(DISTINCT t.user_id) as user_count,
       SUM(CASE WHEN t.trade_type = 'buy' THEN t.quantity * t.price ELSE 0 END) as total_buy_volume,
       SUM(CASE WHEN t.trade_type = 'sell' THEN t.quantity * t.price ELSE 0 END) as total_sell_volume,
       AVG(t.quantity * t.price) as avg_trade_size
FROM strategies s
LEFT JOIN trades t ON s.id = t.strategy_id
GROUP BY s.id;

-- 每日交易统计视图
CREATE VIEW IF NOT EXISTS daily_trade_stats AS
SELECT DATE(created_at) as trade_date,
       COUNT(*) as trade_count,
       COUNT(DISTINCT user_id) as active_users,
       COUNT(DISTINCT strategy_id) as active_strategies,
       SUM(quantity * price) as total_volume,
       AVG(quantity * price) as avg_trade_size
FROM trades
GROUP BY DATE(created_at)
ORDER BY trade_date DESC;

-- 9. 创建清理过期数据的存储过程（通过定时任务调用）

-- 注意：SQLite不支持存储过程，这些清理操作需要在应用层实现
-- 以下是清理SQL的示例，可以在Node.js中定期执行

/*
-- 清理过期的数据变更日志（保留30天）
DELETE FROM data_change_log 
WHERE timestamp < datetime('now', '-30 days');

-- 清理过期的API性能日志（保留7天）
DELETE FROM api_performance_log 
WHERE timestamp < datetime('now', '-7 days');

-- 清理过期的缓存统计（保留30天）
DELETE FROM cache_stats 
WHERE last_access < datetime('now', '-30 days');

-- 更新缓存统计的updated_at字段
UPDATE cache_stats 
SET updated_at = CURRENT_TIMESTAMP 
WHERE last_access > datetime('now', '-1 day');
*/

-- 10. 创建性能分析相关的索引

-- 复合索引用于复杂查询优化
CREATE INDEX IF NOT EXISTS idx_trades_user_strategy_date 
    ON trades(user_id, strategy_id, created_at);
    
CREATE INDEX IF NOT EXISTS idx_user_assets_user_type_updated 
    ON user_assets(user_id, asset_type, updated_at);
    
CREATE INDEX IF NOT EXISTS idx_orders_user_status_created 
    ON orders(user_id, status, created_at);

-- 完成迁移
PRAGMA user_version = 2; -- 更新数据库版本号

-- 输出完成信息
SELECT 'Database optimization migration completed successfully' as result;