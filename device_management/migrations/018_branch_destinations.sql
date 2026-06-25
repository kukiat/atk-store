-- Branch → data destination routing (all devices in branch use same API)

CREATE TABLE IF NOT EXISTS loadcell.branch_destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    branch VARCHAR(100) NOT NULL,
    destination_id UUID NOT NULL REFERENCES loadcell.data_destinations(id) ON DELETE RESTRICT,

    trigger_type VARCHAR(50) NOT NULL DEFAULT 'stable_weight',
    only_stable BOOLEAN NOT NULL DEFAULT TRUE,
    debounce_seconds INTEGER DEFAULT 2,
    mapping_config JSONB,

    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (branch)
);

CREATE INDEX IF NOT EXISTS idx_branch_destinations_branch
    ON loadcell.branch_destinations (branch);

CREATE INDEX IF NOT EXISTS idx_branch_destinations_destination
    ON loadcell.branch_destinations (destination_id);
