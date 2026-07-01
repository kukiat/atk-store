# Shelf & Inventory

## Confirmed Decisions
- Replace shelf/product schema เดิมทั้งหมดด้วย schema ใหม่ตามเอกสารนี้
- ใช้ `inventories` แทน `products` ไปเลย ดังนั้น `inventories` ไม่มี `productId`
- `clientId` ใน shelf/IOT/cart/order flow ให้ใช้ `client_visits.id`
- QR code payload ต้อง encode ด้วย `ENCODE_KEY` จาก `.env` และตอนใช้งานต้อง decode ก่อน
- QR code image ไม่เก็บ base64 แล้ว ให้เก็บเป็น `imageUrl`
- Cart ใช้ local cart ก่อน แล้วค่อย sync ไป Redis หลังจาก IOT ยืนยันว่าหยิบถูกต้อง
- Back-office inventory management ให้ `admin` และ `superAdmin` ใช้ได้ทั้งคู่
- ราคาใน inventory ใช้ type `double`
- เก็บ `units` table ไว้เผื่ออนาคต แม้สินค้าปัจจุบันใช้หน่วยกรัมทั้งหมด
- Mobile/tablet only ต้องทำทั้ง hide UI และ block route/API จาก desktop
- ลูกค้าสามารถเลือกสินค้าข้าม shelf ได้ใน integrated flow แล้ว submit ครั้งเดียว
- Payment ยังไม่ทำจริง ให้ mock เป็นชำระสำเร็จไปก่อน และลง pending note ใน `note/pending_2026_07_01.xlsx`

## Constraints
- เฉพาะ mobile/tablet เท่านั้นที่จะปรากฎ function QR code scan
- เฉพาะ mobile/tablet เท่านั้นที่จะปรากฎ function cart
- Desktop ต้องถูก block route/API สำหรับ QR scan และ cart ด้วย ไม่ใช่แค่ hide UI
- Master data ที่มี `imageUrl` ให้เป็น optional ทั้งหมด
- ถ้า data ไม่มีรูปภาพ ต้องแสดง placeholder/state ที่บอก user ว่าไม่มีภาพหรือภาพไม่พร้อม
- Master data ที่มีรูปภาพต้องมี upload UI ในหน้า manage data เป็น select หรือ drag/drop
- Image upload ให้ใช้ S3 ตามหัวข้อ S3 Storage
- สินค้าทุกชนิดใช้หน่วยกรัมเป็น default

## Shelf Types

### Integrated
- Integrated คือ box/group ขนาดใหญ่ที่มี QR code แปะหน้า box
- ใน box/group ประกอบด้วย shelf หลายตัว
- ใช้ QR เดียวของ group เมื่อ scan แล้วจะได้ shelf ids ตามจำนวน shelf ใน box
- QR payload หลัง decode ต้องได้ข้อมูลลักษณะนี้
    ```jsonc
    {
      "shelfIds": ["shelfId1", "shelfId2", "shelfId3"]
    }
    ```
- ระบบต้องนำ `shelfIds` ทั้งหมดไปดึง shelf metadata เช่น รูปภาพ, ชื่อ
- ถ้า QR มีหลาย shelf ต้องแสดงหน้าให้ลูกค้าเลือก shelf ก่อน
- เมื่อกด shelf ใดๆ ให้เปิดหน้าสินค้าที่อยู่ใน shelf นั้น
- Query สินค้าจาก `inventories` ด้วย `shelfId` และ `isActive = true`
- ลูกค้าสามารถเลือก inventory จากหลาย shelf ใน group เดียวกัน แล้ว submit ครั้งเดียวได้

### Standalone
- Standalone คือ shelf ที่ไม่ได้จัดกลุ่ม
- แต่ละ shelf มี QR code ประจำ shelf
- QR payload หลัง decode ต้องได้ข้อมูลลักษณะนี้
    ```jsonc
    {
      "shelfIds": ["shelfIdX"]
    }
    ```
- ถ้า QR มี shelf เดียว ให้ไปหน้าสินค้าของ shelf นั้นเลย
- Query สินค้าจาก `inventories` ด้วย `shelfId` และ `isActive = true`

## Customer Shelf Flow
- ลูกค้า scan QR code บน mobile/tablet
- ระบบ decode payload ด้วย `ENCODE_KEY`
- ถ้า payload มีหลาย `shelfIds` ให้แสดงหน้าเลือก shelf
    - หน้าเลือก shelf แสดงรูป shelf และชื่อด้านล่างในกล่องสี่เหลี่ยม
- ถ้า payload มี 1 `shelfId` ให้ไปหน้าสินค้าของ shelf นั้นทันที
- สินค้าแต่ละชนิดแสดงเป็นกล่องที่มีรูป ชื่อ ราคา และตัวเพิ่ม/ลดจำนวน
- เมื่อเลือกสินค้าตามต้องการแล้ว ลูกค้ากด submit
- App trigger IOT server เพื่อเปิดประตู shelf
    - ตอนนี้ IOT server ยังไม่พร้อม ให้ mock URL ไว้ก่อน
    - รายการ mock/pending integration ต้องลงใน `note/pending_2026_07_01.xlsx`
