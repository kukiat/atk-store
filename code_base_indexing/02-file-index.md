# 02 — File Index

Generated: 2026-07-15 Asia/Bangkok

## Summary

| Group | Count |
| --- | --- |
| TS/TSX source files | 163 |
| Pages | 29 |
| Route handlers | 28 |
| Server action files | 4 |
| Services | 30 |
| Tests | 8 |

## App Pages

| File | Kind | Purpose |
| --- | --- | --- |
| src/app/admin/attendance/page.tsx | page | backdoor/mock หน้า attendance สำหรับทดสอบ entry/exit/status |
| src/app/admin/inventory/groups/page.tsx | page | redirect compatibility ไปหน้า QR/groups ใหม่ |
| src/app/admin/inventory/iot-poc/page.tsx | page | backdoor/mock ส่ง IoT/MQTT event และจำลองสถานะ loadcell |
| src/app/admin/inventory/items/page.tsx | page | จัดการ inventory items |
| src/app/admin/inventory/orders/page.tsx | page | ดู orders และสถานะคำสั่งซื้อ |
| src/app/admin/inventory/page.tsx | page | หลังบ้าน inventory overview |
| src/app/admin/inventory/qr/page.tsx | page | สร้าง/จัดการ QR สำหรับ inventory เดี่ยวหรือ grouped QR |
| src/app/admin/inventory/receipt-settings/page.tsx | page | ตั้งค่า store/receipt |
| src/app/admin/inventory/shelfs/page.tsx | page | redirect compatibility ของคำว่า shelfs |
| src/app/admin/inventory/units/page.tsx | page | จัดการหน่วยสินค้า |
| src/app/admin/page.tsx | page | Dashboard หลังบ้านสำหรับ admin/super admin |
| src/app/admin/users/[id]/page.tsx | page | รายละเอียด user, roles, wallet และ audit context |
| src/app/admin/users/page.tsx | page | จัดการ user, account status และ roles |
| src/app/admin/wallets/page.tsx | page | ตรวจ wallet และ ledger ในระบบหลังบ้าน |
| src/app/cart/page.tsx | page | ตะกร้าของ active visit อ่านจาก server-side cart sync และรอ checkout จาก exit camera |
| src/app/inventory/[id]/page.tsx | page | หน้ารายละเอียด inventory และเปิด IoT session เพื่อหยิบสินค้า |
| src/app/page.tsx | page | Home หลัง sign-in แสดงสถานะ face, checkout notice, scan eligibility และทางเข้า scan/cart |
| src/app/receipts/[receiptNo]/page.tsx | page | รายละเอียด receipt และเอกสารใบเสร็จ |
| src/app/receipts/page.tsx | page | รายการ receipts ของผู้ใช้ |
| src/app/register-face/page.tsx | page | หน้าลงทะเบียน Face Liveness สำหรับผู้ใช้ที่ยังไม่ registered |
| src/app/scan/inventories/page.tsx | page | หน้ารายการ inventory สำหรับ fallback/manual scan flow |
| src/app/scan/page.tsx | page | หน้าเปิดกล้อง scan inventory/grouped QR โดยตรวจ store eligibility ก่อน |
| src/app/scan/shelves/page.tsx | page | หน้า legacy/backdoor ของ shelves catalog |
| src/app/shelf/[id]/page.tsx | page | หน้า shelf legacy compatibility |
| src/app/signin/page.tsx | page | หน้า Google sign-in และ error message จาก OAuth callback |
| src/app/unsupported-device/page.tsx | page | หน้าแจ้งว่าฟีเจอร์ scan/inventory/cart ใช้ได้เฉพาะ mobile/tablet |
| src/app/verify-face/page.tsx | page | หน้า debug สำหรับ verify face เมื่อเปิด ENABLE_FACE_RECOGNITION_DEBUG |
| src/app/wallet/page.tsx | page | หน้า wallet, balance, ledger และสร้าง Stripe top-up |
| src/app/wallet/topup/success/page.tsx | page | หน้า redirect หลัง Stripe Checkout submit |

