-- Internal weight storage (§18)
CREATE TABLE IF NOT EXISTS loadcell.weight_readings (
    id BIGSERIAL PRIMARY KEY,

    device_id UUID NOT NULL REFERENCES loadcell.devices(id) ON DELETE CASCADE,

    weight NUMERIC(14, 5) NOT NULL,
    raw_value BIGINT,
    unit VARCHAR(10),

    stable BOOLEAN NOT NULL DEFAULT FALSE,
    overload BOOLEAN NOT NULL DEFAULT FALSE,

    source_timestamp TIMESTAMPTZ,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weight_readings_device_time
    ON loadcell.weight_readings(device_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS loadcell.weight_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    device_id UUID NOT NULL REFERENCES loadcell.devices(id) ON DELETE CASCADE,

    event_type VARCHAR(100) NOT NULL,
    weight NUMERIC(14, 5),
    unit VARCHAR(10),

    data JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weight_events_device_time
    ON loadcell.weight_events(device_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_weight_events_type
    ON loadcell.weight_events(event_type);
