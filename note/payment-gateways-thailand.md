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

### หลักออกแบบ API ให้ "ใช้งานง่าย"

1. **flow สั้นที่สุด — 3 จังหวะพอ:** `POST /payments` (สร้าง+ขอ QR) → `GET /payments/:id` (poll) → `POST /webhooks/:bank` (callback)
2. **ฝั่งร้านค้ารู้แค่ "จ่ายสำเร็จยัง"** — ซ่อน ref1/ref2, reconcile, format QR ไว้หลัง adapter
3. **Idempotency-Key** กันสร้าง charge ซ้ำจาก network timeout
4. **Status ใช้คำกลาง** (`pending/succeeded/failed/expired`) ไม่ leak ศัพท์ของแบงก์
5. **Error shape เดียว** — `{ "error": { "code": "...", "message": "..." } }`

---

## 6. map กับโปรเจกต์

โครงปัจจุบันรองรับทุกแบบผ่าน `PaymentProvider` interface — ต่างกันแค่ adapter:

| แบบ | สิ่งที่ต้องเขียน | สถานะ |
|-----|----------------|-------|
| ทดสอบ | `src/providers/mock/` | ✅ มีแล้ว |
| A (Omise) | `src/providers/omise/` | ต้องเขียน |
| C (SCB) | `src/providers/scb/` | ต้องเขียน |

แต่ละ adapter:
- `createCharge` → คืน `qrPayload` (PromptPay) หรือ `actionUrl` (redirect)
- `verifySignature` → ตรวจ HMAC บน raw webhook body
- `parseWebhook` → แปลง callback เป็น `NormalizedEvent` (status กลาง)

ฝั่ง API ที่ลูกค้าเรียก **เหมือนกันทุกเจ้า** — business code ไม่รู้จัก provider เฉพาะราย

---

## 7. แหล่งอ้างอิง

- [Omise Pricing Thailand](https://www.omise.co/en/pricing/thailand)
- [Payment Gateway in Thailand 2026 — fees comparison (creative.co.th)](https://creative.co.th/en/13954/)
- [Best Payment Gateways in Thailand 2026 (Statrys)](https://statrys.com/blog/best-payment-gateways-in-thailand)
- [Guide to Thailand's Online Payment Gateways (Outsourcify)](https://outsourcify.net/a-guide-to-thailands-online-payment-gateways/)
- [OpnPayments PromptPay docs](https://docs.omise.co/promptpay-solution/thailand)
- [SCB Developer Portal](https://developer.scb/)
- [KBank API Portal](https://apiportal.kasikornbank.com/)
