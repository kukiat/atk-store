# 04 — Data Model

Source: `src/db/schema.ts`. Dialect: PostgreSQL (Drizzle ORM).

## Tables

### `shelves`

A physical smart shelf. `id` is the human-readable code encoded in the shelf QR (e.g. `"A12"`).

| Column       | Type          | Constraints                  |
| ------------ | ------------- | ---------------------------- |
| `id`         | `text`        | **PK** (QR code, e.g. `A12`) |
| `name`       | `text`        | not null                     |
| `location`   | `text`        | nullable                     |
| `created_at` | `timestamptz` | not null, default `now()`    |

### `products`

Catalog product. Prices are stored as **integer satang** (`price_cents`) to avoid float money bugs.

| Column        | Type          | Constraints               |
| ------------- | ------------- | ------------------------- |
| `id`          | `serial`      | **PK**                    |
| `sku`         | `text`        | not null, **unique**      |
| `name`        | `text`        | not null                  |
| `description` | `text`        | nullable                  |
| `price_cents` | `integer`     | not null (satang)         |
| `image_url`   | `text`        | nullable                  |
| `stock`       | `integer`     | not null, default `0`     |
| `created_at`  | `timestamptz` | not null, default `now()` |

### `shelf_products` (join)

Many-to-many: a product can live on several shelves; `position` orders it on a shelf.

| Column       | Type      | Constraints                                      |
| ------------ | --------- | ------------------------------------------------ |
| `shelf_id`   | `text`    | not null, FK → `shelves.id` (on delete cascade)  |
| `product_id` | `integer` | not null, FK → `products.id` (on delete cascade) |
| `position`   | `integer` | not null, default `0`                            |
| —            | —         | **PK** = (`shelf_id`, `product_id`)              |

### `users`

An enrolled customer, one row per person keyed by email. `auth_method` records the
sign-in channel so multiple providers can be supported over time.

| Column                   | Type                            | Constraints                                                   |
| ------------------------ | ------------------------------- | ------------------------------------------------------------- |
| `id`                     | `serial`                        | **PK**                                                        |
| `email`                  | `text`                          | not null, **unique** (normalized lowercase)                   |
| `name`                   | `text`                          | nullable                                                      |
| `avatar_url`             | `text`                          | nullable                                                      |
| `auth_method`            | `auth_method` (enum)            | not null, default `google`                                    |
| `provider_account_id`    | `text`                          | nullable (Google OIDC `sub` for Google users)                 |
| `face_enrollment_status` | `face_enrollment_status` (enum) | not null, default `not_registered`                            |
| `face_registered_at`     | `timestamptz`                   | nullable (set when liveness passes and `IndexFaces` succeeds) |
| `created_at`             | `timestamptz`                   | not null, default `now()`                                     |
| `updated_at`             | `timestamptz`                   | not null, default `now()`                                     |
| `last_login_at`          | `timestamptz`                   | nullable                                                      |

### `sessions`

A server-side login session. The opaque `id` is the random token stored in the
user's httpOnly cookie (`atk_session`).

| Column       | Type          | Constraints                                             |
| ------------ | ------------- | ------------------------------------------------------- |
| `id`         | `text`        | **PK** (SHA-256 hash of the random opaque cookie token) |
| `user_id`    | `integer`     | not null, FK → `users.id` (on delete cascade)           |
| `expires_at` | `timestamptz` | not null                                                |
| `created_at` | `timestamptz` | not null, default `now()`                               |

### `face_liveness_attempts`

One Amazon Rekognition Face Liveness attempt per row. Stores only the metadata
needed to deduplicate requests, read an owned result, and audit a decision. It
never stores raw selfie video or AWS credentials; `reference_s3_key` points at
the private Tokyo output object, not its bytes.

| Column                 | Type                              | Constraints                                                                                      |
| ---------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `id`                   | `serial`                          | **PK**                                                                                           |
| `user_id`              | `integer`                         | not null, FK → `users.id` (on delete cascade)                                                    |
| `session_id`           | `text`                            | not null, **unique** (Rekognition `SessionId`)                                                   |
| `client_request_token` | `text`                            | not null (idempotency token for Create)                                                          |
| `intent`               | `face_liveness_intent` (enum)     | not null, default `enrollment`                                                                   |
| `status`               | `liveness_attempt_status` (enum)  | not null, default `pending`                                                                      |
| `confidence`           | `double precision`                | nullable (0-100; set after a result is read)                                                     |
| `reference_s3_key`     | `text`                            | nullable (S3 key of the verified reference image)                                                |
| `recognition_outcome`  | `face_recognition_outcome` (enum) | nullable (terminal recognition decision)                                                         |
| `matched_face_id`      | `text`                            | nullable (matched/indexed Rekognition `FaceId`)                                                  |
| `matched_user_id`      | `integer`                         | nullable, FK → `users.id` (on delete set null)                                                   |
| `face_similarity`      | `double precision`                | nullable (`SearchFacesByImage` similarity)                                                       |
| `expires_at`           | `timestamptz`                     | not null (session single-use ~3 min lifetime)                                                    |
| `created_at`           | `timestamptz`                     | not null, default `now()`                                                                        |
| `updated_at`           | `timestamptz`                     | not null, default `now()`                                                                        |
| —                      | —                                 | **partial unique index** on (`user_id`) where `status = 'pending'` (one active attempt per user) |

