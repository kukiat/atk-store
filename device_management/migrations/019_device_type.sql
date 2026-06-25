-- Device type for routing: branch + device_type → API

ALTER TABLE loadcell.devices
    ADD COLUMN IF NOT EXISTS device_type VARCHAR(50) NOT NULL DEFAULT 'loadcell';

CREATE INDEX IF NOT EXISTS idx_devices_device_type
    ON loadcell.devices (device_type);

ALTER TABLE loadcell.branch_destinations
    ADD COLUMN IF NOT EXISTS device_type VARCHAR(50) NOT NULL DEFAULT 'loadcell';

ALTER TABLE loadcell.branch_destinations
    DROP CONSTRAINT IF EXISTS branch_destinations_branch_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_branch_destinations_branch_type
    ON loadcell.branch_destinations (branch, device_type);

CREATE INDEX IF NOT EXISTS idx_branch_destinations_type
    ON loadcell.branch_destinations (device_type);
