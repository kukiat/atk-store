# ATK Store 🛒

ระบบร้านค้าแบบหยิบสินค้าเองในร้าน: ลูกค้าลงชื่อเข้าใช้ สแกน QR ของสินค้า เปิด session กับอุปกรณ์ IoT และให้จำนวนสินค้าที่หยิบจริงเข้าสู่ตะกร้า เมื่อกล้องขาออกยืนยันตัวตน ระบบจะตัดเงินจาก Wallet สร้างคำสั่งซื้อ และออกใบเสร็จ

## ภาพรวมสำหรับทุกคน

| บทบาท | ใช้ระบบอย่างไร |
| --- | --- |
| 🙋 ลูกค้า | ลงชื่อเข้าใช้ → เข้าร้านผ่านกล้อง → เติม Wallet → สแกน QR → หยิบสินค้า → เดินออกผ่านกล้อง → รับใบเสร็จ |
| 🏪 ผู้ดูแลร้าน | จัดการหน่วยนับ สินค้า QR ใบเสร็จ Wallet และตรวจสถานะ IoT จากหน้า `/admin` |
| 📷 ระบบกล้อง | ส่งภาพจากกล้องเข้า/ออกมาให้ API เพื่อยืนยันใบหน้า เปิด/ปิด visit และเริ่ม checkout |
| ⚙️ ทีม IoT | รับ catalog สินค้า, รับ session UUID และส่ง MQTT loadcell events กลับมา |
| 👩‍💻 ทีมพัฒนา | ดูแล Next.js app, PostgreSQL, integrations และ migrations |

## สิ่งที่มีในระบบ

- 🔐 Google OAuth พร้อม database-backed session และ role: `client`, `admin`, `super_admin`
- 🙂 Face Liveness และ Face Recognition ผ่าน Amazon Rekognition เพื่อยืนยันลูกค้า
- 📷 การเข้า/ออกร้านด้วยกล้อง: เปิด visit ตอนเข้า และ checkout จาก Wallet ตอนออก
- 💳 Wallet เติมเงินผ่าน Stripe (Card / PromptPay) และ ledger สำหรับตรวจสอบยอด
- 📦 Inventory master, หน่วยนับ, import CSV, รูปสินค้า และ QR แบบเดี่ยวหรือหลายสินค้า
- 📱 Mobile-first QR scan และตะกร้าที่อัปเดตจากจำนวนที่ IoT รายงานจริง
- 🤖 IoT inventory session, Server-Sent Events (SSE), MQTT adapter และ MQTT audit log
- 🧾 Order, receipt และหน้าดูใบเสร็จ
- 🛡️ Admin portal สำหรับสินค้า ผู้ใช้ สิทธิ์ การเข้าออก และ IoT PoC

> [!IMPORTANT]
> `script/iot-mqtt-worker.ts` เป็น mock/reference worker สำหรับทดสอบเส้นทาง MQTT ไม่ใช่ production runtime ที่ถูก deploy พร้อมเว็บแอป

## สถาปัตยกรรม

```mermaid
flowchart LR
  Customer["🙋 ลูกค้า\nมือถือ"] --> Web["ATK Store\nNext.js 16"]
  Admin["🏪 ผู้ดูแล"] --> Web
  Web --> Auth["Google OAuth\nSession + Roles"]
  Web --> DB[("PostgreSQL\nauth schema")]
  Web --> Redis["Redis\nCart sync\noptional locally"]
  Web --> Stripe["Stripe\nWallet top-up"]
  Web --> AWS["AWS\nRekognition + S3 + Cognito"]
  Camera["📷 กล้องเข้า/ออก"] -->|"API key + image"| Web
  Web --> IotServer["IoT server\nproduct + pick-sessions"]
  IotServer -->|"MQTT loadcell event/status"| Broker["MQTT broker"]
  Broker --> Worker["MQTT worker\nmock/reference"]
  Worker --> DB
  Web -->|"SSE"| Customer
```

