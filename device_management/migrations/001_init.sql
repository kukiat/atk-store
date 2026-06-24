-- Step 1: bootstrap extensions for Load Cell Gateway
-- Apply: psql -U postgres -d loadcell_gateway -f migrations/001_init.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
