#!/usr/bin/env bash
set -euo pipefail

DB_NAME="${DB_NAME:-atkstore}"
DB_USER="${DB_USER:-atkadmin}"
DB_HOST="${DB_HOST:-postgres.hexdas.cloud}"
DB_PORT="${DB_PORT:-5432}"
export PGPASSWORD="${DB_PASSWORD:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$(cd "$SCRIPT_DIR/../migrations" && pwd)"

if [ -z "${PGPASSWORD}" ]; then
  echo "[init-db] warning: DB_PASSWORD not set — psql may prompt for password"
fi

echo "[init-db] target: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"

for file in "$MIGRATIONS_DIR"/*.sql; do
  echo "[init-db] applying $(basename "$file")"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$file"
done

echo "[init-db] done"
