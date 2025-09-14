-- This file defines the schema for the 'users' table.

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    UUID VARCHAR(36) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    admin_id BIGINT NULL, -- References another user's ID, can be NULL if the user is not managed by an admin.
    mobile VARCHAR(20),
    email VARCHAR(255),
    nickname VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_login_status
(
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'offline', -- 'online', 'offline', 'away', etc.
    qr_code_image TEXT, -- Base64 encoded image or file path
    qr_code_status VARCHAR(20) DEFAULT 'generated', --'scanned','expired','generated'
    qr_code_expires_at TIMESTAMPTZ,
    last_login_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    next_login_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Add a unique constraint on user_id to ensure one status record per user.

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_admin_id ON users (admin_id);

-- User login status table
CREATE TABLE IF NOT EXISTS user_login_status (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'offline', -- 'online', 'offline', 'away', etc.
    qr_code_image TEXT, -- Base64 encoded image or file path
    last_login_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
);

-- Indexes for user_login_status table
CREATE INDEX IF NOT EXISTS idx_user_login_status_user_id ON user_login_status (user_id);
CREATE INDEX IF NOT EXISTS idx_user_login_status_status ON user_login_status (status);
CREATE INDEX IF NOT EXISTS idx_user_login_status_last_login ON user_login_status (last_login_time);