### หลักการแบ่งความรับผิดชอบ

| ส่วน | รับผิดชอบ |
| --- | --- |
| ATK Store | ผู้ใช้, สิทธิ์, inventory catalog, wallet, cart, order, receipt และ customer session |
| IoT server / อุปกรณ์ | การ map สินค้ากับตู้/อุปกรณ์, loadcell, สถานะประตู และการ publish MQTT |
| MQTT broker | ส่งต่อ event ตาม topic ของ session |
| AWS | Liveness, face search/index, เก็บ output ของ liveness และ credential ชั่วคราวสำหรับ browser |
| Stripe | รับชำระเงินเพื่อเติม Wallet และส่ง webhook กลับมา |

## ก่อนเริ่มใช้งาน ✅

ต้องมีสิ่งต่อไปนี้

- Node.js **20.12 ขึ้นไป** และ npm
- PostgreSQL 16 ขึ้นไป หรือ PostgreSQL hosted ที่เชื่อมต่อได้
- Google OAuth Client แบบ Web application สำหรับการลงชื่อเข้าใช้
- Docker (แนะนำ) หากต้องการเปิด PostgreSQL หรือ MQTT บนเครื่อง

สำหรับทดสอบทุก integration เพิ่มเติม ต้องมีบัญชี/สิทธิ์สำหรับ AWS, Stripe, Redis และ IoT server ตาม feature ที่ต้องการทดสอบ

## ติดตั้งและเปิดระบบบนเครื่อง 💻

### 1. Clone และติดตั้ง packages

```bash
git clone <repository-url> atk-store
cd atk-store
npm ci
```

### 2. เปิด PostgreSQL

ต้องมี PostgreSQL แยกต่างหาก ตัวอย่างนี้สร้าง database local ใหม่:

```bash
docker run --name atk-store-postgres \
  -e POSTGRES_USER=atkstore \
  -e POSTGRES_PASSWORD=atkstore \
  -e POSTGRES_DB=atkstore \
  -p 5432:5432 \
  -d postgres:16
```

ถ้ามี PostgreSQL อยู่แล้ว ให้ข้ามขั้นตอนนี้และใช้ connection string ของคุณในขั้นตอนถัดไป

### 3. สร้างไฟล์ environment

```bash
cp .env.example .env
```

อย่างน้อยให้กำหนดค่าต่อไปนี้ใน `.env` ก่อนเปิดเว็บ:

```dotenv
DATABASE_URL=postgres://atkstore:atkstore@localhost:5432/atkstore
DATABASE_SCHEMA=auth

AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
```

ใน Google Cloud Console ให้เพิ่ม Authorized redirect URI นี้ให้ตรงกับ `AUTH_URL`:

```text
http://localhost:3000/api/auth/callback/google
```

### 4. สร้างตารางและข้อมูลตัวอย่าง

```bash
npm run db:migrate
npm run db:seed
```

`db:seed` เพิ่ม roles, ช่องทางเติมเงิน, ลูกค้าตัวอย่าง และ **ล้าง/สร้างใหม่เฉพาะ inventory กับ units** เพื่อให้มีสินค้าทดสอบ จึงไม่ควรรันกับฐานข้อมูลที่มีสินค้าใช้งานจริง

### 5. เปิดเว็บ

```bash
npm run dev
```

เปิด `http://localhost:3000` แล้วลงชื่อเข้าใช้ด้วย Google

ตรวจว่า service ตอบสนองได้โดยไม่ต้อง login:

```bash
curl http://localhost:3000/api/health-check
```

ผลลัพธ์ที่คาดหวัง:

```json
{ "active": true, "message": "OK" }
```

## ตั้งค่า environment ตาม feature 🔧

เก็บ secrets ไว้ใน `.env` เฉพาะเครื่อง/ระบบ deploy ห้าม commit ไฟล์นี้ และห้ามใช้ prefix `NEXT_PUBLIC_` กับ secret ฝั่ง server

