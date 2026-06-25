-- Delivery logs + retry queue (§19)
CREATE TABLE IF NOT EXISTS loadcell.delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    device_id UUID REFERENCES loadcell.devices(id) ON DELETE SET NULL,
    destination_id UUID REFERENCES loadcell.data_destinations(id) ON DELETE SET NULL,
    device_destination_id UUID REFERENCES loadcell.device_destinations(id) ON DELETE SET NULL,

    event_id UUID,
    request_payload JSONB,
    response_payload JSONB,

    status VARCHAR(30) NOT NULL,
    http_status INTEGER,

    attempt_count INTEGER NOT NULL DEFAULT 1,
    error_message TEXT,

    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_logs_device_time
    ON loadcell.delivery_logs (device_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_logs_status_retry
    ON loadcell.delivery_logs (status, next_retry_at)
    WHERE status IN ('retrying', 'failed');

CREATE INDEX IF NOT EXISTS idx_delivery_logs_destination
    ON loadcell.delivery_logs (destination_id, created_at DESC);
