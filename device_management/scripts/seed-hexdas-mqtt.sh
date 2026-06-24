#!/usr/bin/env bash
# สร้าง MQTT connection สำหรับ Hexdas RabbitMQ (TCP + TLS, port 1883)
# ใช้กับ Load Cell Gateway backend + ESP32 / Node-RED
#
# Usage:
#   ./scripts/seed-hexdas-mqtt.sh
#   API_BASE=http://localhost:8081 ./scripts/seed-hexdas-mqtt.sh

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8081}"
CONNECTION_NAME="${MQTT_SEED_NAME:-hexdas-rabbitmq}"
HOST="${MQTT_SEED_HOST:-mqtt.hexdas.cloud}"
PORT="${MQTT_SEED_PORT:-1883}"
USERNAME="${MQTT_SEED_USERNAME:-rabbitmqadmin}"
PASSWORD="${MQTT_SEED_PASSWORD:?set MQTT_SEED_PASSWORD in .env or environment}"

echo "→ POST ${API_BASE}/api/v1/mqtt-connections (${CONNECTION_NAME})"

RESP=$(curl -sS -w "\n%{http_code}" -X POST "${API_BASE}/api/v1/mqtt-connections" \
  -H "Content-Type: application/json" \
  -d "$(cat <<EOF
{
  "connection_name": "${CONNECTION_NAME}",
  "protocol": "mqtts",
  "host": "${HOST}",
  "port": ${PORT},
  "username": "${USERNAME}",
  "password": "${PASSWORD}",
  "use_tls": true,
  "enabled": true,
  "connect_timeout_seconds": 10,
  "keep_alive_seconds": 60,
  "reconnect_interval_seconds": 5,
  "client_id_prefix": "loadcell-gateway"
}
EOF
)")

BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -n 1)

echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"

if [[ "$CODE" == "201" ]]; then
  ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || true)
  if [[ -n "${ID:-}" ]]; then
    echo "→ POST ${API_BASE}/api/v1/mqtt-connections/${ID}/test"
    curl -sS -X POST "${API_BASE}/api/v1/mqtt-connections/${ID}/test" | python3 -m json.tool 2>/dev/null || true
  fi
  exit 0
fi

if [[ "$CODE" == "409" ]]; then
  echo "connection already exists — skip or rename MQTT_SEED_NAME"
  exit 0
fi

echo "failed (HTTP ${CODE})" >&2
exit 1
