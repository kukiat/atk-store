# Back Office ของ ATK Store

เอกสารนี้สรุปว่าระบบหลังบ้านทำอะไรได้บ้าง และ tag หน้า backdoor/mock ที่ใช้สำหรับ demo หรือจำลองสถานะต่าง ๆ

## Access model

หลังบ้านอยู่ใต้ route `/admin` และต้องมี role `admin` หรือ `super_admin`

| Role          | สิทธิ์หลัก                                                                  |
| ------------- | --------------------------------------------------------------------------- |
| `admin`       | เข้า back-office, จัดการ client, inventory, wallet dashboard, demo controls |
| `super_admin` | ทำได้เหมือน admin และ grant/revoke admin                                    |

กฎการจัดการ user:

- admin จัดการได้เฉพาะ client
- super_admin จัดการ admin ได้ แต่ไม่จัดการ super_admin คนอื่น
- user จัดการตัวเองผ่าน admin action ไม่ได้
- action สำคัญถูกบันทึกใน audit log

## Navigation

Top-level admin nav:

| Route                      | Label       | หน้าที่                                    |
| -------------------------- | ----------- | ------------------------------------------ |
| `/admin/users`             | Users       | จัดการ user และ role                       |
| `/admin/inventory`         | Inventory   | จัดการ inventory/QR/order/receipt settings |
| `/admin/inventory/iot-poc` | IOT PoC     | จำลอง IoT event                            |
| `/admin/wallets`           | Wallets     | ตรวจ wallet, top-up, webhook               |
| `/admin/attendance`        | Demo Status | manual override สถานะเข้า/ออก              |

## Users

### `/admin/users`

ใช้ดูรายชื่อ user แยกเป็น:

- Clients
- Admins

สิ่งที่แสดง:

- avatar/name/email
- role สูงสุด
- account status
- face enrollment status
- last login
- pending admin grants สำหรับ super_admin

สิ่งที่ทำได้:

- เปิดหน้ารายละเอียด user
- super_admin เพิ่ม admin access ล่วงหน้าด้วย email

### `/admin/users/[id]`

ใช้ดูและจัดการ user รายคน

สิ่งที่แสดง:

- role
- account status
- face enrollment status
- face registered time
- disabled reason/time
- Face profile metadata
- Recent liveness attempts
- Audit log

Actions:

- Block user
- Set active
- Temporarily disable
- Reset face enrollment
- Revoke admin role ถ้า actor เป็น super_admin และ target เป็น admin

Condition:

- block/disable จะลบ session ของ user
- reset face enrollment ลบ `user_face_profiles` และ set user เป็น `not_registered`
- reset face enrollment ไม่ลบ face ใน AWS collection โดยตรง

## Inventory

Inventory มี subnav ภายใน:

| Route                               | หน้าที่                            |
| ----------------------------------- | ---------------------------------- |
| `/admin/inventory`                  | Overview summary                   |
| `/admin/inventory/units`            | จัดการ unit                        |
| `/admin/inventory/items`            | จัดการ inventory master            |
| `/admin/inventory/qr`               | สร้าง/ดู/ลบ QR code                |
| `/admin/inventory/orders`           | ดู notifications และ orders ล่าสุด |
| `/admin/inventory/receipt-settings` | ตั้งค่า receipt                    |
| `/admin/inventory/iot-poc`          | mock IoT event                     |

### `/admin/inventory`

แสดง summary:

- จำนวน inventories
- stock รวม
- จำนวน QR codes
- จำนวน unread alerts
- จำนวน orders ล่าสุด

### `/admin/inventory/units`

ทำได้:

- เพิ่ม unit
- แก้ชื่อ unit
- soft delete unit

ใช้กับ `weightPerPiece` ของ inventory และ receipt item

### `/admin/inventory/items`

ทำได้:

- เพิ่ม inventory
- แก้ inventory
- อัปโหลด/ใส่ image URL
- ตั้ง price, amount, weight per piece, unit
- เปิด/ปิด active
- soft delete inventory
- import CSV

CSV header ที่หน้ารองรับ:

```text
name,description,price,amount,weightPerPiece,unitId,isActive,imageUrl
```

Condition:

- inventory ที่ถูก scan ต้อง active และไม่ถูก soft delete
- IoT เป็นเจ้าของ physical shelf mapping

### `/admin/inventory/qr`

ทำได้:

- สร้าง QR จาก inventory หนึ่งรายการ
- สร้าง grouped QR จากหลาย inventory
- ดู QR image
- เปิด QR image ใน tab ใหม่
- soft delete QR

Condition:

- ต้องเลือก inventory อย่างน้อยหนึ่งรายการ
- QR เก็บ `encodedPayload` และ `inventoryIds`
- grouped QR จะพาลูกค้าไปเลือกสินค้าก่อนเปิด session

### `/admin/inventory/orders`

แสดง:

- notifications ล่าสุดจาก IoT/websocket/mock path
- orders ล่าสุดที่สร้างจาก exit-camera worker API หรือ manual exit

ใช้สำหรับ monitor demo และตรวจว่ามี alert/order เกิดจาก flow ไหน

### `/admin/inventory/receipt-settings`

ทำได้:

- ตั้งชื่อร้าน
- legal name
- tax id
- receipt prefix
- phone/email/address
- VAT percentage

