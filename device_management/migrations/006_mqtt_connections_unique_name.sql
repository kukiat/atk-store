-- unique broker name
CREATE UNIQUE INDEX IF NOT EXISTS uq_mqtt_connections_name
    ON loadcell.mqtt_connections(connection_name);
