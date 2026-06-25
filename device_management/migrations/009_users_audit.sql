-- Operators + audit logs (§29, Step 13) — schema loadcell

CREATE TABLE IF NOT EXISTS loadcell.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'VIEWER',
    display_name VARCHAR(255),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,

    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON loadcell.users (username);

CREATE TABLE IF NOT EXISTS loadcell.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID REFERENCES loadcell.users(id) ON DELETE SET NULL,
    username VARCHAR(100),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    details JSONB,
    ip_address VARCHAR(50),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created
    ON loadcell.audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user
    ON loadcell.audit_logs (user_id, created_at DESC);