| กลุ่ม | ตัวแปรหลัก | ใช้เมื่อ |
| --- | --- | --- |
| ฐานข้อมูล | `DATABASE_URL`, `DATABASE_SCHEMA=auth` | จำเป็นเสมอ |
| เข้าสู่ระบบ | `AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | จำเป็นสำหรับหน้า customer และ admin |
| Face / AWS | `AWS_PROFILE`, `AWS_LIVENESS_REGION`, `AWS_LIVENESS_OUTPUT_BUCKET`, `NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID`, `AWS_FACE_COLLECTION_ID` | ทดสอบการลงทะเบียน/ตรวจใบหน้าและกล้อง |
| Storage | `S3_ACCESS_KEY_ID`, `S3_SECRET_KEY`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ENTRY_IMAGE_FOLDER`, `S3_EXIT_IMAGE_FOLDER` | อัปโหลดรูปสินค้า, QR และรูปจากกล้องที่เปลี่ยนสถานะสำเร็จ |
| Cart sync | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_TLS`, `REDIS_TLS_REJECT_UNAUTHORIZED`, `CART_SYNC_DEBUG` | ใช้ Redis ระหว่างหลาย process; ใช้ `REDIS_TLS_REJECT_UNAUTHORIZED=false` เฉพาะ Redis ที่เชื่อถือได้และใช้ self-signed certificate |
| Wallet | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | เติม Wallet ผ่าน Stripe |
| IoT | `IOT_SERVER_URL`, `IOT_API_KEY`, `BRANCH_CODE` | เชื่อม IoT server จริง |
| MQTT | `MQTT_ENABLED`, `MQTT_BROKER_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `MQTT_CLIENT_ID` | รับ event จาก IoT broker |
| กล้อง | `CLIENT_ATTENDANCE_API_KEY`, `CLIENT_ATTENDANCE_MAX_IMAGE_BYTES` | อนุญาต worker กล้องเรียก attendance API |
| Animation | `ANIMATION_SERVER_URL` | ส่งผล entry/exit และ URL รูปหลังเปลี่ยนสถานะสำเร็จ |
| QR | `ENCODE_KEY` | เข้ารหัส/ถอดรหัส QR payload |

### ค่าตัวอย่างสำหรับ IoT mock แบบไม่ใช้ broker

```dotenv
IOT_SERVER_IS_MOCK=true
IOT_POC_EVENT_TRANSPORT=direct
MQTT_ENABLED=false
BRANCH_CODE=main
```

โหมดนี้เหมาะสำหรับเปิด inventory session และส่ง cumulative picked count / `shelf_closed` จากหน้า `/admin/inventory/iot-poc` โดยไม่ต้องมี IoT server หรือ MQTT broker จริง

### ค่าตัวอย่างสำหรับ MQTT broker ของ IoT

ตั้งค่าตาม broker ที่ IoT ดูแล:

```dotenv
MQTT_ENABLED=true
MQTT_BROKER_URL=mqtts://your-iot-broker:8883
MQTT_USERNAME=your-username
MQTT_PASSWORD=your-password
BRANCH_CODE=main
```

Docker runtime จะเปิด MQTT worker พร้อมเว็บแอป; สำหรับ local development ให้เปิด worker แยกด้วย `npm run iot:mqtt`.

## Flow หลักของร้าน 🧭

