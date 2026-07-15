# คู่มือการใช้งาน ATK Store

เอกสารนี้อธิบายวิธีเปิดระบบและวิธีใช้งาน project ในมุมของคนที่ต้องลองเล่น demo, ตรวจ flow หน้าร้าน, หรือส่งต่อให้ทีมอื่นทำงานต่อได้เร็วขึ้น

## ภาพรวมสั้น ๆ

ATK Store คือระบบร้านค้าแบบหยิบสินค้าเอง ลูกค้า sign in ด้วย Google, เดินเข้าร้านผ่านกล้อง, เติม wallet, สแกน QR ของสินค้า, หยิบสินค้าจากตู้, แล้วระบบจะอัปเดตตะกร้าจากจำนวนที่ IoT ส่งกลับมา เมื่อกล้องขาออกยืนยันตัวตน ระบบจะตัดเงินจาก wallet และออก receipt อัตโนมัติ

## บทบาทผู้ใช้งาน

| บทบาท             | ใช้ระบบเพื่อ                                                  |
| ----------------- | ------------------------------------------------------------- |
| ลูกค้า            | เข้าใช้ร้าน, เติม wallet, สแกน QR, ดูตะกร้า, รับ receipt      |
| Admin             | จัดการสินค้า, QR, user, wallet, order, alert และ demo control |
| Super Admin       | ทำได้เหมือน admin และเพิ่ม/ถอน admin role                     |
| Camera worker     | เรียก API เพื่อส่งภาพเข้าระบบ entry/exit                      |
| IoT / MQTT worker | ส่งสถานะ loadcell และ shelf closed กลับเข้าระบบ               |

## เตรียมเครื่องก่อนเริ่ม

ต้องมีสิ่งต่อไปนี้ก่อนเปิดระบบ:

- Node.js 20.12 ขึ้นไป
- npm
- PostgreSQL ที่เชื่อมต่อได้
- Google OAuth Client สำหรับ sign in
- Docker ถ้าต้องการเปิด MQTT broker local
- AWS, Stripe, Redis, IoT server ตาม feature ที่ต้องการทดสอบจริง

## ติดตั้งและเปิดระบบ

```bash
npm ci
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

เปิดเว็บที่ `http://localhost:3000`

ตรวจ health check ได้ที่:

```bash
curl http://localhost:3000/api/health-check
```

ผลที่ควรได้คือ:

```json
{ "active": true, "message": "OK" }
```

## Environment ที่ต้องสนใจ