- เมื่อ IOT ยืนยันว่าลูกค้าหยิบถูกต้องแล้ว
    - เพิ่มสินค้าที่หยิบถูกต้องลง local cart
    - sync cart ไป Redis ด้วย key จาก `client_visits.id`
- ลูกค้าสามารถดูสินค้าและราคารวมใน cart ใน app ได้ตลอดบน mobile/tablet

## IOT Integration
- IOT URL ให้ config ผ่าน env
    ```txt
    IOT_SERVER_URL=
    IOT_WS_URL=
    ```
- App ต้องส่ง `client_visits.id` ไปให้ IOT server ในชื่อ `clientId`
- ไม่ส่ง `productId` หรือ `inventoryId` ไปให้ IOT server
- Transaction payload ส่ง `shelfId`, `amount`, และ `weightPerPiece`
- `weightPerPiece` มาจาก inventory ที่ลูกค้าเลือก เพื่อให้ IOT server คำนวณน้ำหนักเทียบกับค่าที่ config ไว้ฝั่ง server
- ตัวอย่าง payload
    ```jsonc
    {
      "clientId": "clientVisitId",
      "transactions": [
        {
          "shelfId": "shelfId1",
          "amount": 10,
          "weightPerPiece": 250
        },
        {
          "shelfId": "shelfId2",
          "amount": 4,
          "weightPerPiece": 500
        }
      ]
    }
    ```
- กรณีเลือกหลาย inventory ใน shelf เดียวกันและน้ำหนักต่อชิ้นต่างกัน สามารถมีหลาย transaction ที่ `shelfId` ซ้ำกันได้
- IOT server ต้อง watch `client_visits.id` พร้อม transaction ที่ส่งไป
- ถ้าหยิบครบตามจำนวน ให้ IOT clear watch ทิ้ง
- ถ้าหยิบเกินหรือขาด ให้ IOT แจ้งเตือนกลับมาแบบ realtime
- Notification ให้เน้น in-app notification ก่อน
- ช่องทาง realtime ที่ต้องการคือ websocket
- ลูกค้า, admin, และ superAdmin ต้องได้รับ notification
- Back-office ต้องขึ้น alert พร้อมชื่อลูกค้าคนนั้น
- เรื่องเสียงเตือนที่ตู้ยังไม่อยู่ใน scope ตอนนี้

## Tables
ทุก table ต้องมี `createdAt`, `updatedAt`, `deletedAt`

### groups
- id (PK UUID)
- name

### shelfs
- id (PK UUID)
- groupId (optional FK -> groups)
- name
- imageUrl (optional)
- sensorId
    - เป็น sensor id ของ IOT
    - ตอนนี้ mock ไว้ก่อน เพราะต้องรอ IOT API สำหรับดึง list sensor

### inventories
- id (PK UUID)
- shelfId (FK -> shelfs)
- name
- description (optional)
- price (double)
- amount
- weightPerPiece
- unitId (FK -> units)
- isActive
- imageUrl (optional)

### qr_codes
- id (PK UUID)
- imageUrl (optional)
- shelfIds
    - เก็บเป็น string
    - ถ้ามีมากกว่า 1 shelfId ให้คั่นด้วย comma
- encodedPayload
    - encode จาก payload ด้วย `ENCODE_KEY`
- description

### units
- id (PK UUID)
- name

### carts
- ใช้ local cart ใน client ก่อน
- หลัง IOT success ให้ sync ไป Redis
- Redis key ใช้ `client_visits.id`
- Redis value เก็บรายการ inventory ที่หยิบถูกต้อง พร้อมจำนวนและราคา snapshot

### orders
- หลังจากลูกค้าออกจากร้าน ข้อมูล cart ของ `client_visits.id` นั้นจะถูก feed เข้า table นี้
- ต้องมี payment/status แม้ payment จริงยังไม่พร้อม
- Payment mock เป็นชำระสำเร็จไปก่อน
- สถานะที่ควรมีอย่างน้อย
    - `pending`
    - `paid`
    - `failed`
    - `cancelled`

### order_items
- เก็บ snapshot รายการสินค้าจาก cart ตอนออกจากร้าน
- ควรเก็บ `inventoryId`, `name`, `price`, `amount`, `weightPerPiece`, `unitId`

### notifications
- ใช้สำหรับ in-app notification จาก IOT websocket/callback
- ต้องรองรับผู้รับเป็นลูกค้า, admin, superAdmin
- ต้องเก็บ reference ไปยัง `client_visits.id`
- ควรเก็บ payload ดิบจาก IOT สำหรับ debug

## Excel Import
- Inventory CRUD ต้องรองรับ Excel import
- Import ทุก key ของ inventory
- `imageUrl` optional
- ถ้าข้อมูลซ้ำให้ update
- ต้องกำหนด unique key สำหรับตรวจซ้ำตอน implement

## QR Code
- QR code ผูกกับ shelf ได้มากกว่า 1 shelf
- หลังผูกแล้วให้ generate รูป QR แล้ว upload ไป S3
- เก็บ URL ไว้ใน `qr_codes.imageUrl`
- QR payload ต้อง encode ด้วย `ENCODE_KEY`
- เมื่อ scan แล้ว app decode payload แล้วเข้า shelf flow ด้านบน

