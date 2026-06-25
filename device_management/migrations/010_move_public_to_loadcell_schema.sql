-- Upgrade legacy public-schema tables into loadcell schema (idempotent)

CREATE SCHEMA IF NOT EXISTS loadcell;

CREATE OR REPLACE FUNCTION loadcell._move_table_if_needed(
    src_schema text,
    src_table text,
    dst_table text
) RETURNS void AS $$
DECLARE
    src_oid oid;
    dst_oid oid;
BEGIN
    SELECT c.oid INTO src_oid
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = src_schema AND c.relname = src_table AND c.relkind = 'r';

    IF src_oid IS NULL THEN
        RETURN;
    END IF;

    SELECT c.oid INTO dst_oid
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'loadcell' AND c.relname = dst_table AND c.relkind = 'r';

    IF dst_oid IS NOT NULL THEN
        EXECUTE format('DROP TABLE loadcell.%I CASCADE', dst_table);
    END IF;

    EXECUTE format('ALTER TABLE %I.%I SET SCHEMA loadcell', src_schema, src_table);

    IF src_table <> dst_table THEN
        EXECUTE format('ALTER TABLE loadcell.%I RENAME TO %I', src_table, dst_table);
    END IF;
END;
$$ LANGUAGE plpgsql;

SELECT loadcell._move_table_if_needed('public', 'mqtt_connections', 'mqtt_connections');
SELECT loadcell._move_table_if_needed('public', 'devices', 'devices');
SELECT loadcell._move_table_if_needed('public', 'device_calibrations', 'device_calibrations');
SELECT loadcell._move_table_if_needed('public', 'weight_readings', 'weight_readings');
SELECT loadcell._move_table_if_needed('public', 'weight_events', 'weight_events');
SELECT loadcell._move_table_if_needed('public', 'data_destinations', 'data_destinations');
SELECT loadcell._move_table_if_needed('public', 'device_destinations', 'device_destinations');
SELECT loadcell._move_table_if_needed('public', 'delivery_logs', 'delivery_logs');
SELECT loadcell._move_table_if_needed('public', 'gateway_users', 'users');
SELECT loadcell._move_table_if_needed('public', 'gateway_audit_logs', 'audit_logs');

-- Rename tables already created in loadcell with legacy gateway_* names
DO $$
BEGIN
    IF to_regclass('loadcell.gateway_users') IS NOT NULL AND to_regclass('loadcell.users') IS NULL THEN
        ALTER TABLE loadcell.gateway_users RENAME TO users;
    END IF;
    IF to_regclass('loadcell.gateway_audit_logs') IS NOT NULL AND to_regclass('loadcell.audit_logs') IS NULL THEN
        ALTER TABLE loadcell.gateway_audit_logs RENAME TO audit_logs;
    END IF;
END $$;

DROP FUNCTION IF EXISTS loadcell._move_table_if_needed(text, text, text);
