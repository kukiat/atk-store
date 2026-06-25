-- Catalog of device types (managed via API / UI).

CREATE SCHEMA IF NOT EXISTS loadcell;

CREATE TABLE IF NOT EXISTS loadcell.device_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(50) NOT NULL UNIQUE,
    label VARCHAR(100) NOT NULL,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_types_enabled_sort
    ON loadcell.device_types (enabled, sort_order, label);

INSERT INTO loadcell.device_types (slug, label, sort_order) VALUES
    ('loadcell', 'Load Cell', 10),
    ('checkweigher', 'Checkweigher', 20),
    ('packing', 'Packing', 30),
    ('conveyor', 'Conveyor', 40)
ON CONFLICT (slug) DO NOTHING;