## Route Handlers

| File | Kind | Purpose |
| --- | --- | --- |
| src/app/api/animation-api/users/route.ts | route-handler | API สำหรับ animation/demo user feed |
| src/app/api/auth/callback/google/route.ts | route-handler | รับ OAuth callback, validate ID token, upsert user และเปิด DB session |
| src/app/api/auth/signin/google/route.ts | route-handler | เริ่ม Google OAuth ด้วย state, PKCE และ nonce cookies |
| src/app/api/auth/signout/route.ts | route-handler | ปิด session และ clear cookies |
| src/app/api/cart/active/route.ts | route-handler | อ่าน active cart จาก cart sync |
| src/app/api/client-attendance/exit-order/route.ts | route-handler | Camera API สำหรับ exit แล้ว trigger wallet checkout |
| src/app/api/client-attendance/recognize/route.ts | route-handler | Camera API สำหรับ entry/sighting recognition |
| src/app/api/face/auth-status/route.ts | route-handler | ตรวจ token bridge สำหรับ Face Liveness แบบไม่เรียก AWS |
| src/app/api/face/credentials/route.ts | route-handler | แลก Google ID token cookie เป็น Cognito temporary credentials |
| src/app/api/face/result/route.ts | route-handler | อ่านผล liveness และ register/verify กับ Face Collection |
| src/app/api/face/session/route.ts | route-handler | สร้าง/reuse Rekognition Face Liveness session สำหรับ enrollment/verification |
| src/app/api/health-check/route.ts | route-handler | health check endpoint |
| src/app/api/iot/catalog/inventories/route.ts | route-handler | catalog inventory สำหรับ scan/admin |
| src/app/api/iot/catalog/shelves/route.ts | route-handler | legacy shelf catalog endpoint ที่ตอบ gone/removed |
| src/app/api/iot/events/route.ts | route-handler | รับ IoT/loadcell event จากอุปกรณ์หรือ worker |
| src/app/api/iot/mock-events/route.ts | route-handler | backdoor/mock ส่ง IoT event จาก browser/admin |
| src/app/api/iot/sessions/[sessionId]/events/route.ts | route-handler | SSE แจ้ง IoT session updates |
| src/app/api/iot/sessions/[sessionId]/route.ts | route-handler | อ่านสถานะ IoT session |
| src/app/api/iot/watch/route.ts | route-handler | เปิด IoT watch/session หลัง scan inventory QR |
| src/app/api/mock-iot-server/pick-sessions/route.ts | route-handler | mock IoT server ดึง pick sessions |
| src/app/api/mock-iot-server/product/[productId]/route.ts | route-handler | mock IoT server อ่าน product config สำหรับอุปกรณ์จำลอง |
| src/app/api/mock-iot-server/shelves/open/route.ts | route-handler | legacy mock shelf open endpoint ที่ถูกถอดออก |
| src/app/api/orders/active-visit-events/route.ts | route-handler | SSE แจ้ง active visit/cart/checkout changes |
| src/app/api/orders/active-visit-status/route.ts | route-handler | อ่าน active visit/cart/checkout status ของผู้ใช้ |
| src/app/api/qr/decode/route.ts | route-handler | decode QR payload/image สำหรับ scan flow |
| src/app/api/shelf/[id]/route.ts | route-handler | legacy shelf endpoint ที่ตอบ gone/removed |
| src/app/api/stripe/webhook/route.ts | route-handler | รับ Stripe webhook สำหรับ wallet top-up |
| src/app/inventories/route.ts | route-handler | alias compatibility ของ inventory catalog |

## Server Actions

| File | Kind | Purpose |
| --- | --- | --- |
| src/app/admin/actions.ts | server-actions | Server Actions สำหรับ admin user, roles, face reset, attendance override, inventory/unit/QR |
| src/app/admin/inventory/iot-poc/actions.ts | server-actions | Server Actions สำหรับส่ง mock IoT/MQTT events |
| src/app/admin/inventory/receipt-settings/actions.ts | server-actions | Server Action สำหรับบันทึก receipt/store settings |
| src/app/wallet/actions.ts | server-actions | Server Action สำหรับสร้าง Stripe wallet top-up |

