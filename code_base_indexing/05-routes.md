# 05 — Routes & Request Flow

App Router routes under `src/app`.

## Pages

| Route | File | Rendering | Description |
| --- | --- | --- | --- |
| `/` | `src/app/page.tsx` | Server (async) | Landing; greets signed-in user + sign-out; links to demo shelves |
| `/shelf/[id]` | `src/app/shelf/[id]/page.tsx` | Server (async) | Products on a shelf; `notFound()` if shelf missing |
| `/cart` | `src/app/cart/page.tsx` | Client | Cart review; qty edit, total, disabled checkout |
| `/signin` | `src/app/signin/page.tsx` | Server (async) | Google sign-in page; shows `?error=` messages |

## API

| Method & Route | File | Returns |
| --- | --- | --- |
| `GET /api/shelf/[id]` | `src/app/api/shelf/[id]/route.ts` | `200` shelf+products JSON, or `404 { error }` |
| `GET /api/auth/signin/google` | `src/app/api/auth/signin/google/route.ts` | `302` redirect to Google OAuth consent |
| `GET /api/auth/callback/google` | `src/app/api/auth/callback/google/route.ts` | Exchanges code → upserts user, sets session cookie, `302` to `/` (or `/signin?error=`) |
| `GET\|POST /api/auth/signout` | `src/app/api/auth/signout/route.ts` | Deletes session, clears cookie, `302` to `/signin` |

## Route protection (`src/proxy.ts`)

Next.js 16 renamed `middleware` → **proxy**. The `proxy.ts` runs an optimistic
cookie-presence check on every matched route:

- no `atk_session` cookie + protected route → redirect to `/signin`
- has cookie + `/signin` → redirect to `/`

Matcher excludes `api`, `_next/static`, `_next/image`, `favicon.ico`, and `*.svg`.
The real database-backed check is `getCurrentUser()` (`src/lib/auth.ts`).

## Dynamic segments

- `[id]` in `/shelf/[id]` and `/api/shelf/[id]` → shelf code (normalized: trimmed + uppercased in `shelfService`).
- `params` is a `Promise` (Next.js 16) — `await params` before use.

## Primary user flow

```
QR on shelf  →  /shelf/A12 (Server Component)
                   │  shelfService.getShelfWithProducts("A12")
                   │     → db (Drizzle join shelf_products → products, order by position)
                   ▼
              ProductCard list  →  "ใส่ตะกร้า" → useCartStore.addItem()
                   │                                  (persist → localStorage "atk-cart")
                   ▼
              CartBar (count/total, hydration-gated)  →  /cart
                   ▼
              CartPage: edit qty / remove / total  →  checkout (disabled, TODO)
```

## Data-access layering

```
Server Component  ┐
                  ├─►  shelfService / productService  ─►  db (Drizzle)  ─►  Postgres
API Route Handler ┘            (server-only)
```

Both entry points share the same service singletons, so query + validation logic is not duplicated.

## Notes / gaps

- No POST/PUT/DELETE endpoints yet (read-only API).
- Checkout button is disabled — `TODO(payment)` & `TODO(order)` in `cart/page.tsx`.
- No auth/session — `TODO(auth)`.
