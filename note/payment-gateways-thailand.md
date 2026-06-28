# Payment Gateway ในไทย — สรุปรายละเอียด ค่าใช้จ่าย และวิธีใช้งาน

> เอกสารประกอบการตัดสินใจเลือก provider สำหรับ POC payment gateway
> อัปเดตข้อมูลค่าธรรมเนียม: มิถุนายน 2026 (rate มาตรฐานหน้าเว็บ — ต่อรองได้ตามปริมาณธุรกรรม)

---

## สารบัญ

1. [ภาพรวมตัวเลือก](#1-ภาพรวมตัวเลือก)
2. [ตารางค่าธรรมเนียม](#2-ตารางคาธรรมเนยม)
3. [วิธีใช้งานแต่ละแบบ](#3-วธใชงานแตละแบบ)
4. [การต่อตรงธนาคาร](#4-การตอตรงธนาคาร)
5. [คำแนะนำสำหรับ POC นี้](#5-คำแนะนำสำหรบ-poc-น)
6. [map กับโปรเจกต์](#6-map-กบโปรเจกต)
7. [แหล่งอ้างอิง](#7-แหลงอางอง)

---

## 1. ภาพรวมตัวเลือก

### กลุ่ม Aggregator (คนกลางคุยกับทุกธนาคารให้)

| Provider | จุดเด่น | เหมาะกับ |
|----------|---------|----------|
| **Omise (Opn Payments)** | DX/เอกสารดีที่สุด, sandbox ครบ, SDK หลายภาษา | startup/SME เริ่มเร็ว |
| **2C2P** | enterprise-grade, รองรับหลายประเทศ (เครือ Ant Group) | ธุรกิจใหญ่/ข้ามประเทศ |
| **GB Prime Pay (Xendit)** | ค่าธรรมเนียม PromptPay ถูก, เจ้าไทย | SME ไทย |
| **Paysolutions** | เจ้าเก่าแก่ ช่องทางครบ | SME ไทย |

### กลุ่ม Global ที่ใช้ในไทยได้

| Provider | จุดเด่น | เหมาะกับ |
|----------|---------|----------|
| **Stripe** | DX ดีมาก, รองรับไทยแล้ว (บัตร + PromptPay) | ขายต่างประเทศด้วย |
| **PayPal** | เน้นรับเงินต่างประเทศ | ลูกค้าต่างชาติ |

### กลุ่ม Bank Gateway (ต่อตรงธนาคาร)

SCB, KBank, Krungsri, BBL, KTB — ค่าธรรมเนียมต่ำกว่าแต่ integrate เองทีละแบงก์ (ดูหัวข้อ 4)

### ช่องทางจ่าย (Payment Methods)

- **PromptPay** — มาตรฐาน QR กลาง (EMVCo) ทุก gateway รองรับ
- **บัตรเครดิต/เดบิต** — Visa, Mastercard, JCB, UnionPay
- **e-Wallet** — TrueMoney, Rabbit LINE Pay, ShopeePay
- **ต่างชาติ** — Alipay, WeChat Pay (นักท่องเที่ยว)
- **Internet Banking / Installment**

---

## 2. ตารางค่าธรรมเนียม

| Gateway | บัตรเครดิต/เดบิต | PromptPay/QR | e-Wallet | ค่าแรกเข้า/รายเดือน | หมายเหตุ |
|---------|----------------|--------------|----------|-------------------|----------|
| **Omise (Opn)** | **3.65%** | **1.65%** | 3.65% | ไม่มี | + VAT 7% |
| **GB Prime Pay / Xendit** | ~3.2–3.65% | **0.8–1.8%** | varies | ไม่มี | PromptPay ถูกสุด |
| **2C2P** | ~3.0–3.65% | ต่อรองได้ | varies | ขึ้นกับดีล | ราคาไม่เปิด ต้องขอใบเสนอราคา |
| **Stripe** | ~3.65% + ฿11/รายการ | รองรับ | — | ไม่มี | เหมาะขายต่างประเทศ |
| **ต่อตรงธนาคาร (SCB/KBank QR)** | ~1.5–2.5% | **ฟรี–ไม่กี่บาท/รายการ** | — | อาจมีขั้นต่ำ | ถูกสุด แต่ integrate เอง |

> ⚠️ **ข้อควรรู้**
> - ทุกเจ้าบวก **VAT 7%** บนค่าธรรมเนียม
> - ตัวเลขจริง **ต่อรองได้** ตามปริมาณธุรกรรม
> - **PromptPay ถูกกว่าบัตรเครดิต 2–4 เท่าเสมอ** → เริ่มที่ PromptPay คุ้มสุดสำหรับ POC

---

## 3. วิธีใช้งานแต่ละแบบ

### แบบ A — ใช้ Aggregator (Omise/2C2P/GBPrimePay) ← ง่ายสุด

```
1. สมัคร merchant + ได้ public/secret key (มี sandbox ทันที)
2. Frontend ส่งข้อมูลบัตรให้ provider โดยตรง → ได้ token กลับ
   (เงิน/บัตรไม่ผ่าน server เรา = อยู่ PCI scope SAQ-A ปลอดภัย)
3. Backend เรียก createCharge ด้วย token
4. รับ webhook ยืนยันผล → อัปเดต order
```

**เหมาะกับ:** อยากได้เร็ว ครบทุกช่องทาง ยอมจ่าย ~3.65%

### แบบ B — PromptPay QR (ใช้ได้ทั้ง aggregator และต่อตรงแบงก์) ← แนะนำ POC

```
1. Backend ขอ Dynamic QR (ผูก amount + reference)
2. แสดง QR ให้ลูกค้าสแกนจ่ายผ่านแอปธนาคารใดก็ได้
3. รับ webhook/callback เมื่อจ่ายสำเร็จ
4. (สำรอง) Slip Verification API กันสลิปปลอม
```

**เหมาะกับ:** ค่าธรรมเนียมต่ำ ไม่ต้องเข้า PCI scope บัตร

### แบบ C — ต่อตรงธนาคาร (SCB/KBank API)

```
1. สมัคร Developer Portal → sandbox (ทำได้เลย ไม่ต้องเป็นบริษัท)
2. เปิด merchant production (ต้องมีนิติบุคคล + ผ่าน security review)
3. เรียก Bank QR API ออก Dynamic QR
4. รับ callback ของแบงก์ → map เป็น status กลาง
```

**เหมาะกับ:** ปริมาณเยอะ อยากได้ค่าธรรมเนียมต่ำสุด ยอมแลกกับ integrate เอง

---

## 4. การต่อตรงธนาคาร

### ความพร้อมของแต่ละธนาคาร

| ธนาคาร | API / Portal | ช่องทางที่รองรับ | Dev Experience | เหมาะกับ POC |
|--------|-------------|------------------|----------------|-------------|
| **SCB (ไทยพาณิชย์)** | SCB Developer Portal (มี sandbox ชัด) | PromptPay QR, Credit Card, Bill Payment, Deeplink, Slip verify | ⭐⭐⭐⭐⭐ | ✅ แนะนำเริ่มที่นี่ |
| **KBank (กสิกร)** | apiportal.kasikornbank.com (มี sandbox) | PromptPay QR, Credit Card, Inquiry, Slip verify | ⭐⭐⭐⭐ | ✅ |
| **Krungsri (กรุงศรี)** | Krungsri API / Simple Pay | QR, payment gateway | ⭐⭐⭐ | ▲ |
| **BBL (กรุงเทพ)** | Bualuang iPay (คุยกับ RM) | QR, gateway | ⭐⭐ | ▲ |
| **KTB (กรุงไทย)** | Krungthai (เน้นภาครัฐ) | QR, e-payment | ⭐⭐ | ▲ |

### ระบบกลาง — PromptPay / ITMX

ระบบจ่ายเงินไทยส่วนใหญ่วิ่งผ่าน **National ITMX** ที่คุม PromptPay

- **PromptPay QR** = มาตรฐาน EMVCo QR กลาง → ทุกธนาคารใช้ format เดียวกัน
- **2 รูปแบบ QR:**
  - *Static* — QR เดิมตลอด (ต้องเช็คยอดเอง)
  - *Dynamic* — ใส่จำนวนเงิน + reference ต่อ transaction (เหมาะ e-commerce, reconcile ง่าย)

### ข้อดี / ข้อเสีย ของการต่อตรง

| ข้อดี | ข้อเสีย |
|-------|---------|
| ค่าธรรมเนียมต่ำกว่า (ตัด margin คนกลาง) | integrate แยกทีละธนาคาร |
| เงินเข้าบัญชีตรง | ขั้นตอนเปิดร้านค้าหนักกว่า |
| ควบคุมได้เต็มที่ | ต้องผ่าน security review ของแบงก์ |
| | DX ไม่เนียนเท่า aggregator |

### ข้อควรรู้ก่อนเริ่มจริง

- **ต้องมีนิติบุคคล/ทะเบียนการค้า** เพื่อเปิด merchant production
- **Sandbox สมัครได้เลย** (SCB/KBank) ทดลอง dev ได้โดยยังไม่ต้องเปิดร้านค้าจริง
- **Production ต้องผ่าน review** (security, KYC merchant)
- **PromptPay ค่าธรรมเนียมต่ำมาก** ต่างจากบัตรเครดิต ~2-3%

---

## 5. คำแนะนำสำหรับ POC นี้

> **เริ่มแค่ PromptPay Dynamic QR กับธนาคารเดียว (SCB) หรือ Omise sandbox**

เหตุผล:

- PromptPay flow ง่ายสุด ไม่ต้องเข้า PCI scope บัตร, ไม่ต้องมี 3DS redirect
- QR มาตรฐานกลาง → ลูกค้าจ่ายจากแอปแบงก์ไหนก็ได้ แต่ต่อแค่เส้นเดียว
- เงินเข้าตรง, ค่าธรรมเนียมต่ำ
- เพิ่ม `card` ทีหลังได้เพราะ provider interface รองรับอยู่แล้ว

### หลักการออกแบบ

1. **แยก 2 ฝั่งให้ขาด** — อย่ารวมเป็น flow เดียว
   - *ฝั่ง client* (frontend ร้านค้าเรียก): `POST /payments` → `GET /payments/:id`
   - *ฝั่ง webhook ขาเข้า* (ธนาคารยิงเข้ามา): `POST /webhooks/:provider`
   - **webhook คือ source of truth** ของ status — การ poll แค่อ่าน state ที่ webhook (หรือ reconcile job) เขียนไว้ ไม่ใช่ตัวตัดสินผล
2. **ฝั่งร้านค้ารู้แค่ "จ่ายสำเร็จยัง"** — ซ่อน ref1/ref2, reconcile, format QR, ศัพท์ของแบงก์ ไว้หลัง adapter
3. **เงินเป็น integer สตางค์เสมอ** — `amount: 10000` = 100.00 บาท ห้ามใช้ทศนิยม/float (กัน rounding) สอดคล้องกับ `priceCents` ในโค้ดปัจจุบัน
4. **Idempotency-Key** ผ่าน HTTP header กันสร้าง charge ซ้ำจาก network timeout/retry
5. **Status ใช้คำกลาง** ไม่ leak ศัพท์ของแบงก์ — `pending / succeeded / failed / expired / canceled`
6. **Error shape เดียว** — `{ "error": { "code": "...", "message": "..." } }`
   > ⚠️ ต่างจาก route เดิมในโปรเจกต์ที่คืน `{ "error": "ข้อความ" }` (string เปล่า) — payment endpoint ตั้งใจใช้แบบ `{ code, message }` เพื่อให้ client แยก error ด้วย `code` ได้ ค่อย migrate route อื่นตามทีหลัง

### 5.1 API ฝั่ง client

#### `POST /payments` — สร้าง payment + ขอ QR

Headers:

```
Content-Type: application/json
Idempotency-Key: 6f9c1e7a-...        # UUID ฝั่ง client gen เอง (บังคับ)
```

Request body:

```json
{
  "amount": 10000,
  "currency": "THB",
  "method": "promptpay",
  "reference": "order_123"
}
```

| field | type | หมายเหตุ |
|-------|------|----------|
| `amount` | integer | หน่วย**สตางค์** (10000 = 100.00 บาท) ต้อง > 0 |
| `currency` | string | `"THB"` (hardcode สำหรับ POC แต่คงฟิลด์ไว้) |
| `method` | enum | `"promptpay"` \| `"card"` (POC ใช้ `promptpay`) |
| `reference` | string | เลขอ้างอิงฝั่งร้าน (เช่น order id) ใช้ตอน reconcile |

Response `201 Created`:

```json
{
  "id": "pay_2a9f...",
  "status": "pending",
  "amount": 10000,
  "currency": "THB",
  "method": "promptpay",
  "reference": "order_123",
  "qrPayload": "00020101021229370016A0000006770101110213...",
  "actionUrl": null,
  "expiresAt": "2026-06-28T10:15:00Z",
  "createdAt": "2026-06-28T10:00:00Z"
}
```

- `qrPayload` — EMVCo string เอาไป render เป็น QR (มีเฉพาะ `method=promptpay`)
- `actionUrl` — URL redirect (สำหรับ `method=card`/3DS ในอนาคต; promptpay จะเป็น `null`)
- มี `qrPayload` **หรือ** `actionUrl` อย่างใดอย่างหนึ่งเสมอ ตาม method

#### `GET /payments/:id` — poll สถานะ

Response `200 OK`: หน้าตา object เดียวกับด้านบน โดย `status` จะอัปเดตตามผลจริง

```json
{ "id": "pay_2a9f...", "status": "succeeded", "amount": 10000, "...": "..." }
```

แนะนำให้ client poll ทุก ~2–3 วินาที จนเจอ status สุดท้าย หรือเลย `expiresAt`

#### Lifecycle ของ status

```
pending ──(webhook: จ่ายสำเร็จ)──► succeeded   (terminal)
   │
   ├────(webhook: จ่ายไม่ผ่าน)────► failed      (terminal)
   ├────(เลย expiresAt)──────────► expired     (terminal)
   └────(ยกเลิกก่อนจ่าย)─────────► canceled    (terminal)
```

| status | ความหมาย |
|--------|----------|
| `pending` | สร้างแล้ว รอลูกค้าสแกนจ่าย |
| `succeeded` | จ่ายสำเร็จ ยืนยันจาก webhook/reconcile แล้ว |
| `failed` | จ่ายไม่ผ่าน (ถูกปฏิเสธ/error ฝั่งแบงก์) |
| `expired` | หมดอายุ QR ก่อนจ่าย |
| `canceled` | ยกเลิกโดยร้าน/ระบบก่อนจ่าย |

> เผื่ออนาคต (card): `processing`, `requires_action` (รอ 3DS) — ยังไม่ใช้ใน POC

### 5.2 Webhook ขาเข้า (ธนาคาร → เซิร์ฟเวอร์เรา)

#### `POST /webhooks/:provider`

ไม่ใช่ flow ที่ client เรียก — เป็นช่องที่ provider ยิง callback เข้ามา ลำดับการทำงานในเซิร์ฟเวอร์:

```
1. อ่าน raw body (ห้าม parse JSON ก่อน) → verifySignature
   - signature ไม่ผ่าน → 401 ทันที ไม่แตะ state
2. parseWebhook(rawBody) → NormalizedEvent (map provider id → payment + status กลาง)
3. อัปเดต payment แบบ idempotent
   - event ซ้ำ (เคยเห็น eventId/charge นี้แล้ว) → no-op
   - status เป็น terminal อยู่แล้ว → ไม่ทับซ้ำ
4. ตอบ 200 เร็วที่สุด (งานหนักโยนไป background ถ้ามี)
```

- ตอบ **`200`** เมื่อรับ event ไว้แล้ว (แม้จะ no-op) เพื่อให้ provider หยุด retry
- ตอบ **`401`** เมื่อ signature ไม่ผ่าน, **`400`** เมื่อ body parse ไม่ได้

### 5.3 Error shape (ทุก endpoint ฝั่ง client)

```json
{ "error": { "code": "payment_not_found", "message": "No payment with id pay_..." } }
```

| HTTP | `code` ตัวอย่าง | เมื่อไหร่ |
|------|----------------|----------|
| 400 | `invalid_request` | body ผิด format / `amount` ≤ 0 |
| 404 | `payment_not_found` | `GET` id ที่ไม่มี |
| 409 | `idempotency_conflict` | `Idempotency-Key` เดิม แต่ body ต่างจากครั้งแรก |
| 422 | `unsupported_method` | `method` ที่ provider ไม่รองรับ |
| 502 | `provider_error` | provider/แบงก์ตอบ error |

#### พฤติกรรม Idempotency

- `Idempotency-Key` เดิม + body **เหมือนเดิม** → คืน response เดิม (ไม่สร้าง charge ใหม่)
- `Idempotency-Key` เดิม + body **ต่าง** → `409 idempotency_conflict`
- เก็บ key ไว้ ~24 ชม. (POC เก็บใน DB ตาราง payment ได้เลย)

---

## 6. map กับโปรเจกต์

ฝั่ง API ที่ client เรียก (section 5.1) **เหมือนกันหมดทุก provider** — business code ไม่รู้จัก provider เฉพาะราย ความต่างทั้งหมดถูกซ่อนหลัง `PaymentProvider` interface เดียว

### 6.1 `PaymentProvider` interface

```ts
// src/providers/types.ts
export type PaymentMethod = "promptpay" | "card";

export type PaymentStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "expired"
  | "canceled";

export interface CreateChargeInput {
  /** จำนวนเงินหน่วยสตางค์ (integer) */
  amount: number;
  currency: "THB";
  method: PaymentMethod;
  /** อ้างอิงฝั่งร้าน ใช้ตอน reconcile */
  reference: string;
}

export interface ChargeResult {
  /** id ฝั่ง provider ใช้ map ตอน webhook กลับมา */
  providerChargeId: string;
  /** EMVCo string สำหรับ promptpay; null เมื่อเป็น redirect */
  qrPayload: string | null;
  /** URL redirect สำหรับ card/3DS; null เมื่อเป็น promptpay */
  actionUrl: string | null;
  expiresAt: Date;
}

/** ผลลัพธ์หลัง parse webhook ดิบ ให้เป็นภาษากลางของระบบ */
export interface NormalizedEvent {
  /** id ของ event กัน process ซ้ำ (idempotent) */
  eventId: string;
  providerChargeId: string;
  status: PaymentStatus;
}

export interface PaymentProvider {
  /** สร้าง charge → คืน qrPayload หรือ actionUrl */
  createCharge(input: CreateChargeInput): Promise<ChargeResult>;
  /** ตรวจ signature บน raw webhook body (ก่อน parse) */
  verifySignature(rawBody: string, headers: Headers): boolean;
  /** แปลง callback ดิบ → NormalizedEvent (status กลาง) */
  parseWebhook(rawBody: string): NormalizedEvent;
}
```

> ⚠️ `verifySignature` ใน POC สมมติว่าเป็น HMAC บน raw body (Omise เป็นแบบนี้) แต่ของจริงแต่ละแบงก์ต่างกัน — SCB/KBank อาจใช้ mTLS / JWT / IP allowlist ไม่ใช่ HMAC ล้วน เพราะรับ `headers` เข้ามาด้วย แต่ละ adapter จึงเลือกวิธี verify เองได้

### 6.2 adapter ที่ต้องเขียน

| แบบ | โฟลเดอร์ | สถานะ |
|-----|----------|-------|
| ทดสอบ (mock) | `src/providers/mock/` | ต้องเขียน — เริ่มที่นี่ก่อน |
| A (Omise) | `src/providers/omise/` | ต้องเขียน |
| C (SCB) | `src/providers/scb/` | ต้องเขียน |

แต่ละ adapter implement แค่ 3 เมธอดของ `PaymentProvider` ส่วน route (`POST /payments`, `GET /payments/:id`, `POST /webhooks/:provider`) เขียนครั้งเดียวใช้ร่วมกัน — เลือก adapter ตาม `:provider` หรือ config

### 6.3 Database schema

ตาราง `payments` ตารางเดียวเก็บครบทั้ง lifecycle + idempotency เดินตาม convention เดิมในโปรเจกต์ (เงิน integer สตางค์, status enum + terminal states, partial/unique index, `withTimezone` timestamps) โดยยืมแม่แบบจาก `faceLivenessAttempts` ที่มี pattern เกือบเหมือนกัน

```ts
// src/db/schema.ts (เพิ่มต่อจากตารางเดิม)

/** Channel ที่ลูกค้าจ่าย — pre-declare เผื่อเพิ่มทีหลังโดยไม่ต้อง migrate enum */
export const paymentMethodEnum = db_schema.enum("payment_method", [
  "promptpay",
  "card",
]);

/**
 * Lifecycle ของ payment หนึ่งรายการ. Terminal states
 * (`succeeded`, `failed`, `expired`, `canceled`) ห้าม transition ออก;
 * webhook คือ source of truth ที่ขับ status นี้.
 */
export const paymentStatusEnum = db_schema.enum("payment_status", [
  "pending",
  "succeeded",
  "failed",
  "expired",
  "canceled",
]);

export const payments = db_schema.table(
  "payments",
  {
    // public id ที่โผล่ใน API (เช่น "pay_2a9f..."); meaningful จึงใช้ text PK
    id: text("id").primaryKey(),
    // adapter ที่ใช้ ("mock" | "omise" | "scb") — เลือกตอนรับ webhook ด้วย
    provider: text("provider").notNull(),
    // charge id ฝั่ง provider; null จนกว่า createCharge สำเร็จ ใช้ map webhook กลับ
    providerChargeId: text("provider_charge_id"),
    // จำนวนเงินหน่วยสตางค์ (integer) — เหมือน products.priceCents กัน float bug
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("THB"),
    method: paymentMethodEnum("method").notNull(),
    status: paymentStatusEnum("status").notNull().default("pending"),
    // เลขอ้างอิงฝั่งร้าน (order id) ใช้ตอน reconcile
    reference: text("reference").notNull(),
    // Idempotency-Key จาก client header — กันสร้าง charge ซ้ำ
    idempotencyKey: text("idempotency_key").notNull(),
    // EMVCo QR string (promptpay) หรือ redirect url (card) — อย่างใดอย่างหนึ่ง
    qrPayload: text("qr_payload"),
    actionUrl: text("action_url"),
    // id ของ webhook event ล่าสุดที่ process แล้ว — กัน process event ซ้ำ
    lastEventId: text("last_event_id"),
    // payload ดิบ/metadata จาก provider ไว้ debug & audit
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Idempotency-Key เดิม → คืน payment เดิม (กันสร้างซ้ำจาก retry)
    uniqueIndex("payments_idempotency_key_unique").on(table.idempotencyKey),
    // map webhook (provider + charge id) กลับมาที่ payment ได้แบบ unique
    uniqueIndex("payments_provider_charge_unique").on(
      table.provider,
      table.providerChargeId,
    ),
  ],
);

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type PaymentMethod = (typeof paymentMethodEnum.enumValues)[number];
export type PaymentStatus = (typeof paymentStatusEnum.enumValues)[number];
```

หมายเหตุการออกแบบ:

- **text PK `pay_...`** (ไม่ใช่ `serial`) เพราะ id โผล่ใน API และต้องเดายาก — เดินตาม pattern `sessions.id` / `shelves.id` ที่ใช้ text PK เมื่อ id มีความหมาย
- **`idempotencyKey` unique ทั้งตาราง** (ไม่ใช่ partial เหมือน face) เพราะ key ต้องกันซ้ำตลอดอายุ ไม่ใช่แค่ตอน in-flight
- **`(provider, providerChargeId)` unique** — webhook map กลับ payment ผ่านคู่นี้; ใส่ provider ด้วยกัน charge id ชนข้าม provider
- **`lastEventId`** ทำให้ webhook idempotent: เห็น event เดิม → no-op
- `PaymentMethod` / `PaymentStatus` types ตรงกับ `src/providers/types.ts` ใน section 6.1 (single source ฝั่ง enum คือ DB)

---

## 7. แหล่งอ้างอิง

- [Omise Pricing Thailand](https://www.omise.co/en/pricing/thailand)
- [Payment Gateway in Thailand 2026 — fees comparison (creative.co.th)](https://creative.co.th/en/13954/)
- [Best Payment Gateways in Thailand 2026 (Statrys)](https://statrys.com/blog/best-payment-gateways-in-thailand)
- [Guide to Thailand's Online Payment Gateways (Outsourcify)](https://outsourcify.net/a-guide-to-thailands-online-payment-gateways/)
- [OpnPayments PromptPay docs](https://docs.omise.co/promptpay-solution/thailand)
- [SCB Developer Portal](https://developer.scb/)
- [KBank API Portal](https://apiportal.kasikornbank.com/)