Condition:

- VAT เป็นแบบ included in product price
- การแก้ setting มีผลเฉพาะ receipt ที่ออกหลัง save

## Wallets

### `/admin/wallets`

แสดง read-only dashboard:

- Wallet balances ล่าสุด
- Top-up intents ล่าสุด
- Stripe webhook events ล่าสุด

สิ่งที่ใช้ตรวจ:

- available/pending balance
- wallet status
- top-up channel
- sandbox/live mode
- webhook processing status
- failed webhook หรือ duplicate behavior

## Attendance และ demo control

### `/admin/attendance`

Tag: `backdoor`, `demo-control`, `manual-override`

หน้านี้คือ back-office manual override สำหรับ demo หน้าร้าน

ทำได้:

- search user
- ดูว่า user อยู่ `Inside` หรือ `Exit`
- ดู latest camera/attendance event
- กด `Set Inside`
- กด `Set Exit`

ผลทางระบบ:

- `Set Inside` สร้าง manual entry attendance event และ active visit
- `Set Exit` สร้าง manual exit event, ปิด visit และเรียก checkout path เดียวกับ exit camera
- ถ้า cart พร้อมและ wallet พอ จะเกิด order/receipt จริง

คำเตือน:

- นี่ไม่ใช่ mock ลอย ๆ เพราะ `Set Exit` มีผลกับ wallet/order/receipt จริง
- ควรใช้กับ demo, test, หรือ manual recovery เท่านั้น

## IoT PoC

### `/admin/inventory/iot-poc`

Tag: `backdoor`, `mock-iot`, `demo-control`, `status-simulator`

หน้านี้ใช้จำลอง IoT loadcell event สำหรับ session ที่ลูกค้าเปิดจากหน้า scan

แสดง:

- session id
- visit id
- customer
- inventory
- branch
- current qty / in-store qty
- cumulative picked count
- cart total
- session status

Actions:

- `Send count` ส่ง cumulative picked count และ current qty
- `Door closed` ส่ง shelf closed status
- `Refresh` โหลด session ล่าสุด

Transport mode:

| `IOT_POC_EVENT_TRANSPORT` | พฤติกรรม                                          |
| ------------------------- | ------------------------------------------------- |
| `direct` หรือไม่ตั้ง      | เรียก `iotEventProcessorService.process()` โดยตรง |
| `mqtt`                    | publish payload ไป MQTT broker ตาม topic contract |

Condition:

- ต้องมี IoT session ก่อน โดยลูกค้าต้อง scan inventory QR
- count ต้องเป็น integer >= 0
- door closed จะปิด IoT session แต่ checkout ยังผูกกับ exit camera/manual exit

## Backdoor / Mock tag summary

| Route                      | Tags                                          | ใช้ทำอะไร                                   | Risk                                              |
| -------------------------- | --------------------------------------------- | ------------------------------------------- | ------------------------------------------------- |
| `/admin/attendance`        | `backdoor`, `demo-control`, `manual-override` | mock สถานะเข้า/ออกของ user                  | `Set Exit` ตัด wallet และสร้าง order จริง         |
| `/admin/inventory/iot-poc` | `backdoor`, `mock-iot`, `status-simulator`    | mock picked count และ door closed           | เปลี่ยน cart/session/notification จริง            |
| `/verify-face`             | `debug`, `face-verification`                  | debug proof สำหรับ face verification        | ซ่อนด้วย env และต้องเป็น admin ที่มี face profile |
| `/api/mock-iot-server/*`   | `mock-api`, `dev-support`                     | mock IoT product/pick session เมื่อเปิด env | ใช้เมื่อ `IOT_SERVER_IS_MOCK=true`                |
| `/api/iot/mock-events`     | `mock-api`, `admin-only`                      | ส่ง mock IoT event ผ่าน API                 | ต้องเป็น admin                                    |

## Operational checklist สำหรับ demo

1. มี user ลูกค้าและ admin
2. ลูกค้าลงทะเบียน face แล้ว
3. ลูกค้ามี wallet balance พอ
4. มี unit และ inventory active
5. สร้าง QR แล้ว
6. เปิด active visit ด้วย entry camera หรือ `/admin/attendance`
7. ลูกค้า scan QR และเปิด IoT session
8. ใช้ `/admin/inventory/iot-poc` ส่ง picked count
9. ลูกค้าเห็น cart update
10. ใช้ exit camera หรือ `/admin/attendance` กด Set Exit
11. ตรวจ order/receipt/wallet ใน admin

## Glossary

| คำ              | ความหมาย                                                       |
| --------------- | -------------------------------------------------------------- |
| Back office     | ระบบหลังบ้านสำหรับ admin                                       |
| Backdoor        | หน้า/endpoint ที่ช่วย mock หรือ override state เพื่อ demo/test |
| Manual override | การเปลี่ยนสถานะด้วย admin แทนกล้องหรือ IoT จริง                |
| Demo Status     | หน้า `/admin/attendance` สำหรับควบคุมสถานะเข้าออก              |
| IOT PoC         | หน้า `/admin/inventory/iot-poc` สำหรับจำลอง loadcell event     |
| Audit log       | บันทึก action สำคัญของ admin                                   |
| Soft delete     | ลบโดย set `deletedAt` ไม่ได้ลบ row ออกจาก DB ทันที             |
