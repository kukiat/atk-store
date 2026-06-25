-- Data destinations + device mapping (§13, §17)
CREATE TABLE IF NOT EXISTS loadcell.data_destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    destination_name VARCHAR(255) NOT NULL,
    destination_type VARCHAR(50) NOT NULL,

    config JSONB NOT NULL DEFAULT '{}',
    auth_config_encrypted TEXT,

    timeout_seconds INTEGER NOT NULL DEFAULT 10,
    retry_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    max_retries INTEGER NOT NULL DEFAULT 3,
    retry_interval_seconds INTEGER NOT NULL DEFAULT 5,

    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_test_status VARCHAR(20),
    last_test_at TIMESTAMPTZ,
    last_error TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_data_destinations_name
    ON loadcell.data_destinations (destination_name);

CREATE TABLE IF NOT EXISTS loadcell.device_destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    device_id UUID NOT NULL REFERENCES loadcell.devices(id) ON DELETE CASCADE,
    destination_id UUID NOT NULL REFERENCES loadcell.data_destinations(id) ON DELETE RESTRICT,

    trigger_type VARCHAR(50) NOT NULL DEFAULT 'stable_weight',

    minimum_weight NUMERIC(15, 5),
    maximum_weight NUMERIC(15, 5),

    debounce_seconds INTEGER DEFAULT 2,
    send_interval_ms INTEGER,
    only_stable BOOLEAN NOT NULL DEFAULT TRUE,

    mapping_config JSONB,

    enabled BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (device_id, destination_id)
);

CREATE INDEX IF NOT EXISTS idx_device_destinations_device
    ON loadcell.device_destinations (device_id);

CREATE INDEX IF NOT EXISTS idx_device_destinations_destination
    ON loadcell.device_destinations (destination_id);
