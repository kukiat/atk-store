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
│   └── device/                  # Step 4 ✅
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

**Response ตัวอย่าง (Step 2 สำเร็จ):**

```json
{
  "status": "degraded",
  "service": { "name": "loadcell-gateway", "version": "0.1.0", "step": 2 },
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

ตั้งค่าใน `.env`:

```env
REDIS_URL=rediss://:P%40ssr3d%21@redis.hexdas.cloud:6379
```

> Password `P@ssr3d!` ต้อง URL-encode ใน connection string: `@` → `%40`, `!` → `%21`

## Development Steps

ดูรายละเอียดแต่ละ step ใน `documents/multi-device-load-cell-platform.md` §37
