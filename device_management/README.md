# Load Cell Gateway — Device Management Backend

Go Fiber backend สำหรับ Multi-Device Load Cell Platform  
โครงสร้างอ้างอิงจาก `StockManagement/backend` (vertical slice: handler → service → repository)

## โครงสร้างโฟลเดอร์

```text
device_management/
├── main.go
├── external/routers.go          # รวม register routes
├── internal/                    # feature modules (vertical slices)
│   ├── health/
│   ├── mqttconnection/          # Step 3 ✅
│   ├── device/                    # Step 4 ✅
│   ├── mqtt/                      # Step 5 ✅
│   ├── parser/                    # Step 6 ✅
│   ├── telemetry/                 # Step 6–7 ✅
│   ├── command/                   # Step 8 ✅
│   ├── calibration/               # Step 9 ✅
│   ├── destination/               # Step 10 ✅
│   ├── devicedestination/         # Step 10 ✅
│   ├── mapping/                   # Step 10 ✅
│   ├── destination/router/        # Step 11 ✅
│   └── retry/                     # Step 11 ✅
├── domain/model/                # GORM entities (Step 2 ✅)
│   ├── mqtt_connection.go
│   ├── device.go
│   ├── device_calibration.go
│   ├── weight_reading.go
│   └── weight_event.go
├── pkg/
│   ├── config/
│   ├── database/
│   ├── dto/
│   └── redis/
└── migrations/                  # SQL migrations (ไม่ใช้ AutoMigrate)
```

## Quick Start

```bash
cd device_management
cp .env.example .env   # แก้ค่า DB / Redis ตามสภาพแวดล้อม

# รัน migration (ใช้ DB_NAME จาก .env)
make migrate

# รัน server
make run

# ตรวจ health
make health
```

**Remote DB (hexdas):** ใช้ `DB_NAME=atkstore` ตาม `.env` — ไม่ต้องสร้าง database ใหม่

## Health Check

```bash
curl http://localhost:8081/health
```

**Response ตัวอย่าง (Step 11):**

```json
{
  "status": "degraded",
  "service": { "name": "loadcell-gateway", "version": "0.1.0", "step": 11 },
  "dependencies": { "postgres": true, "schema": true, "redis": false },
  "time": "2026-06-24T10:00:00+07:00"
}
```

`status: ok` = postgres + schema + redis ครบ · `degraded` = ขาด redis หรือ schema ยังไม่ migrate

## Redis

| สภาพแวดล้อม | URL | TLS |
|---|---|---|
| ภายใน Docker | `redis://:P%40ssr3d%21@redis:6379` | ไม่ใช้ |
| ภายนอก (DNS) | `rediss://:P%40ssr3d%21@redis.hexdas.cloud:6379` | **ต้องใช้เสมอ** |

## MQTT Broker (Hexdas RabbitMQ)

| ใช้กับ | ใช้ได้? | ค่าที่ใส่ใน API |
|---|---|---|
| **MQTT TCP + TLS** (Gateway, ESP32, Node-RED) | ✅ **ใช้ตัวนี้** | host `mqtt.hexdas.cloud`, port `1883`, protocol `mqtts`, `use_tls: true` |
| MQTT WebSocket (`wss://mqttws.hexdas.cloud/ws`) | ❌ | สำหรับ Browser/Web app เท่านั้น — backend Go ไม่ใช้ |
| AMQP (`76.13.209.136:5672`) | ❌ | โปรtocol คนละแบบกับ MQTT |
| RabbitMQ Management UI | ❌ | เปิดดู queue ผ่านเว็บ — ไม่ใช่ connection ของ gateway |

**ค่า MQTT ที่ Gateway ต้องใช้:**

```json
{
  "connection_name": "hexdas-rabbitmq",
  "protocol": "mqtts",
  "host": "mqtt.hexdas.cloud",
  "port": 1883,
  "username": "rabbitmqadmin",
  "use_tls": true,
  "enabled": true
}
```

> Traefik terminate TLS ที่ port 1883 — client ต้องเปิด SSL/TLS (`use_tls: true`)  
> ไม่ต้องใส่ CA certificate ถ้า broker ใช้ cert จาก public CA

**Seed ผ่าน script** (ตั้ง `MQTT_SEED_*` ใน `.env` แล้วรัน server):

```bash
chmod +x scripts/seed-hexdas-mqtt.sh
source .env 2>/dev/null || export $(grep -v '^#' .env | xargs)
./scripts/seed-hexdas-mqtt.sh
```


ตั้งค่าใน `.env`:

```env
REDIS_URL=rediss://:P%40ssr3d%21@redis.hexdas.cloud:6379
```

> Password `P@ssr3d!` ต้อง URL-encode ใน connection string: `@` → `%40`, `!` → `%21`

## Development Steps

ดูรายละเอียดแต่ละ step ใน `documents/multi-device-load-cell-platform.md` §37
