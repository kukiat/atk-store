-- output_enabled: whether the device is actively transmitting telemetry (device-reported state).
ALTER TABLE devices ADD COLUMN IF NOT EXISTS output_enabled BOOLEAN;
