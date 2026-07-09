# IOT Server Integration Implementation Plan

Updated: 2026-07-09

Source plan: `note/iot_sv_integration_plan.md`

## Implementation Status

Implemented in this workspace on 2026-07-09.

- Inventory-centric QR payload, scan flow, admin QR builder, and inventory session page are implemented.
- IOT-facing inventory catalog is available at `GET /inventories` and `GET /api/iot/catalog/inventories`.
- DB-backed `iot_sessions` and `iot_session_events` replace the old in-memory session store.
- Loadcell MQTT/raw event adapter is the primary parser for IOT events.
- Legacy shelf/group data model was removed in the migration; legacy shelf routes are redirect/410 compatibility stubs only.
- Verification passed: `npx tsc --noEmit --pretty false`, `npm run lint`, `npm test`, and `npm run build`.

## Scope

ปรับ ATK Store จาก flow แบบ shelf-centric ไปเป็น inventory-centric ตามแผนใหม่ของ IOT:

- app เป็นเจ้าของ inventory catalog, cart, order, wallet และ customer session
- iot เป็นเจ้าของ in-store mapping, device/loadcell state, shelf door status และ branch-specific MQTT publisher
- QR payload ของ app เปลี่ยนจาก `shelfIds` เป็น `inventoryIds`
- session runtime ใช้ UUID ที่ app generate แล้วส่งให้ iot ผ่าน `/set-topic`
- MQTT topic ใช้ branch จาก `BRANCH_CODE`

## Updated Environment Contract

ใช้ env ชุดนี้เป็น baseline ของ integration ใหม่:

```txt
IOT_SERVER_IS_MOCK=false
IOT_POC_EVENT_TRANSPORT=direct
MQTT_ENABLED=true
MQTT_BROKER_URL=
MQTT_USERNAME=
MQTT_PASSWORD=
IOT_API_KEY=
IOT_SERVER_URL=http://localhost:3000/api/iot
BRANCH_CODE=main
```

Notes:

- `MQTT_USERNAME` และ `MQTT_PASSWORD` ต้องอ่านเฉพาะ server/worker เท่านั้น ห้าม expose ผ่าน client component หรือ `NEXT_PUBLIC_`.
- `IOT_API_KEY` ใช้ป้องกัน endpoint ที่ app provide ให้ iot เช่น `GET /inventories`.
- `BRANCH_CODE` ใช้เป็น topic segment: `{uuid}/loadcell/{BRANCH_CODE}/{productId}/event|status`; `productId` ใน topic คือ app `inventoryId`.
- `BRANCH_CODE` เป็น branch/store identifier หลักของ IOT flow ใหม่; deprecate `IOT_STORE_ID` usage ในส่วน IOT ใหม่.
- `IOT_SERVER_URL` เป็น server-only base URL สำหรับเรียก iot server เช่น `GET /product/:productId` และ `POST /set-topic`.
- local/mock default ตอนนี้ชี้มาที่ `http://localhost:3000/api/iot`; production ต้องเปลี่ยนเป็น URL ของ iot server จริง.

## Review Findings

### 1. Inventory catalog API ต้องเป็น contract แยกสำหรับ IOT

แผนใหม่ระบุ `GET /inventories` และ response เป็น array:

```json
[
  {
    "id": "inventory uuid",
    "name": "xxx",
    "description": "xxx",
    "price": 123,
    "amount": 123,
    "image_url": "123.png"
  }
]
```

Decision: แยก implementation เป็น IOT-facing inventory catalog module เพื่อไม่ปนกับ internal/admin inventory shape.

Current app routes:

- `GET /inventories`
- `GET /api/iot/catalog/inventories`

Both use `src/services/iot-inventory-catalog.service.ts` and force active product filtering with `inventories.isActive = true` and `inventories.deletedAt IS NULL`.

### 2. Remove shelf configuration เป็นงาน blast radius สูง

`shelfs`, `groups`, `inventory.shelfId`, QR builder, scan pages, mock iot server, iot session service, receipts และ notification raw payload ยังผูกกับ shelf อยู่หลายจุด.

Decision: เนื่องจาก QR/data เก่ายังไม่ได้ใช้ทดสอบจริง ให้ cleanup แบบไม่รองรับ legacy โดยลบ shelf/group data และ column เดิมใน migration เดียวกับการย้าย flow เป็น inventory-centric.

