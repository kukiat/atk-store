#!/usr/bin/env bash
# สร้าง / sync mock devices 10 ตัวผ่าน API (ต้องรัน backend อยู่)
#
# Usage:
#   ./scripts/seed-mock-devices.sh
#   API_BASE=http://localhost:8081 ADMIN_PASSWORD=admin123 ./scripts/seed-mock-devices.sh

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8081}"
ADMIN_USER="${ADMIN_USERNAME:-admin}"
ADMIN_PASS="${ADMIN_PASSWORD:?set ADMIN_PASSWORD in .env or environment}"

LOCATIONS=(
  "Warehouse A — Bay 1"
  "Warehouse A — Bay 2"
  "Warehouse B — Dock"
  "Production Line 1"
  "Production Line 2"
  "Shipping Zone"
  "Receiving Zone"
  "Cold Storage"
  "QC Station"
  "Packaging Line"
)

BRANCHES=(
  "wh-a"
  "wh-a"
  "wh-b"
  "prod"
  "prod"
  "logistics"
  "logistics"
  "cold"
  "qc"
  "pack"
)

echo "→ POST ${API_BASE}/api/v1/auth/login"
TOKEN=$(curl -sS -X POST "${API_BASE}/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${ADMIN_USER}\",\"password\":\"${ADMIN_PASS}\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

created=0
updated=0
skipped=0

for i in $(seq 0 9); do
  id=$((10001 + i))
  name=$(printf "Load Cell %02d" $((i + 1)))
  loc="${LOCATIONS[$i]}"
  branch="${BRANCHES[$i]}"

  RESP=$(curl -sS -w "\n%{http_code}" -X POST "${API_BASE}/api/v1/devices" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"device_id\":\"${id}\",\"device_name\":\"${name}\",\"location\":\"${loc}\",\"branch\":\"${branch}\",\"model\":\"HX711-v2\"}")

  CODE=$(echo "$RESP" | tail -n 1)
  BODY=$(echo "$RESP" | sed '$d')

  if [[ "$CODE" == "201" ]]; then
    echo "  ✓ ${id} — ${name} (${branch})"
    created=$((created + 1))
  elif [[ "$CODE" == "409" ]] || echo "$BODY" | grep -qi "already exists"; then
    SYNC=$(curl -sS -w "\n%{http_code}" -X PUT "${API_BASE}/api/v1/devices/${id}" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{\"device_name\":\"${name}\",\"location\":\"${loc}\",\"branch\":\"${branch}\"}")
    SYNC_CODE=$(echo "$SYNC" | tail -n 1)
    if [[ "$SYNC_CODE" == "200" ]]; then
      echo "  ↻ ${id} — synced (${branch})"
      updated=$((updated + 1))
    else
      echo "  · ${id} — exists, sync failed HTTP ${SYNC_CODE}" >&2
      skipped=$((skipped + 1))
    fi
  else
    echo "  ✗ ${id} — HTTP ${CODE}: ${BODY}" >&2
    exit 1
  fi
done

echo "done — created ${created}, synced ${updated}, skipped ${skipped}"
