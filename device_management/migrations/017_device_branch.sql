-- Branch (สาขา) for MQTT topic prefix: loadcell/{branch}/{device_id}/...

ALTER TABLE loadcell.devices
    ADD COLUMN IF NOT EXISTS branch VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_devices_branch
    ON loadcell.devices (branch);

COMMENT ON COLUMN loadcell.devices.branch IS 'MQTT topic branch segment, e.g. loadcell/{branch}/{device_id}/telemetry';
