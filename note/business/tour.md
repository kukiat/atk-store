# UI Tour ของ ATK Store

เอกสารนี้พาเดินหน้า UI สำคัญของ project เพื่อให้คนที่เข้ามาเล่นต่อ อ่านแล้วเข้าใจว่าแต่ละหน้าทำอะไร แสดงอะไร และควรทดลอง flow ไหน

## Customer tour

### `/signin`

หน้าสำหรับ sign in ด้วย Google

สิ่งที่เห็น:

- ปุ่ม sign in
- error message จาก query string ถ้า OAuth ล้มเหลว

หลัง sign in สำเร็จ ระบบ redirect ไป `/`

### `/`

Home ของลูกค้า

สิ่งที่เห็น:

- ชื่อ ATK Store
- ข้อความอธิบายว่า scan QR เพื่อเปิดตู้และให้ระบบใส่สินค้าตามจำนวนจริง
- ปุ่ม `สแกน QR`
- ปุ่ม `เปิดตะกร้า`
- notice หลัง checkout สำเร็จ
- prompt ลงทะเบียนใบหน้า
- debug prompt สำหรับ verify face เมื่อเปิด env
- notice ให้ reauth ถ้า face token หมดอายุ
- notice ว่า scan ได้หรือไม่ได้เพราะเหตุผลอะไร

State สำคัญ:

- ถ้า wallet ไม่พอ จะแสดงยอดคงเหลือและราคาสินค้าต่ำสุด พร้อมปุ่มไปเติม wallet
- ถ้าไม่มี active visit จะบอกให้เดินผ่านกล้องทางเข้าก่อน
- ถ้า checkout สำเร็จ จะมี receipt link/notice

### `/register-face`

หน้าลงทะเบียนใบหน้า

สิ่งที่เห็น:

- สถานะว่า user registered แล้วหรือยัง
- flow Face Liveness
- ข้อความ consent/retention แบบสั้น
- ปุ่มเริ่มตรวจใบหน้า
- loading/error/success state

หลักการใช้:

- กล้องไม่เริ่มเอง ต้องให้ user กดเริ่ม
- ถ้าผ่าน liveness และ index face สำเร็จ user จะเป็น `registered`

### `/verify-face`

Tag: `debug`

หน้า debug สำหรับพิสูจน์ face verification

สิ่งที่เห็น:

- ข้อมูล user ปัจจุบัน
- ปุ่มเริ่ม verify face
- result ว่า match กับ face profile ของ user หรือไม่

เงื่อนไข:

- ต้องเปิด env debug
- ต้องเป็น admin ที่มี face profile
- ใช้เพื่อ proof/debug ไม่ใช่ customer journey หลัก

### `/wallet`

หน้า wallet ของลูกค้า

สิ่งที่เห็น:

- available balance
- pending balance
- wallet status
- form top up
- channel `Credit / debit card` หรือ `PromptPay`
- top-up history
- ledger

หลักการใช้:

- กรอก amount
- เลือก channel
- กดไป Stripe Checkout
- balance จะอัปเดตหลัง Stripe webhook ยืนยัน payment

### `/wallet/topup/success`

หน้ากลับมาหลัง Stripe Checkout สำเร็จ

สิ่งที่เห็น:

- สถานะว่าระบบรอ webhook หรือ top-up สำเร็จแล้วตามข้อมูล session
- link กลับ wallet/home

### `/scan`

หน้าสแกน inventory QR

สิ่งที่เห็น:

- header `QR scan`
- ปุ่มกลับ
- QR scanner
- ถ้า scan ไม่ได้ จะแสดงเหตุผลจาก scan eligibility

ใช้เมื่อ:

- user sign in แล้ว
- มี active visit
- wallet พร้อม
- มี inventory พร้อมขาย

### `/scan/inventories`

หน้าที่แสดงเมื่อ QR มี inventory หลายรายการ

สิ่งที่เห็น:

- grid สินค้า
- รูปสินค้า
- ชื่อสินค้า
- amount ในระบบ

กดสินค้าแล้วไป `/inventory/[id]`

### `/inventory/[id]`

หน้าสินค้าที่เปิด IoT session

สิ่งที่เห็น:

- ชื่อสินค้า
- รูปสินค้า
- ราคา
- จำนวนคงเหลือในตู้ ถ้า IoT มีข้อมูล
- สถานะ session เช่น opening/open/updated/closed/error
- channel/session id
- จำนวนในตะกร้า
- ปุ่มไป cart
- ปุ่มเปิดใหม่

เบื้องหลัง:

- เมื่อหน้าโหลด จะเรียก `POST /api/iot/watch`
- server สร้าง IoT session
- browser เปิด SSE เพื่อรอ event
- เมื่อ IoT ส่ง picked count จำนวนในตะกร้าจะอัปเดต

### `/cart`

หน้าตะกร้าสินค้า

สิ่งที่เห็น:

- รายการสินค้า verified จาก IoT
- จำนวน x ราคา
- ยอดรวม
- notice ว่ารอ checkout ตอนออกจากร้าน
- warning ถ้าออกแล้วแต่ payment/order ยังไม่สำเร็จ

หลักการใช้:

- ไม่มีปุ่ม checkout
- checkout เกิดเมื่อ exit camera หรือ manual exit ยืนยันว่าลูกค้าออกจากร้าน
- ถ้า order paid แล้ว cart จะ clear และ redirect กลับ home

### `/receipts`

หน้ารายการ receipt ของ user

สิ่งที่ควรใช้ดู:

- receipt ที่ออกจาก order
- สถานะ receipt
- วันที่ออก receipt

### `/receipts/[receiptNo]`

หน้ารายละเอียด receipt

