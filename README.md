# ATK Store — Smart Shelf Scan-to-Shop (Starter)

เว็บร้านค้าแบบ **mobile-first** ที่ลูกค้าใช้มือถือ **สแกน QR ที่ชั้นวาง (smart shelf)** เพื่อดูสินค้าบนชั้นนั้น แล้วใส่ตะกร้า โปรเจกต์นี้วางโครง flow หลักไว้ให้ต่อยอด payment และ order

Flow: `สแกน QR ชั้นวาง → /shelf/[id] → เลือกสินค้า → /cart`

## Tech Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui**
- **Drizzle ORM** + **PostgreSQL** (`postgres-js` driver)
- **Zustand** (+ `persist`) — ตะกร้าฝั่ง client (localStorage)

## Google Authentication

- Google OAuth 2.0 Authorization Code Flow พร้อม `state`, PKCE และ nonce
- server ตรวจ Google ID token ก่อนสร้าง session
- browser ใช้ opaque httpOnly session cookie; PostgreSQL เก็บเฉพาะ SHA-256 hash ของ token
- private Route Handlers ในอนาคตต้องเรียก `requireCurrentUser()`; `proxy.ts` มีหน้าที่ redirect UX เท่านั้น

## โครงสร้างชั้น (architecture)

```
app/page.tsx (Server Component) ─┐
app/api/shelf/[id]/route.ts      ─┴─► services/*  ─► Drizzle ─► Postgres
                                     (business logic + data access, server-only)
```

ทั้ง Server Component และ API route เรียกผ่าน **service เดียวกัน** (`src/services/`) — logic ไม่ซ้ำ

## เริ่มใช้งาน (Getting Started)

ต้องมี **Node 20.12+** และ **Docker** (สำหรับ Postgres local)

```bash
# 1) ติดตั้ง dependencies
npm install

# 2) เตรียม env
cp .env.example .env

# 3) รัน Postgres (Docker)
docker compose up -d

# 4) สร้างตารางในฐานข้อมูล
npm run db:push

# 5) ใส่ข้อมูลตัวอย่าง (ชั้น A12, B03 + สินค้า)
npm run db:seed

# 6) รัน dev server
npm run dev
```

เปิด http://localhost:3000 — แนะนำให้ทดสอบใน **mobile viewport** (DevTools)
ลองเปิดหน้าชั้นวางได้เลย: `/shelf/A12` หรือ `/shelf/B03`

## NPM Scripts

| คำสั่ง                        | ทำอะไร                                   |
| ----------------------------- | ---------------------------------------- |
| `npm run dev`                 | รัน dev server                           |
| `npm run build` / `npm start` | build / รัน production                   |
| `npm run lint`                | ESLint                                   |
| `npm run format`              | จัดรูปแบบโค้ดด้วย Prettier               |
| `npm run db:generate`         | สร้าง SQL migration จาก schema           |
| `npm run db:migrate`          | รัน migration                            |
| `npm run db:push`             | push schema เข้า DB ตรง ๆ (เหมาะกับ dev) |
| `npm run db:seed`             | ใส่ข้อมูลตัวอย่าง                        |
| `npm run db:studio`           | เปิด Drizzle Studio ดูข้อมูลใน DB        |

## โครงไฟล์หลัก

```
src/
├── app/
│   ├── page.tsx              # landing — ปุ่มทดลองไปหน้าชั้นวาง
│   ├── shelf/[id]/page.tsx   # สินค้าบนชั้น (Server Component → service)
│   ├── cart/page.tsx         # ตะกร้า (client, Zustand)
│   └── api/shelf/[id]/route.ts
├── components/               # product-card, cart-bar, quantity-stepper, ui/ (shadcn)
├── db/                       # schema.ts, index.ts (drizzle client), seed.ts
├── services/                 # business logic + data access (server-only)
├── store/cart.ts             # Zustand cart store (persist → localStorage)
├── lib/                      # auth, Google ID-token validation, format, hooks, utils
└── types/index.ts
```

## ยังไม่ได้ทำ (ตั้งใจเว้นไว้ให้ต่อยอด)

ค้นหา `TODO(...)` ในโค้ดได้:

- `TODO(payment)` — checkout / payment จริง (PromptPay, บัตร)
- `TODO(order)` — แปลงตะกร้า client → order table ใน Postgres
  นอกจากนี้: การ generate QR ของแต่ละชั้น, admin panel, deploy/CI

## ต่อ Postgres แบบ hosted

แค่เปลี่ยน `DATABASE_URL` ใน `.env` ไปชี้ Neon / Supabase / ฯลฯ — โค้ดส่วนอื่นไม่ต้องแก้