## Cart
- ใช้ local cart ก่อน เพื่อให้ UX เร็วและยังทำงานได้ระหว่างรอ IOT
- หลัง IOT แจ้งว่าหยิบถูกต้องแล้ว ค่อย sync local cart ไป Redis
- Redis key ใช้ `client_visits.id`
- Cart UI ใช้ได้เฉพาะ mobile/tablet และ desktop ต้องถูก block

## Order
- หลังจากลูกค้าออกจากร้าน worker กล้องขาออกจะ trigger API
- API ต้อง feed cart จาก Redis เข้า DB เป็น order/order_items
- หลัง feed สำเร็จให้ clear Redis ของ `client_visits.id`
- Payment status ให้ mock เป็นสำเร็จไปก่อนจนกว่า payment feature จะพร้อม
- Pending payment integration ต้อง note ใน `note/pending_2026_07_01.xlsx`

## How To In and Out
- In: ลูกค้าเดินผ่านกล้องหน้าร้าน/ประตูเข้า
- Out: ลูกค้าเดินผ่านกล้องในร้าน/ประตูออก
- มี worker สำหรับกล้องแล้ว
- ต้อง provide API ให้ worker กล้องขาออก trigger เพื่อ feed data จาก Redis เข้า DB แล้ว clear Redis

## S3 Storage
- [docs](https://supabase.com/docs/guides/storage/uploads/s3-uploads)
- env set ใน `.env`
    ```txt
    S3_ACCESS_KEY_ID
    S3_SECRET_KEY
    S3_ENDPOINT
    S3_REGION
    S3_BUCKET
    S3_SHELF_IMAGE_FOLDER
    S3_PRODUCT_IMAGE_FOLDER
    S3_QR_CODE_IMAGE_FOLDER
    ```

## Redis
- env set ใน `.env`
    ```txt
    REDIS_HOST=127.0.0.1
    REDIS_PORT=6379
    REDIS_USERNAME=
    REDIS_PASSWORD=
    REDIS_DB=0
    REDIS_TLS=false
    ```

## Encoding
- env set ใน `.env`
    ```txt
    ENCODE_KEY=
    ```

## Priority Tasks Checklist
1. Inventory Management
    - Back-office สำหรับ admin และ superAdmin
    - Group CRUD
    - Shelf CRUD
        - Group optional
        - ถ้ามี group ให้เลือกจาก dropdown
        - รองรับ upload image ไป S3
    - Inventory CRUD
        - ใช้ `inventories` แทน product
        - ไม่มี `productId`
        - รองรับ upload image ไป S3
    - Inventory Excel Import
        - import ทุก key
        - `imageUrl` optional
        - ถ้าซ้ำให้ update
    - Unit CRUD ถ้าจำเป็นต่อการผูก `unitId`
    - QR Code Management
        - ผูก shelf ได้ 1 หรือหลาย shelf
        - generate QR image
        - upload QR image ไป S3
        - เก็บ `imageUrl`
        - encode payload ด้วย `ENCODE_KEY`
    - ปรับ back-office navigation ให้แยกเมนู config data ชัดเจน เช่น sidebar
2. Mobile/Tablet QR Scan
    - Hide UI บน desktop
    - Block route/API จาก desktop
    - Scan แล้ว decode QR payload
    - ถ้ามีหลาย shelf ให้เลือก shelf ก่อน
    - ถ้ามี shelf เดียวให้ไปหน้า inventory ของ shelf นั้นเลย
    - หน้าเลือก shelf แสดงรูปและชื่อในกล่องสี่เหลี่ยม
    - หน้า inventory แสดงรูป ชื่อ ราคา และ quantity control
    - เลือกสินค้าข้าม shelf ได้ใน integrated flow
    - Submit แล้ว trigger mock IOT URL
    - รับ IOT realtime notification ผ่าน websocket
    - หลัง IOT success ค่อย sync เข้า cart/Redis
3. Cart Management
    - Local cart ก่อน
    - Sync Redis ด้วย `client_visits.id` หลัง IOT success
    - แสดงรายการสินค้าและราคารวมใน app
4. Notification
    - In-app notification สำหรับลูกค้า
    - Alert ใน back-office สำหรับ admin และ superAdmin
    - รองรับ IOT websocket event สำหรับหยิบเกิน/หยิบขาด
5. Order Management
    - API สำหรับ worker กล้องขาออก trigger
    - Feed Redis cart เข้า orders/order_items
    - Mock payment เป็น paid/success
    - Clear Redis หลังสร้าง order สำเร็จ

## Pending Mock/Integration Note
- ต้องสร้างและดูแลไฟล์ `note/pending_2026_07_01.xlsx`
- รายการที่ต้องลงอย่างน้อย
    - Mock IOT open-door/watch URL
    - IOT websocket notification endpoint
    - IOT sensor list API สำหรับ `sensorId`
    - Payment mock เป็น paid/success
    - จุดที่ต้องกลับมาแก้เมื่อ server/payment พร้อม