## Services

| File | Kind | Purpose |
| --- | --- | --- |
| src/services/admin-attendance.service.ts | service | admin attendance views และ mock/status operations |
| src/services/admin-inventory.service.ts | service | CRUD inventory, units, QR, settings และ admin inventory queries |
| src/services/admin-user.service.ts | service | admin user management, roles และ account status |
| src/services/animation.service.ts | service | source file |
| src/services/cart-events.service.ts | service | source file |
| src/services/cart-sync.service.ts | service | เก็บ active cart ต่อ visit ใน Redis ถ้ามี หรือ fallback memory สำหรับ local/dev |
| src/services/client-attendance.service.ts | service | ประมวลผล camera entry/exit และ visit state |
| src/services/client-visit.service.ts | service | source file |
| src/services/face-enrollment.service.ts | service | orchestrate Face Liveness sessions/results และ persist recognition outcome |
| src/services/face-recognition.service.ts | service | Search/Index Rekognition Face Collection และ map FaceId กับ user |
| src/services/inventory.service.ts | service | source file |
| src/services/iot-event-processor.service.ts | service | ประมวลผล IoT/loadcell event ให้เป็น session event |
| src/services/iot-inventory-catalog.service.ts | service | source file |
| src/services/iot-loadcell-contract.ts | service | source file |
| src/services/iot-mqtt-message-handler.ts | service | รับ MQTT payload, validate contract และบันทึก processing log |
| src/services/iot-mqtt-message-log.contract.ts | service | source file |
| src/services/iot-mqtt-message-log.service.ts | service | source file |
| src/services/iot-session-events.service.ts | service | pub/sub IoT session updates ด้วย Redis เมื่อ config พร้อม และ fallback local listeners |
| src/services/iot-session.service.ts | service | จัดการ IoT session lifecycle, picked count, door close/error และ cart updates |
| src/services/iot.service.ts | service | source file |
| src/services/mock-iot-server.service.ts | service | service ฝั่ง mock IoT server |
| src/services/order-events.service.ts | service | source file |
| src/services/order.service.ts | service | สร้าง/อ่าน order จาก active visit/cart |
| src/services/product.service.ts | service | source file |
| src/services/receipt.service.ts | service | สร้างและอ่าน receipts หลัง payment/checkout |
| src/services/role.service.ts | service | source file |
| src/services/s3-storage.service.ts | service | source file |
| src/services/store-access.service.ts | service | ตัดสินสิทธิ์ scan จาก active visit, wallet balance และ inventory availability |
| src/services/user.service.ts | service | source file |
| src/services/wallet.service.ts | service | wallet, ledger, Stripe top-up และ checkout debit |

## Components

| File | Kind | Purpose |
| --- | --- | --- |
| src/components/account-nav.tsx | component | UI component สำหรับ flow หน้าเว็บ |
| src/components/authenticated-nav.tsx | component | UI component สำหรับ flow หน้าเว็บ |
| src/components/cart-bar.tsx | component | UI component สำหรับ flow หน้าเว็บ |
| src/components/checkout-paid-notice.tsx | component | UI component สำหรับ flow หน้าเว็บ |
| src/components/face-auth-status-notice.tsx | component | UI component สำหรับ flow หน้าเว็บ |
| src/components/face-enrollment-prompt.tsx | component | UI component สำหรับ flow หน้าเว็บ |
| src/components/face-liveness-registration.tsx | component | UI component สำหรับ flow หน้าเว็บ |
| src/components/face-verification-debug-prompt.tsx | component | UI component สำหรับ flow หน้าเว็บ |
| src/components/face-verification-debug.tsx | component | UI component สำหรับ flow หน้าเว็บ |
| src/components/image-preview-dialog.tsx | component | UI component สำหรับ flow หน้าเว็บ |
| src/components/image-upload-field.tsx | component | UI component สำหรับ flow หน้าเว็บ |
| src/components/product-card.tsx | component | UI component สำหรับ flow หน้าเว็บ |
| src/components/quantity-stepper.tsx | component | UI component สำหรับ flow หน้าเว็บ |
| src/components/receipt-document.tsx | component | UI component สำหรับ flow หน้าเว็บ |
| src/components/theme-toggle.tsx | component | UI component สำหรับ flow หน้าเว็บ |
| src/components/ui/badge.tsx | ui-component | primitive UI component |
| src/components/ui/button.tsx | ui-component | primitive UI component |
| src/components/ui/card.tsx | ui-component | primitive UI component |
| src/components/ui/separator.tsx | ui-component | primitive UI component |
| src/components/ui/sheet.tsx | ui-component | primitive UI component |