### 3. MQTT contract ใหม่ไม่ตรงกับ parser ปัจจุบัน

โค้ดปัจจุบัน parse payload แบบ internal contract:

- `eventType: picked_count|final_count|door_closed|error`
- `referenceKey`
- `shelfId`
- `sensorId`

แต่ plan ใหม่จาก iot publish raw loadcell payload ผ่าน topic:

- topic event: `{uuid}/loadcell/{branch}/{productId}/event`
- topic status: `{uuid}/loadcell/{branch}/{productId}/status`
- event payload ใช้ `sku`, `pickedQty`, `currentQty`, `seq`
- status payload ใช้ `status === "shelf_closed"`

Recommendation: ปรับ plan ให้ใช้ adapter layer ใหม่เป็นทางหลัก และลด parser เก่าให้เหลือ legacy/direct-only ระหว่าง transition.

Target modules:

- `src/services/iot-loadcell-contract.ts`
  - parse topic `{uuid}/loadcell/{branch}/{productId}/{event|status}`
  - parse raw event/status payload จาก iot
  - validate `branch`, `productId`, `sku`
  - map topic `productId` to app `inventoryId`
  - keep `seq` as optional audit/debug data only
  - return normalized app event
- `src/services/iot-event-processor.service.ts`
  - รับ normalized app event เท่านั้น
  - update cart/session ผ่าน `iot-session.service`
  - do not depend on `seq` for business logic
- Removed legacy internal MQTT parser from active code; `src/services/iot-loadcell-contract.ts` is the only parser used by broker/API/mock event entrypoints.

Normalized event shape:

```ts
type IotNormalizedLoadcellEvent =
  | {
      type: "picked_count";
      sessionId: string;
      branchCode: string;
      inventoryId: string;
      pickedCount: number;
      currentQty: number | null;
      seq: number | null;
      occurredAt: string;
      rawPayload: Record<string, unknown>;
    }
  | {
      type: "door_closed";
      sessionId: string;
      branchCode: string;
      inventoryId: string;
      seq: number | null;
      occurredAt: string;
      rawPayload: Record<string, unknown>;
    };
```

Mapping rules:

- topic `uuid` -> `sessionId`
- topic `productId` -> app `inventoryId`
- event payload `pickedQty` -> cumulative cart quantity / session `pickedCount`
- event payload `currentQty` -> display-only in-store remaining quantity for the active shelf/session
- status payload `status === "shelf_closed"` -> close session
- payload `sku` must match topic `productId` when present
- topic `branch` and payload `branch` must match `BRANCH_CODE`
- event payload `seq` can be stored in `iot_session_events` for audit/debug, but app logic must not rely on it

### 4. Session store ควรย้ายไป DB ตั้งแต่แรก

`iot-session.service.ts` ตอนนี้ใช้ `globalThis` map ซึ่งพอสำหรับ local/PoC แต่เสี่ยงทันทีถ้า MQTT worker กับ Next route รันคนละ process/container เพราะ memory ไม่แชร์กัน.

Decision: implement DB-backed IOT session store ตั้งแต่รอบ integration นี้ เพื่อให้ app route, SSE route, mock flow และ MQTT worker เห็น session/event ชุดเดียวกัน.

Minimum tables:

- `iot_sessions`
  - `id` uuid primary key; ใช้เป็น session UUID ที่ส่งให้ iot `/set-topic`
  - `client_visit_id`
  - `user_id`
  - `inventory_id`
  - `branch_code`
  - `status`: `open|updated|closed|expired`
  - `picked_count`
  - `current_qty`
  - `in_store_qty`
  - `opened_at`, `updated_at`, `closed_at`
  - `metadata` jsonb สำหรับ raw iot product config / display fields
- `iot_session_events`
  - `id` uuid primary key
  - `session_id`
  - `inventory_id`
  - `branch_code`
  - `message_kind`: `event|status`
  - `event_type`: `picked_count|door_closed|error`
  - `seq` nullable; audit/debug only
  - `raw_payload` jsonb
  - `occurred_at`, `created_at`

Service changes:

- `iot-session.service.ts` ต้องอ่าน/เขียน DB แทน in-memory map
- SSE route ยังใช้ event bus สำหรับ notify live browser ได้ แต่ source of truth ต้องเป็น DB
- MQTT worker ต้อง update DB ด้วย service เดียวกับ route handler
- cart sync ต้องทำหลัง DB transaction apply event สำเร็จเท่านั้น
- Duplicate MQTT events are safe because `pickedQty` is cumulative and `door_closed` is idempotent.

### 5. `BRANCH_CODE` ต้อง validate กับทั้ง topic และ payload

ต้อง reject หรือ ignore event ที่:

- topic branch ไม่ตรง `BRANCH_CODE`
- payload `branch` ไม่ตรง `BRANCH_CODE`
- topic productId ไม่ตรง selected inventory id
- payload `sku` ไม่ตรง selected inventory id
- `seq` ไม่ต้องใช้ validate business flow; เก็บไว้ดูย้อนหลังได้ถ้า iot ส่งมา

### 6. QR group flow ต้องนิยามคำว่า grouped ใหม่

Decision:

- `grouped` ใน flow ใหม่หมายถึง QR ที่มีหลาย inventory ไม่ใช่ shelf group เดิม
- `1 inventoryId`: ไปหน้า inventory session ทันที
- `many inventoryId`: ไปหน้าเลือก inventory แล้วเลือก 1 inventory เพื่อเปิด session
- `1 session = 1 สินค้า`
- `1 inventory อยู่ได้ใน 1 shelf เท่านั้น`; app ใช้ `inventoryId` เป็นตัวเปิด session แล้วให้ iot resolve shelf/device mapping ฝั่งตัวเอง
- legacy shelf/group terminology ใน app ต้องไม่ถูกใช้เป็น source of truth ของ flow ใหม่

## Target Flow

### Inventory QR scan

1. User scan encrypted QR payload
2. app decode payload เป็น `{ inventoryIds: string[] }`
3. ถ้ามี 1 item redirect ไปหน้า inventory session
4. ถ้ามีหลาย item แสดง inventory cards ให้ user เลือก
5. เมื่อเลือก inventory แล้ว app สร้าง session UUID
6. app call iot `GET /product/:productId` เพื่อดึง `inStoreQty`
7. app call iot `POST /set-topic` ด้วย `{ uuid }`
8. app เปิด session view และรอ event ผ่าน SSE เดิม
9. MQTT worker รับ event/status จาก broker แล้ว update session/cart
10. เมื่อ status `shelf_closed` ให้ close session และหยุดรับ event ของ session นั้น

### MQTT topic

```txt
{uuid}/loadcell/{branchCode}/{productId}/event
{uuid}/loadcell/{branchCode}/{productId}/status
```

Example with default branch:

```txt
6823f6db-3e42-4a15-8f67-e68f9c942601/loadcell/main/1cf3f14a-d07b-437a-9750-a3b698f9a730/event
6823f6db-3e42-4a15-8f67-e68f9c942601/loadcell/main/1cf3f14a-d07b-437a-9750-a3b698f9a730/status
```

### Event mapping

IOT event payload:

```json
{
  "event": "item_picked",
  "seq": 1044,
  "sku": "inventory uuid",
  "currentQty": 95,
  "pickedQty": 5,
  "timestamp": "2026-06-24T10:30:00.125Z"
}
```

App normalized event:

```json
{
  "type": "picked_count",
  "sessionId": "uuid from topic",
  "inventoryId": "productId from topic (app inventoryId)",
  "pickedCount": 5,
  "currentQty": 95,
  "seq": 1044,
  "occurredAt": "2026-06-24T10:30:00.125Z"
}
```

Status payload:

```json
{
  "seq": 1045,
  "online": true,
  "status": "shelf_closed",
  "timestamp": "2026-06-24T10:31:00.125Z"
}
```

App normalized event:

```json
{
  "type": "door_closed",
  "sessionId": "uuid from topic",
  "inventoryId": "productId from topic (app inventoryId)",
  "seq": 1045,
  "occurredAt": "2026-06-24T10:31:00.125Z"
}
```

## Implementation Phases

### Phase 0: Lock contract with IOT

- App provides both `GET /inventories` and `GET /api/iot/catalog/inventories` through the same IOT-facing catalog module.
- Use `IOT_SERVER_URL` as the iot base URL env for `GET /product/:productId` and `POST /set-topic`.
- Protect app-provided IOT endpoints with `IOT_API_KEY`.
- Confirm whether `sku` always equals app `inventory.id`.
- `pickedQty` is cumulative selected quantity for current session, not delta.
- Do not use `seq` for ordering/business logic; store it only for audit/debug when present.
- Close rule: only `status === "shelf_closed"` closes session.

