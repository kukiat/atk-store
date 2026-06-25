-- MQTT QoS settings for gateway subscribe / publish

ALTER TABLE loadcell.mqtt_connections
    ADD COLUMN IF NOT EXISTS subscribe_qos SMALLINT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS publish_qos SMALLINT NOT NULL DEFAULT 1;

UPDATE loadcell.mqtt_connections SET subscribe_qos = 1 WHERE subscribe_qos IS NULL;
UPDATE loadcell.mqtt_connections SET publish_qos = 1 WHERE publish_qos IS NULL;
