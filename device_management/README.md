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
│   ├── mqttconnection/          # Step 2
│   ├── device/                  # Step 3
│   ├── telemetry/               # Step 6
│   ├── calibration/             # Step 10
│   └── destination/             # Step 12
├── domain/model/                # GORM entities
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

**Response ตัวอย่าง (Step 1 สำเร็จ):**

```json
{
  "status": "ok",
  "service": { "name": "loadcell-gateway", "version": "0.1.0", "step": 1 },
  "dependencies": { "postgres": true, "redis": true },
  "time": "2026-06-24T10:00:00+07:00"
}
```

`status: degraded` = PostgreSQL หรือ Redis ยังเชื่อมไม่ได้

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
