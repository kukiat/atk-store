-- Single shared MQTT broker for all devices and gateway realtime monitoring.

ALTER TABLE loadcell.mqtt_connections
    ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mqtt_connections_default
    ON loadcell.mqtt_connections ((true))
    WHERE is_default = true;

-- Mark one connection as default (prefer hexdas-rabbitmq, else oldest).
UPDATE loadcell.mqtt_connections SET is_default = false;

UPDATE loadcell.mqtt_connections mc
SET is_default = true
WHERE mc.id = (
    SELECT id FROM loadcell.mqtt_connections
    WHERE connection_name = 'hexdas-rabbitmq'
    LIMIT 1
);

UPDATE loadcell.mqtt_connections mc
SET is_default = true
WHERE mc.id = (
    SELECT id FROM loadcell.mqtt_connections
    ORDER BY created_at ASC
    LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM loadcell.mqtt_connections WHERE is_default = true);

-- All devices share the default broker.
UPDATE loadcell.devices d
SET mqtt_connection_id = (
    SELECT id FROM loadcell.mqtt_connections WHERE is_default = true LIMIT 1
)
WHERE EXISTS (SELECT 1 FROM loadcell.mqtt_connections WHERE is_default = true);