### Phase 1: Add inventory-centric QR payload and scan flow

Files:

- `src/lib/qr-payload.ts`
- `src/app/api/qr/decode/route.ts`
- `src/app/scan/qr-scanner.tsx`
- `src/app/scan/shelves/page.tsx` or new `src/app/scan/inventories/page.tsx`
- `src/app/admin/inventory/_qr-code-builder.tsx`
- `src/services/admin-inventory.service.ts`
- `src/db/schema.ts`

Tasks:

- Canonical new QR payload:

```json
{ "inventoryIds": ["..."] }
```

- Optional payload versioning can be added later, but the required contract is `inventoryIds`.
- No legacy QR compatibility is required because existing QR data can be deleted/regenerated before testing.
- QR scanner/decoder should accept only `{ "inventoryIds": [...] }`.
- New QR generator must create only `{ "inventoryIds": [...] }`.
- Add inventory selection page for grouped inventory QR.
- Update QR generator to select inventories, not shelves.
- Add UI copy that refers to inventory QR instead of shelf QR.
- Replace old QR data/table shape with inventory-based QR records; do not keep `shelfIds` fallback logic.

### Phase 2: Add IOT catalog endpoint for inventory master

Files:

- `src/app/api/iot/catalog/inventories/route.ts`
- alias: `src/app/inventories/route.ts`
- `src/services/iot-inventory-catalog.service.ts`
- `src/lib/iot-api-auth.ts`
- tests for route response

Tasks:

- Return contract field names exactly as agreed:

```json
[
  {
    "id": "inventory uuid",
    "name": "Product name",
    "description": "Description",
    "price": 123,
    "amount": 10,
    "image_url": "https://..."
  }
]
```

- Support `limit`, `offset`, `search`.
- Filter only active, non-deleted inventories.
- Use server-only auth check if IOT API key remains required.
- Do not expose MQTT credentials or branch env.

### Phase 3: Add DB-backed IOT session store

Files:

- `src/db/schema.ts`
- new drizzle migration
- `src/services/iot-session.service.ts`
- `src/services/iot-event-processor.service.ts`
- `src/app/api/iot/sessions/[sessionId]/route.ts`
- `src/app/api/iot/sessions/[sessionId]/events/route.ts`

Tasks:

- Add `iot_sessions` table.
- Add `iot_session_events` table for raw event audit/debug.
- Replace in-memory session map with DB queries/mutations.
- Keep SSE event publisher as notification mechanism only, not source of truth.
- Ensure `getSession`, `listSessions`, `applyPickedCount`, and `closeDoor` read/write DB.
- Wrap event apply + cart sync coordination so duplicate events cannot change cart twice.

### Phase 4: Replace open shelf service with open inventory session service

Files:

- `src/services/iot.service.ts`
- `src/services/iot-session.service.ts`
- `src/app/api/iot/watch/route.ts`
- new page: `src/app/inventory/[id]/page.tsx`
- replacement client component for `ShelfOpenSession`

Tasks:

- Change `/api/iot/watch` request body from `{ shelfId }` to `{ inventoryId }`.
- Load inventory from app DB.
- Generate `sessionId` UUID before calling IOT.
- Call iot `GET /product/:productId` and store/display `inStoreQty`.
- Call iot `POST /set-topic` with `{ uuid: sessionId }`.
- Create session with `inventoryId`, `inventoryName`, `pickedCount`, `currentQty`, `branchCode`, and no required shelf fields.
- Continue publishing SSE through `/api/iot/sessions/:sessionId/events` so frontend cart update model stays stable.
- Remove or replace legacy shelf scan route as part of the clean QR migration.

### Phase 5: Implement loadcell MQTT adapter

Files:

- `script/iot-mqtt-worker.ts`
- new `src/services/iot-loadcell-contract.ts`
- `src/services/iot-event-processor.service.ts`
- `src/services/iot-session.service.ts`
- `src/app/admin/inventory/iot-poc/actions.ts`

Tasks:

- Subscribe to wildcard topic:

```txt
+/loadcell/{BRANCH_CODE}/+/event
+/loadcell/{BRANCH_CODE}/+/status
```

