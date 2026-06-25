<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Load Cell platform architecture

**Frontend (`/loadcell`)** — config and monitor only:

- **Monitor** — live device weight/status (WebSocket from backend), dashboards, delivery logs, config change history
- **Config** — devices, MQTT broker, data destinations, users, audit

**Backend (`device_management/`)** — all data processing:

- MQTT subscribe/publish, telemetry parse & store, route to external APIs, retry/delivery logs
- Frontend must not connect to MQTT brokers or run delivery logic; it calls REST/WS APIs only
