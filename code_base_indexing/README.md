# Code Base Indexing

Generated: 2026-07-15 Asia/Bangkok

ชุดเอกสารนี้เป็นแผนที่ของ codebase ปัจจุบันของ **ATK Store** สำหรับอ่านเร็ว, onboard คนใหม่, ทำ review, หรือให้ agent เข้าใจโปรเจกต์ก่อนแก้โค้ด

## Quick Facts

- Stack หลัก: Next.js 16.2.9, React 19.2.4, TypeScript, Tailwind CSS v4, Drizzle ORM, PostgreSQL
- Domain หลัก: auth, face liveness/recognition, wallet, inventory/QR, IoT smart shelf, order/receipt, admin/backdoor
- Source ปัจจุบัน: 163 TS/TSX files, 29 pages, 28 route handlers, 4 server-action files
- Data model: 29 tables, 27 enums จาก `src/db/schema.ts`
- Redis: optional cache/pub-sub layer สำหรับ active cart และ IoT SSE fan-out; ถ้าไม่พร้อมระบบ fallback เป็น in-memory/local listener ใน process เดียว

## Files

1. [01-overview.md](./01-overview.md) — ภาพรวม architecture, flow และ external services
2. [02-file-index.md](./02-file-index.md) — รายการไฟล์ตามกลุ่ม พร้อมหน้าที่ของแต่ละไฟล์
3. [03-symbols.md](./03-symbols.md) — exported symbols/services/components/routes ที่สำคัญ
4. [04-data-model.md](./04-data-model.md) — database tables, enums, relations และ business states
5. [05-routes.md](./05-routes.md) — pages, API routes, server actions และ request flow
6. [index.json](./index.json) — machine-readable index สำหรับ tooling/agent