- Parse topic into `{ sessionId, branchCode, inventoryId, messageKind }`.
- Validate `branchCode === process.env.BRANCH_CODE || "main"`.
- For `event`, map cumulative `pickedQty` to app cart quantity and `currentQty` to display-only in-store remaining quantity.
- For `status`, when `status === "shelf_closed"`, close the session.
- Store `seq` in the session event row when present, but do not use it to reject/update events.
- Reject malformed payloads into structured logs and mark session error only when the payload belongs to an active session.
- Remove or isolate old `atk/store/{storeId}/shelf/{shelfId}/events` POC topic contract.

### Phase 6: Mock server and local POC parity

Files:

- `src/services/mock-iot-server.service.ts`
- `src/app/api/mock-iot-server/**`
- `src/app/admin/inventory/iot-poc/page.tsx`
- `src/app/admin/inventory/iot-poc/actions.ts`

Tasks:

- Add mock `GET /product/:productId`.
- Add mock `POST /set-topic`.
- Update mock event publisher to use new topic:

```txt
{uuid}/loadcell/{BRANCH_CODE}/{productId}/event
```

- Add mock status publisher for `shelf_closed`.
- Keep `IOT_SERVER_IS_MOCK=true` running without external broker if `IOT_POC_EVENT_TRANSPORT=direct`.
- If `MQTT_ENABLED=true`, publish through broker using `MQTT_BROKER_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`.

### Phase 7: Database cleanup

Files:

- `src/db/schema.ts`
- new drizzle migration
- `src/services/admin-inventory.service.ts`
- admin inventory UI
- receipt/order services

Tasks:

- Remove shelf admin UI and routes.
- Remove active runtime dependency on `shelfs` and `groups`.
- Remove `inventories.shelfId` after all reads are gone.
- Delete shelf-related data and remove `receipt_items.shelfId` column together with the rest of shelf cleanup.
- Delete old QR rows/data that use `shelfIds`, then recreate QR data with inventory IDs.
- Remove old IOT shelf mapping sync code.

Status: completed in `drizzle/0007_iot_inventory_sessions.sql`; legacy shelf pages/API are kept only as redirect/410 stubs.

## Test Plan

### Unit/service tests

- QR encode/decode supports only the new inventory payload.
- Inventory catalog endpoint maps field names and filters deleted/inactive products.
- Loadcell topic parser rejects invalid branch/topic/message kind.
- Event adapter maps cumulative `pickedQty` to cart quantity and `currentQty` to display-only in-store remaining quantity.
- Event processing does not depend on `seq`.
- `shelf_closed` status closes session once.

### Integration tests

- Scan QR with one inventory id opens inventory session.
- Scan QR with many inventory ids shows inventory selection.
- Inventory session calls set-topic with generated UUID.
- MQTT event updates cart quantity.
- MQTT status closes session and stops frontend waiting state.
- Mock mode works without external IOT server.

### Manual POC

1. Set env:

```txt
IOT_SERVER_IS_MOCK=true
IOT_POC_EVENT_TRANSPORT=direct
MQTT_ENABLED=false
BRANCH_CODE=main
```

2. Generate inventory QR from admin.
3. Scan QR on mobile.
4. Select inventory if QR has multiple inventories.
5. Simulate `pickedQty=1`, then `pickedQty=3`.
6. Confirm cart shows 3 pieces.
7. Simulate `status=shelf_closed`.
8. Confirm session closes and cart remains at final picked count.

Then test broker path:

```txt
IOT_SERVER_IS_MOCK=false
IOT_POC_EVENT_TRANSPORT=mqtt
MQTT_ENABLED=true
MQTT_BROKER_URL=
MQTT_USERNAME=
MQTT_PASSWORD=
BRANCH_CODE=main
```

Run:

```bash
npm run iot:mqtt
npm run dev
```

## Rollout Checklist

- Contract confirmed with IOT team.
- `.env.example` includes `IOT_API_KEY` and `BRANCH_CODE=main`.
- No MQTT credentials are referenced in client components.
- Old shelf QR data is deleted/regenerated before testing.
- Inventory QR generation available in admin.
- IOT catalog endpoint verified by IOT server.
- Mock direct flow verified.
- MQTT broker flow verified.
- DB cleanup migration reviewed separately.
