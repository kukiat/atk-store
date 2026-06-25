-- +goose Up
ALTER TABLE loadcell.devices
    ADD COLUMN IF NOT EXISTS device_config JSONB;

COMMENT ON COLUMN loadcell.devices.device_config IS 'Draft device settings (scale/wifi/mqtt) saved from web UI';

-- +goose Down
ALTER TABLE loadcell.devices DROP COLUMN IF EXISTS device_config;