```mermaid
sequenceDiagram
  actor Customer as 🙋 ลูกค้า
  participant Camera as 📷 กล้องเข้า
  participant App as ATK Store
  participant Iot as IoT server
  participant MQTT as MQTT broker
  participant Wallet as Wallet
  participant Exit as 📷 กล้องออก

  Customer->>App: Google sign-in
  Camera->>App: ยืนยันตัวตนขาเข้า
  App->>App: สร้าง active visit
  Customer->>App: สแกน QR และเลือกสินค้า
  App->>Iot: GET product + POST pick-sessions(uuid, email, sku)
  App->>App: สร้าง IoT session
  Iot->>MQTT: sessionSummary.takenTotal / shelf_closed
  MQTT->>App: MQTT worker รับ event
  App->>App: อัปเดต cart และแจ้งหน้า mobile ผ่าน SSE
  Exit->>App: ยืนยันตัวตนขาออก
  App->>Wallet: ตัดยอดตาม cart ที่ยืนยันแล้ว
  App->>App: สร้าง order และ receipt
  App-->>Customer: แสดงสถานะชำระเงิน/ใบเสร็จ
```

## Activity diagram แยกตาม feature

### 1) ลงชื่อเข้าใช้และสิทธิ์ 🔐

```mermaid
flowchart TD
  A[เปิดเว็บ] --> B{มี session ที่ใช้ได้ไหม}
  B -- มี --> C[เข้า Home]
  B -- ไม่มี --> D[Google OAuth + PKCE + nonce]
  D --> E{Google token ถูกต้องไหม}
  E -- ไม่ถูกต้อง --> F[กลับหน้า Sign in พร้อม error]
  E -- ถูกต้อง --> G[สร้าง/อัปเดต user]
  G --> H[กำหนด client role และรับ pending role grant]
  H --> I[สร้าง session cookie แบบ httpOnly]
  I --> C
```

### 2) สแกน QR และหยิบสินค้า 📦

```mermaid
flowchart TD
  A[สแกน QR] --> B{มี active visit และ Wallet พร้อมไหม}
  B -- ไม่พร้อม --> C[แจ้งให้เข้าร้าน/เติม Wallet]
  B -- พร้อม --> D[ถอดรหัส inventoryIds]
  D --> E{QR มีสินค้ากี่รายการ}
  E -- 1 --> F[เปิด inventory session]
  E -- มากกว่า 1 --> G[ลูกค้าเลือกสินค้า]
  G --> F
  F --> H[App ขอ product config จาก IoT]
  H --> I[App ส่ง session UUID ให้ IoT]
  I --> J[รอ MQTT event ผ่าน SSE]
  J --> K[sessionSummary.takenTotal สะสม → อัปเดต cart]
  K --> L{status = shelf_closed}
  L -- ไม่ใช่ --> J
  L -- ใช่ --> M[ปิด session และคงยอดสุดท้าย]
```

### 3) เข้า/ออกร้านและ checkout 📷

```mermaid
flowchart TD
  A[กล้องส่ง JPEG/PNG พร้อม API key] --> B[ค้นหาใบหน้าใน Rekognition]
  B --> C{ระบุ user ที่ active ได้ไหม}
  C -- ไม่ได้ --> D[บันทึก unknown/ignored event]
  C -- ได้ และเป็น entry --> E[เปิด active visit]
  C -- ได้ และเป็น exit --> F[ปิด active visit]
  F --> G[อ่าน cart ล่าสุด]
  G --> H{ยอด Wallet เพียงพอไหม}
  H -- ไม่พอ --> I[checkout failed และแจ้งลูกค้า/พนักงาน]
  H -- พอ --> J[ตัด Wallet + สร้าง paid order]
  J --> K[ออก receipt และแจ้งหน้า cart]
```

### 4) เติมเงิน Wallet 💳

```mermaid
flowchart TD
  A[ลูกค้าเลือกจำนวนเงิน/ช่องทาง] --> B[สร้าง Stripe Checkout]
  B --> C[ลูกค้าชำระกับ Stripe]
  C --> D[Stripe ส่ง signed webhook]
  D --> E[ตรวจ signature และบันทึก webhook]
  E --> F{ชำระสำเร็จหรือไม่}
  F -- สำเร็จ --> G[เพิ่ม Wallet ledger และยอดคงเหลือ]
  F -- ไม่สำเร็จ --> H[บันทึกสถานะ failed/cancelled]
```