| กลุ่ม    | ตัวแปรหลัก                                                                                                                           | ใช้กับ                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| Database | `DATABASE_URL`, `DATABASE_SCHEMA`                                                                                                    | Drizzle/PostgreSQL                      |
| Auth     | `AUTH_URL`, `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                                                                | Google sign in และ session              |
| Face     | `AWS_PROFILE`, `AWS_LIVENESS_REGION`, `AWS_LIVENESS_OUTPUT_BUCKET`, `NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID`, `AWS_FACE_COLLECTION_ID` | Face Liveness และ Face Recognition      |
| Storage  | `S3_ACCESS_KEY_ID`, `S3_SECRET_KEY`, `S3_ENDPOINT`, `S3_BUCKET`                                                                      | อัปโหลดรูปสินค้าและ QR                  |
| Wallet   | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`                                                   | เติมเงินและรับ webhook                  |
| IoT      | `IOT_SERVER_URL`, `IOT_API_KEY`, `IOT_SERVER_IS_MOCK`, `BRANCH_CODE`                                                                 | เปิด pick session และดึง product config |
| MQTT     | `MQTT_ENABLED`, `MQTT_BROKER_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `MQTT_CLIENT_ID`                                                | รับ loadcell event ผ่าน broker          |
| Camera   | `CLIENT_ATTENDANCE_API_KEY`, `CLIENT_ATTENDANCE_MAX_IMAGE_BYTES`                                                                     | API สำหรับกล้อง entry/exit              |
| QR       | `ENCODE_KEY`                                                                                                                         | encode/decode QR payload                |

## วิธีลองเล่น flow ลูกค้า

1. Sign in ด้วย Google ที่ `/signin`
2. ลงทะเบียนใบหน้า ถ้า Home แสดง prompt ให้ไปที่ `/register-face`
3. ให้ user มีสถานะเข้าร้านก่อน โดยใช้กล้อง entry จริง หรือใช้ back-office manual override ที่ `/admin/attendance`
4. เติม wallet ที่ `/wallet`
5. กลับ Home แล้วกด `สแกน QR`
6. สแกน QR ที่สร้างจาก `/admin/inventory/qr`
7. ถ้า QR มีหลายสินค้า ให้เลือกสินค้าบน `/scan/inventories`
8. หน้า `/inventory/[id]` จะเปิด IoT session และรอจำนวนสินค้าจาก IoT
9. ใช้ `/admin/inventory/iot-poc` ส่ง mock picked count หรือส่ง MQTT event จริง
10. ดูตะกร้าที่ `/cart`
11. ให้กล้อง exit หรือ `/admin/attendance` กด `Set Exit`
12. ระบบจะตัด wallet, สร้าง order, สร้าง receipt และพากลับ Home พร้อม notice

## วิธีลองเล่นแบบ mock ไม่พึ่ง IoT จริง

ตั้งค่า `.env` ประมาณนี้:

```dotenv
IOT_SERVER_IS_MOCK=true
IOT_POC_EVENT_TRANSPORT=direct
MQTT_ENABLED=false
BRANCH_CODE=main
```

จากนั้น:

1. เปิดเว็บด้วย `npm run dev`
2. ให้ลูกค้า scan inventory QR เพื่อสร้าง IoT session
3. เปิด `/admin/inventory/iot-poc`
4. ปรับ `Cumulative count` และ `Current qty`
5. กด `Send count`
6. กด `Door closed` เมื่ออยากปิด session

## วิธีลอง MQTT local

```bash
docker compose up -d
```

ตั้งค่า:

```dotenv
MQTT_ENABLED=true
MQTT_BROKER_URL=mqtt://localhost:1883
BRANCH_CODE=main
```

เปิด worker:

```bash
npm run iot:mqtt
```

ถ้าใช้ `/admin/inventory/iot-poc` ร่วมกับ MQTT ให้ตั้ง:

```dotenv
IOT_POC_EVENT_TRANSPORT=mqtt
```

## งานหลังบ้านที่ใช้บ่อย

| หน้า                                | งานหลัก                                                           |
| ----------------------------------- | ----------------------------------------------------------------- |
| `/admin/users`                      | ดูลูกค้า/admin, grant admin, เข้าหน้ารายละเอียด user              |
| `/admin/users/[id]`                 | block, disable, reset face enrollment, revoke admin, ดู audit log |
| `/admin/inventory`                  | ดู summary ของ inventory, QR, alerts                              |
| `/admin/inventory/units`            | เพิ่ม/แก้/ลบ unit                                                 |
| `/admin/inventory/items`            | เพิ่ม/แก้/ลบ/import inventory                                     |
| `/admin/inventory/qr`               | สร้าง QR แบบสินค้าเดี่ยวหรือ grouped QR                           |
| `/admin/inventory/orders`           | ดู notifications และ orders ล่าสุด                                |
| `/admin/inventory/receipt-settings` | ตั้งค่าหน้าร้าน, VAT, receipt prefix                              |
| `/admin/inventory/iot-poc`          | ส่ง mock IoT event                                                |
| `/admin/wallets`                    | ดู wallet balance, top-up intents, Stripe webhook events          |
| `/admin/attendance`                 | manual override สถานะ inside/exit สำหรับ demo                     |

## Commands สำหรับ developer

| Command               | ใช้ทำอะไร                                     |
| --------------------- | --------------------------------------------- |
| `npm run dev`         | เปิด Next.js dev server                       |
| `npm run build`       | build production                              |
| `npm run start`       | serve production build                        |
| `npm run lint`        | ตรวจ ESLint                                   |
| `npm run test`        | รัน Vitest                                    |
| `npm run db:generate` | generate Drizzle migration                    |
| `npm run db:migrate`  | apply migration                               |
| `npm run db:push`     | push schema ตรงไป DB สำหรับ dev               |
| `npm run db:seed`     | seed roles, wallet channels และข้อมูลตัวอย่าง |
| `npm run db:studio`   | เปิด Drizzle Studio                           |
| `npm run iot:mqtt`    | เปิด MQTT worker                              |

## ข้อควรระวัง

- `db:seed` อาจล้าง/สร้างข้อมูลบางกลุ่มใหม่ตาม script ปัจจุบัน อย่ารันบนข้อมูล production
- `.env` ห้าม commit เพราะมี secrets
- หน้า scan ใช้ได้เมื่อ user มี active visit และ wallet พร้อมเท่านั้น
- `/admin/inventory/iot-poc` และ `/admin/attendance` เป็นเครื่องมือ demo/backdoor ไม่ใช่ path สำหรับลูกค้าจริง
- Face flow ไม่ควร auto-start camera ต้องให้ user กดเริ่มเอง
- Checkout เกิดจาก exit camera หรือ manual exit ไม่ได้เกิดจากปุ่มใน cart

## Glossary

| คำ           | ความหมายใน project นี้                                               |
| ------------ | -------------------------------------------------------------------- |
| Wallet       | กระเป๋าเงินในระบบ ใช้เติมเงินและตัดยอดตอน checkout                   |
| Active visit | รอบที่ลูกค้าอยู่ในร้าน สร้างเมื่อ entry camera จำหน้าได้             |
| Checkout     | ขั้นตอนตัด wallet และสร้าง order/receipt ตอนออกจากร้าน               |
| Inventory    | master สินค้าที่ขายในระบบหลังบ้าน                                    |
| QR payload   | ข้อมูลที่ encode อยู่ใน QR ใช้บอกว่ามี inventory อะไรบ้าง            |
| Grouped QR   | QR หนึ่งใบที่ผูกหลาย inventory ให้ลูกค้าเลือกก่อนเปิด session        |
| IoT session  | session ระหว่างลูกค้า สินค้า และอุปกรณ์ IoT หลังสแกน QR              |
| Picked count | จำนวนสะสมที่ IoT แจ้งว่าลูกค้าหยิบไป                                 |
| Backdoor     | หน้าหลังบ้านสำหรับ demo/mock status ไม่ใช่ flow production ของลูกค้า |
