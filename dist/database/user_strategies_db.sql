CREATE TABLE user_strategies (
    user_id BIGINT NOT NULL,
    strategy_id BIGINT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Define foreign key constraints
    CONSTRAINT fk_user
        FOREIGN KEY(user_id) 
        REFERENCES users(id)
        ON DELETE CASCADE,
    
    CONSTRAINT fk_strategy
        FOREIGN KEY(strategy_id) 
        REFERENCES strategies(id)
        ON DELETE CASCADE,
    
    -- Define the composite primary key
    PRIMARY KEY (user_id, strategy_id)
);

COMMENT ON TABLE user_strategies IS 'Links users to the strategies they have subscribed to. This table manages permissions/subscriptions.';
COMMENT ON COLUMN user_strategies.is_active IS 'Whether the user''s subscription to the strategy is currently active.';
