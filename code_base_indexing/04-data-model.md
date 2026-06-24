# 04 — Data Model

Source: `src/db/schema.ts`. Dialect: PostgreSQL (Drizzle ORM).

## Tables

### `shelves`
A physical smart shelf. `id` is the human-readable code encoded in the shelf QR (e.g. `"A12"`).

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `text` | **PK** (QR code, e.g. `A12`) |
| `name` | `text` | not null |
| `location` | `text` | nullable |
| `created_at` | `timestamptz` | not null, default `now()` |

### `products`
Catalog product. Prices are stored as **integer satang** (`price_cents`) to avoid float money bugs.

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `serial` | **PK** |
| `sku` | `text` | not null, **unique** |
| `name` | `text` | not null |
| `description` | `text` | nullable |
| `price_cents` | `integer` | not null (satang) |
| `image_url` | `text` | nullable |
| `stock` | `integer` | not null, default `0` |
| `created_at` | `timestamptz` | not null, default `now()` |

### `shelf_products` (join)
Many-to-many: a product can live on several shelves; `position` orders it on a shelf.

| Column | Type | Constraints |
| --- | --- | --- |
| `shelf_id` | `text` | not null, FK → `shelves.id` (on delete cascade) |
| `product_id` | `integer` | not null, FK → `products.id` (on delete cascade) |
| `position` | `integer` | not null, default `0` |
| — | — | **PK** = (`shelf_id`, `product_id`) |

### `users`
An enrolled customer, one row per person keyed by email. `auth_method` records the
sign-in channel so multiple providers can be supported over time.

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `serial` | **PK** |
| `email` | `text` | not null, **unique** (normalized lowercase) |
| `name` | `text` | nullable |
| `avatar_url` | `text` | nullable |
| `auth_method` | `auth_method` (enum) | not null, default `google` |
| `provider_account_id` | `text` | nullable (e.g. Google `sub`/`id`) |
| `created_at` | `timestamptz` | not null, default `now()` |
| `updated_at` | `timestamptz` | not null, default `now()` |
| `last_login_at` | `timestamptz` | nullable |

### `sessions`
A server-side login session. The opaque `id` is the random token stored in the
user's httpOnly cookie (`atk_session`).

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `text` | **PK** (random 256-bit token) |
| `user_id` | `integer` | not null, FK → `users.id` (on delete cascade) |
| `expires_at` | `timestamptz` | not null |
| `created_at` | `timestamptz` | not null, default `now()` |

## Enums

### `auth_method`
Supported sign-in channels. `google` is live; the rest are pre-declared so adding a
channel needs no schema change: `google`, `facebook`, `line`, `apple`, `credentials`.

## Relations

- `shelves` 1—* `shelf_products`
- `products` 1—* `shelf_products`
- `shelf_products` *—1 `shelves`, *—1 `products`
- `users` 1—* `sessions`
- `sessions` *—1 `users`

```
shelves ──< shelf_products >── products
              (position)

users ──< sessions
```

## Inferred TypeScript types

| Type | Source |
| --- | --- |
| `Shelf` | `typeof shelves.$inferSelect` |
| `Product` | `typeof products.$inferSelect` |
| `ShelfProduct` | `typeof shelfProducts.$inferSelect` |
| `User` | `typeof users.$inferSelect` |
| `NewUser` | `typeof users.$inferInsert` |
| `Session` | `typeof sessions.$inferSelect` |
| `AuthMethod` | `(typeof authMethodEnum.enumValues)[number]` |
| `ShelfWithProducts` | `Shelf & { products: Product[] }` (`src/types`) |
| `CartItem` | client-only line item (`src/types`) |

## Seed data (`src/db/seed.ts`)

Idempotent reset, then inserts:

- **Shelves:** `A12` (ชั้นชุดตรวจ ATK), `B03` (ชั้นหน้ากากอนามัย)
- **Products (5):** `ATK-001`, `ATK-005`, `ATK-SAL`, `MASK-KF94`, `MASK-SUR`
- **Placements:** A12 → ATK-001/005/SAL (pos 0–2); B03 → MASK-KF94/SUR (pos 0–1)