## Libraries

| File | Kind | Purpose |
| --- | --- | --- |
| src/lib/auth-shared.ts | library | helper/config/state utility |
| src/lib/auth-tokens.ts | library | helper/config/state utility |
| src/lib/auth.ts | library | helper/config/state utility |
| src/lib/aws-face-recognition.ts | library | helper/config/state utility |
| src/lib/aws-liveness.ts | library | helper/config/state utility |
| src/lib/client-attendance-auth.ts | library | helper/config/state utility |
| src/lib/device.ts | library | helper/config/state utility |
| src/lib/face-camera-cleanup.ts | library | helper/config/state utility |
| src/lib/face-recognition-state.ts | library | helper/config/state utility |
| src/lib/face-token.ts | library | helper/config/state utility |
| src/lib/format.ts | library | helper/config/state utility |
| src/lib/google-id-token-claims.ts | library | helper/config/state utility |
| src/lib/google-id-token.ts | library | helper/config/state utility |
| src/lib/iot-api-auth.ts | library | helper/config/state utility |
| src/lib/liveness-state.ts | library | helper/config/state utility |
| src/lib/money.ts | library | helper/config/state utility |
| src/lib/permissions.ts | library | helper/config/state utility |
| src/lib/qr-image.ts | library | helper/config/state utility |
| src/lib/qr-payload.ts | library | helper/config/state utility |
| src/lib/stripe.ts | library | helper/config/state utility |
| src/lib/use-hydrated.ts | library | helper/config/state utility |
| src/lib/use-suppress-readable-stream-cancel-error.ts | library | helper/config/state utility |
| src/lib/utils.ts | library | helper/config/state utility |

## Database

| File | Kind | Purpose |
| --- | --- | --- |
| src/db/db_schema.ts | database | database schema/client/seed |
| src/db/index.ts | database | database schema/client/seed |
| src/db/schema.ts | database | database schema/client/seed |
| src/db/seed.ts | database | database schema/client/seed |

## State/Types/Proxy

| File | Kind | Purpose |
| --- | --- | --- |
| src/proxy.ts | proxy | source file |
| src/store/cart.ts | client-store | client state store |
| src/types/index.ts | source | source file |
| src/types/qrcode.d.ts | source | source file |

## Tests

| File | Kind | Purpose |
| --- | --- | --- |
| src/lib/auth-tokens.test.ts | test | ชุดทดสอบ behavior/contract ของ module |
| src/lib/face-recognition-state.test.ts | test | ชุดทดสอบ behavior/contract ของ module |
| src/lib/google-id-token.test.ts | test | ชุดทดสอบ behavior/contract ของ module |
| src/lib/liveness-state.test.ts | test | ชุดทดสอบ behavior/contract ของ module |
| src/lib/money.test.ts | test | ชุดทดสอบ behavior/contract ของ module |
| src/lib/permissions.test.ts | test | ชุดทดสอบ behavior/contract ของ module |
| src/services/iot-loadcell-contract.test.ts | test | ชุดทดสอบ behavior/contract ของ module |
| src/services/iot-mqtt-message-handler.test.ts | test | ชุดทดสอบ behavior/contract ของ module |
