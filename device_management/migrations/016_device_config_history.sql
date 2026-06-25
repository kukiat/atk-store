-- Device config change history (before/after, actor, filters)

CREATE TABLE IF NOT EXISTS loadcell.device_config_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    device_uuid UUID REFERENCES loadcell.devices(id) ON DELETE SET NULL,
    device_id VARCHAR(100) NOT NULL,
    device_name VARCHAR(255),

    action VARCHAR(50) NOT NULL,
    changed_by VARCHAR(100),
    user_id UUID REFERENCES loadcell.users(id) ON DELETE SET NULL,

    before_config JSONB,
    after_config JSONB,
    changes JSONB NOT NULL DEFAULT '[]'::jsonb,

    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_config_history_created
    ON loadcell.device_config_history (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_device_config_history_device
    ON loadcell.device_config_history (device_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_device_config_history_user
    ON loadcell.device_config_history (changed_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_device_config_history_action
    ON loadcell.device_config_history (action, created_at DESC);