### 5) จัดการหลังบ้าน 🏪

```mermaid
flowchart TD
  A[ผู้ดูแลลงชื่อเข้าใช้] --> B{มี admin หรือ super_admin role ไหม}
  B -- ไม่มี --> C[กลับหน้า Home]
  B -- มี --> D[เข้า Admin portal]
  D --> E[จัดการ inventory / units / QR / receipt]
  D --> F[ตรวจ users, face attempts, audit log]
  D --> G[ดู attendance และ manual override]
  D --> H[ใช้ IoT PoC ส่ง mock event]
  D --> I{เป็น super_admin ไหม}
  I -- ใช่ --> J[grant/revoke admin]
```

## ตั้งค่าผู้ดูแลคนแรก 👑

ผู้ใช้ใหม่จาก Google จะได้รับ role `client` อัตโนมัติ ดังนั้นหลัง login ครั้งแรก ให้กำหนด `super_admin` หนึ่งคนผ่าน PostgreSQL (แทน `you@example.com`):

```sql
INSERT INTO auth.user_roles (user_id, role_id)
SELECT users.id, roles.id
FROM auth.users AS users
CROSS JOIN auth.roles AS roles
WHERE users.email = 'you@example.com'
  AND roles.code = 'super_admin'
ON CONFLICT DO NOTHING;
```

จากนั้น sign out และ sign in ใหม่ แล้วเข้า `/admin` ได้ ผู้ใช้ `super_admin` เท่านั้นที่เพิ่มหรือจัดการ admin คนอื่นได้

## IoT MQTT contract แบบย่อ 🤖

| รายการ | ค่า |
| --- | --- |
| Event topic | `{uuid}/loadcell/{BRANCH_CODE}/{inventoryId}/event` |
| Status topic | `{uuid}/loadcell/{BRANCH_CODE}/{inventoryId}/status` |
| จำนวนที่ใช้กับตะกร้า | `sessionSummary.takenTotal` เป็น **ยอดสะสมของ session** ไม่ใช่ delta |
| ปิด session | เฉพาะ `status: "shelf_closed"` |
| การตรวจสอบ | branch ใน topic/payload ต้องตรง `BRANCH_CODE`; `sku` (ถ้ามี) ต้องตรง `inventoryId` |
| QoS | 1 สำหรับ broker path |
| Audit | บันทึก raw/JSON payload, ขนาด, topic และผล `processed/rejected/failed` ใน `iot_mqtt_message_logs` |

IoT server เรียก catalog ของแอปได้ที่ `GET /inventories` หรือ `GET /api/iot/catalog/inventories` โดยส่ง `x-iot-api-key` หรือ `Authorization: Bearer <IOT_API_KEY>` เมื่อเปิดใช้งาน key

รายละเอียดเต็มดูที่ [IoT MQTT Integration Spec](note/iot_mqtt_integration_spec.xlsx) และ [Implementation Plan](note/iot_sv_integration_implementation_plan.md)

## โครงสร้างโค้ดที่ควรรู้ 🗂️

```text
src/
├── app/                    # หน้าเว็บ, Route Handlers, Server Actions
│   ├── admin/              # Back-office
│   ├── api/                # Auth, IoT, face, attendance, cart, Stripe
│   ├── inventory/          # หน้ารอ/ติดตาม IoT session
│   ├── scan/               # QR scan และเลือก inventory
│   ├── wallet/             # Wallet top-up
│   └── receipts/           # ใบเสร็จ
├── components/             # UI และ client interactions
├── db/                     # Drizzle schema, connection, seed
├── lib/                    # Auth, security, AWS, Stripe, QR helpers
├── services/               # business logic และ data access (server-only)
└── store/                  # Zustand client cart
script/
└── iot-mqtt-worker.ts      # MQTT worker
drizzle/                    # SQL migrations
docker/                     # Docker startup scripts
```

