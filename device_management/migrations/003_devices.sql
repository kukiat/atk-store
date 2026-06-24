-- Load cell devices (§4)
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(100) UNIQUE NOT NULL,
    device_name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    model VARCHAR(100),

    mqtt_connection_id UUID REFERENCES mqtt_connections(id) ON DELETE SET NULL,

    telemetry_topic VARCHAR(500) NOT NULL,
    status_topic VARCHAR(500),
    command_topic VARCHAR(500),
    response_topic VARCHAR(500),
    config_topic VARCHAR(500),
    calibration_topic VARCHAR(500),

    payload_format VARCHAR(50) NOT NULL DEFAULT 'json',
    parser_config JSONB,

    firmware_version VARCHAR(50),
    ip_address VARCHAR(50),
    mac_address VARCHAR(50),
    rssi INTEGER,

    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(20) NOT NULL DEFAULT 'offline',
    last_seen_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_mqtt_connection
    ON devices(mqtt_connection_id);

CREATE INDEX IF NOT EXISTS idx_devices_status
    ON devices(status);

CREATE INDEX IF NOT EXISTS idx_devices_enabled
    ON devices(enabled);
