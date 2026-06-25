-- Calibration history (§12)
CREATE TABLE IF NOT EXISTS loadcell.device_calibrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES loadcell.devices(id) ON DELETE CASCADE,

    zero_offset BIGINT NOT NULL,
    calibration_factor NUMERIC(20, 8) NOT NULL,
    known_weight NUMERIC(12, 4),
    unit VARCHAR(10),

    verification_weight NUMERIC(12, 4),
    measured_weight NUMERIC(12, 4),
    error_percent NUMERIC(12, 6),

    calibrated_by VARCHAR(255),
    calibrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_calibrations_device
    ON loadcell.device_calibrations(device_id, calibrated_at DESC);