แนวทางสำคัญ: หน้าและ API เรียก business logic ผ่าน `src/services/` เพื่อไม่ให้กฎธุรกิจซ้ำกัน ส่วน modules ที่เข้าถึงฐานข้อมูลหรือ secrets เป็น server-only

## คำสั่งที่ใช้บ่อย

| คำสั่ง | ใช้ทำอะไร |
| --- | --- |
| `npm run dev` | เปิด development server |
| `npm run build` | ตรวจ production build |
| `npm run start` | เปิด build ที่สร้างแล้ว |
| `npm test` | รัน Vitest |
| `npm run lint` | ตรวจ ESLint |
| `npm run format` | จัดรูปแบบโค้ดด้วย Prettier |
| `npm run db:generate` | สร้าง migration จาก schema ที่แก้ |
| `npm run db:migrate` | ใช้ migrations กับ database |
| `npm run db:push` | push schema ตรง เหมาะกับ local experiment เท่านั้น |
| `npm run db:seed` | เติมข้อมูลตัวอย่าง (มีผล reset inventory/units) |
| `npm run db:studio` | เปิด Drizzle Studio |
| `npm run iot:mqtt` | เปิด MQTT worker |

## ตรวจสอบก่อนส่งงาน ✨

```bash
npm test
npm run lint
npm run build
```

เมื่อแก้ schema ให้ทำตามลำดับนี้:

```bash
npm run db:generate
npm run db:migrate
```

## ข้อควรระวังด้านความปลอดภัย 🔒

- ห้าม commit `.env`, API keys, Stripe secrets, AWS credentials หรือ database URL
- Secrets ของ MQTT, IoT, Stripe, S3 และ AWS ใช้เฉพาะฝั่ง server
- API กล้องต้องส่ง `x-client-attendance-key`; API catalog/IoT ใช้ `IOT_API_KEY`
- Google callback URL ต้องตรงกับ `AUTH_URL` ทุกตัวอักษร
- หน้า admin ตรวจสิทธิ์จาก role ฝั่ง server ไม่ใช่แค่ซ่อนปุ่มใน UI
- Face data: แอปเก็บ metadata/FaceId และ S3 key ไม่เก็บ face vector หรือวิดีโอ selfie ใน PostgreSQL

## แก้ปัญหาที่พบบ่อย 🧩

| อาการ | ตรวจสอบ |
| --- | --- |
| เปิดเว็บแล้ว error เรื่อง database | ตรวจ `DATABASE_URL`, PostgreSQL ทำงานอยู่ และ database มี schema `auth` หลัง `npm run db:migrate` |
| Login Google แล้วกลับหน้าเดิม | ตรวจ `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_URL` และ redirect URI ใน Google Cloud Console |
| เข้าหน้า `/admin` ไม่ได้ | ยืนยันว่า user มี `admin` หรือ `super_admin` ใน `auth.user_roles`; logout/login ใหม่หลังเปลี่ยน role |
| ปุ่มสแกน QR ถูกปิด | ลูกค้าต้องมี active visit จากกล้องขาเข้า, Wallet active และยอดอย่างน้อยเท่าราคาสินค้าต่ำสุด |
| IoT session เปิดได้แต่ตะกร้าไม่เปลี่ยน | ตรวจ `BRANCH_CODE`, topic, `sessionSummary.takenTotal` แบบสะสม, `sku`, worker log และ `iot_mqtt_message_logs` |
| MQTT worker ต่อ broker ไม่ได้ | ตรวจ `MQTT_ENABLED=true`, URL/port/credentials ของ IoT broker |
| Redis local ไม่ทำงาน | local dev จะ fallback เป็น memory; สำหรับหลาย instance ต้องตั้ง Redis ที่เข้าถึงได้จริง |
| Face / wallet ทำงานไม่ครบ | เป็น integration ภายนอก ต้องตั้ง AWS/Cognito/S3 หรือ Stripe variables ให้ครบตาม feature |