### `user_face_profiles`

One row per enrolled app user face profile. Amazon Rekognition stores the
AWS-managed facial features inside the Face Collection; this table stores only
the returned IDs and ownership metadata.

| Column                | Type               | Constraints                                         |
| --------------------- | ------------------ | --------------------------------------------------- |
| `id`                  | `serial`           | **PK**                                              |
| `user_id`             | `integer`          | not null, **unique**, FK → `users.id` cascade       |
| `collection_id`       | `text`             | not null (e.g. `atk-store-face-collection-dev`)     |
| `face_id`             | `text`             | not null, **unique** (Rekognition `FaceId`)         |
| `image_id`            | `text`             | nullable (Rekognition `ImageId`)                    |
| `external_image_id`   | `text`             | not null, non-PII app ID (`atk-store-user-{id}`)    |
| `confidence`          | `double precision` | nullable (`IndexFaces` face confidence)             |
| `reference_s3_key`    | `text`             | nullable (source liveness reference image key)      |
| `liveness_attempt_id` | `integer`          | nullable, FK → `face_liveness_attempts.id` set null |
| `created_at`          | `timestamptz`      | not null, default `now()`                           |
| `updated_at`          | `timestamptz`      | not null, default `now()`                           |

## Enums

### `auth_method`

Supported sign-in channels. `google` is live; the rest are pre-declared so adding a
channel needs no schema change: `google`, `facebook`, `line`, `apple`, `credentials`.

### `face_enrollment_status`

Server-authoritative face-enrollment state used by the post-login UI prompt:
`not_registered`, `pending`, `registered`. A user moves to `registered` only
after backend liveness acceptance and successful `IndexFaces`/profile mapping.

### `liveness_attempt_status`

Lifecycle of a single liveness attempt: `pending`, `succeeded`, `failed`,
`expired`, `cancelled`. Terminal states are never reused.

### `face_liveness_intent`

Why a liveness session exists: `enrollment` can index a face after liveness
passes; `verification` can only search the existing collection and must not
create a new face profile.

### `face_recognition_outcome`

Terminal recognition decision stored on an attempt: `registered`, `verified`,
`mismatch`, `duplicate`, `not_indexed`.

## Relations

- `shelves` 1—\* `shelf_products`
- `products` 1—\* `shelf_products`
- `shelf_products` _—1 `shelves`, _—1 `products`
- `users` 1—\* `sessions`
- `users` 1—\* `face_liveness_attempts`
- `users` 1—0/1 `user_face_profiles`
- `face_liveness_attempts` 0/1—1 `user_face_profiles` (source attempt)
- unique index: (`users.auth_method`, `users.provider_account_id`) when an identity is present
- `sessions` \*—1 `users`
- `face_liveness_attempts` \*—1 `users`
- `face_liveness_attempts.matched_user_id` \*—0/1 `users`

```
shelves ──< shelf_products >── products
              (position)

users ──< sessions
  │
  ├──< face_liveness_attempts
  │
  └── user_face_profiles  (FaceId mapping)
```

## Inferred TypeScript types

| Type                     | Source                                                   |
| ------------------------ | -------------------------------------------------------- |
| `Shelf`                  | `typeof shelves.$inferSelect`                            |
| `Product`                | `typeof products.$inferSelect`                           |
| `ShelfProduct`           | `typeof shelfProducts.$inferSelect`                      |
| `User`                   | `typeof users.$inferSelect`                              |
| `NewUser`                | `typeof users.$inferInsert`                              |
| `Session`                | `typeof sessions.$inferSelect`                           |
| `FaceLivenessAttempt`    | `typeof faceLivenessAttempts.$inferSelect`               |
| `NewFaceLivenessAttempt` | `typeof faceLivenessAttempts.$inferInsert`               |
| `UserFaceProfile`        | `typeof userFaceProfiles.$inferSelect`                   |
| `NewUserFaceProfile`     | `typeof userFaceProfiles.$inferInsert`                   |
| `AuthMethod`             | `(typeof authMethodEnum.enumValues)[number]`             |
| `FaceEnrollmentStatus`   | `(typeof faceEnrollmentStatusEnum.enumValues)[number]`   |
| `LivenessAttemptStatus`  | `(typeof livenessAttemptStatusEnum.enumValues)[number]`  |
| `FaceLivenessIntent`     | `(typeof faceLivenessIntentEnum.enumValues)[number]`     |
| `FaceRecognitionOutcome` | `(typeof faceRecognitionOutcomeEnum.enumValues)[number]` |
| `ShelfWithProducts`      | `Shelf & { products: Product[] }` (`src/types`)          |
| `CartItem`               | client-only line item (`src/types`)                      |

## Seed data (`src/db/seed.ts`)

Idempotent reset, then inserts:

- **Shelves:** `A12` (ชั้นชุดตรวจ ATK), `B03` (ชั้นหน้ากากอนามัย)
- **Products (5):** `ATK-001`, `ATK-005`, `ATK-SAL`, `MASK-KF94`, `MASK-SUR`
- **Placements:** A12 → ATK-001/005/SAL (pos 0–2); B03 → MASK-KF94/SUR (pos 0–1)