สิ่งที่เห็น:

- store profile
- customer info
- รายการสินค้า
- VAT/subtotal/total
- wallet balance หลังจ่าย ถ้ามี
- payment reference

## Admin tour

### `/admin`

redirect ไป `/admin/inventory`

### `/admin/users`

หน้ารวม user

สิ่งที่เห็น:

- tab `Clients`
- tab `Admins`
- จำนวน user แต่ละกลุ่ม
- role/status/face/last login
- ปุ่ม `View`
- form `Grant admin access` สำหรับ super_admin

เหมาะสำหรับ:

- ตรวจว่าใครลงทะเบียน face แล้ว
- เพิ่ม admin ด้วย email
- เข้าไปจัดการ user รายคน

### `/admin/users/[id]`

หน้ารายละเอียด user

สิ่งที่เห็น:

- profile summary
- account status
- face enrollment
- face profile metadata
- recent liveness attempts
- admin actions
- audit log

Actions:

- Block user
- Set active
- Temporarily disable
- Reset face enrollment
- Revoke admin role

### `/admin/inventory`

Overview ของ inventory area

สิ่งที่เห็น:

- summary cards: Inventories, QR Codes, Alerts
- link ไปหน้า items/QR/orders

### `/admin/inventory/units`

หน้าจัดการหน่วยนับ

สิ่งที่เห็น:

- form เพิ่ม unit
- รายการ unit
- ปุ่ม update/delete

### `/admin/inventory/items`

หน้าจัดการ inventory master

สิ่งที่เห็น:

- form เพิ่ม inventory
- table inventory
- ราคา
- amount
- weight/unit
- image preview
- active/inactive badge
- edit inline
- delete
- CSV import

### `/admin/inventory/qr`

หน้าจัดการ QR

สิ่งที่เห็น:

- table QR
- description
- inventory names
- created date
- encoded payload
- view QR image
- delete QR
- form create QR
- selector เพิ่ม inventory หลายตัว

วิธีลอง:

1. เลือก inventory
2. กด `Add inventory`
3. ใส่ description
4. กด generate
5. ใช้ QR image กับหน้า `/scan`

### `/admin/inventory/orders`

หน้าดู order และ alert

สิ่งที่เห็น:

- Notifications จาก IoT/mock path
- Orders ที่สร้างจาก exit camera หรือ manual exit
- payment status
- total

### `/admin/inventory/receipt-settings`

หน้าตั้งค่า receipt

สิ่งที่เห็น:

- store name
- legal name
- tax id
- receipt prefix
- phone/email/address
- VAT percentage
- warning ว่า setting มีผลกับ receipt ใหม่เท่านั้น

### `/admin/inventory/iot-poc`

Tag: `backdoor`, `mock-iot`, `status-simulator`

หน้าจำลอง IoT session

สิ่งที่เห็น:

- sessions ล่าสุด
- visit id
- customer
- session id
- cart total
- inventory id/name
- status
- current qty
- picked count
- branch

Actions:

- `Send count` เพื่อ mock picked count
- `Door closed` เพื่อ mock shelf closed
- `Refresh`

ใช้คู่กับ:

- customer เปิด `/inventory/[id]`
- cart page เพื่อดูจำนวนเปลี่ยน
- orders/alerts เพื่อดู notification

### `/admin/wallets`

หน้า wallet dashboard

สิ่งที่เห็น:

- wallet balances
- top-up intents
- Stripe webhook events

เหมาะสำหรับ:

- ตรวจว่าลูกค้าเติมเงินสำเร็จไหม
- ดู webhook status
- ตรวจ sandbox/live mode

### `/admin/attendance`

Tag: `backdoor`, `demo-control`, `manual-override`

หน้า demo status control

สิ่งที่เห็น:

- search user
- counter Inside/Exit
- user table
- status badge
- latest event
- ปุ่ม Set Inside / Set Exit

ใช้เพื่อ:

- จำลอง entry camera ด้วย `Set Inside`
- จำลอง exit camera ด้วย `Set Exit`
- trigger checkout จริงตอน Set Exit

## Recommended demo script

1. Admin เปิด `/admin/inventory/items` ตรวจว่ามีสินค้า active
2. Admin เปิด `/admin/inventory/qr` สร้าง QR
3. ลูกค้า sign in และเติม wallet ที่ `/wallet`
4. Admin เปิด `/admin/attendance` กด `Set Inside`
5. ลูกค้าไป `/scan` แล้ว scan QR
6. ลูกค้าเข้าหน้า `/inventory/[id]`
7. Admin เปิด `/admin/inventory/iot-poc` ส่ง picked count
8. ลูกค้าเปิด `/cart` ดูสินค้า verified
9. Admin กลับ `/admin/attendance` กด `Set Exit`
10. ลูกค้าถูก redirect กลับ Home พร้อม checkout paid notice
11. เปิด receipt เพื่อตรวจรายละเอียด

## Glossary

| คำ                 | ความหมายใน UI                                      |
| ------------------ | -------------------------------------------------- |
| Notice             | กล่องข้อความสถานะที่บอก user ว่าต้องทำอะไรต่อ      |
| Prompt             | CTA ที่ชวน user ทำ action เช่น register face       |
| Verified cart item | สินค้าใน cart ที่มาจาก IoT picked count            |
| Backdoor page      | หน้า admin ที่ใช้จำลองหรือ override state          |
| Debug page         | หน้าที่ใช้ตรวจ integration ไม่ใช่ flow ปกติ        |
| Badge              | label สั้น ๆ ที่บอกสถานะ เช่น active, paid, inside |
| SSE                | connection ที่หน้า UI ใช้รับสถานะใหม่แบบต่อเนื่อง  |
