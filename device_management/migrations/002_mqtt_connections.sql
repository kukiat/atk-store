-- MQTT broker connections (§3)
CREATE TABLE IF NOT EXISTS mqtt_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_name VARCHAR(255) NOT NULL,

    protocol VARCHAR(20) NOT NULL DEFAULT 'mqtt',
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL DEFAULT 1883,

    username VARCHAR(255),
    password_encrypted TEXT,

    client_id_prefix VARCHAR(100),

    use_tls BOOLEAN NOT NULL DEFAULT FALSE,
    ca_certificate TEXT,
    client_certificate TEXT,
    client_private_key_encrypted TEXT,

    connect_timeout_seconds INTEGER NOT NULL DEFAULT 10,
    keep_alive_seconds INTEGER NOT NULL DEFAULT 60,
    reconnect_interval_seconds INTEGER NOT NULL DEFAULT 5,

    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    connection_status VARCHAR(20) NOT NULL DEFAULT 'offline',
    last_connected_at TIMESTAMPTZ,
    last_error TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mqtt_connections_enabled
    ON mqtt_connections(enabled);

CREATE INDEX IF NOT EXISTS idx_mqtt_connections_status
    ON mqtt_connections(connection_status);
