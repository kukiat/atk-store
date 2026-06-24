-- unique broker name
CREATE UNIQUE INDEX IF NOT EXISTS uq_mqtt_connections_name
    ON mqtt_connections(connection_name);
