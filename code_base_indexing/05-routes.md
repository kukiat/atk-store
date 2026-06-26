# 05 — Routes & Request Flow

App Router routes under `src/app`.

## Pages

| Route            | File                             | Rendering      | Description                                                                            |
| ---------------- | -------------------------------- | -------------- | -------------------------------------------------------------------------------------- |
| `/`              | `src/app/page.tsx`               | Server (async) | Landing; greets signed-in user + sign-out; links to demo shelves                       |
| `/shelf/[id]`    | `src/app/shelf/[id]/page.tsx`    | Server (async) | Products on a shelf; `notFound()` if shelf missing                                     |
| `/cart`          | `src/app/cart/page.tsx`          | Client         | Cart review; qty edit, total, disabled checkout                                        |
| `/signin`        | `src/app/signin/page.tsx`        | Server (async) | Google sign-in page; shows `?error=` messages                                          |
| `/register-face` | `src/app/register-face/page.tsx` | Server (async) | Gated face-enrollment page; shows already-registered state or the client liveness flow |

## API

| Method & Route                  | File                                        | Returns                                                                                                                                                                                                          |
| ------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/shelf/[id]`           | `src/app/api/shelf/[id]/route.ts`           | `200` shelf+products JSON, or `404 { error }`                                                                                                                                                                    |
| `GET /api/auth/signin/google`   | `src/app/api/auth/signin/google/route.ts`   | Creates state/PKCE/nonce cookies then `302` redirects to Google OAuth                                                                                                                                            |
| `GET /api/auth/callback/google` | `src/app/api/auth/callback/google/route.ts` | Validates state/PKCE/nonce and Google ID token → upserts verified provider identity, sets session cookie, `302` to `/` (or `/signin?error=`)                                                                     |
| `POST /api/auth/signout`        | `src/app/api/auth/signout/route.ts`         | Same-origin only; deletes session, clears cookie, `302` to `/signin`                                                                                                                                             |
| `GET /api/face/credentials`     | `src/app/api/face/credentials/route.ts`     | Auth only; exchanges the path-scoped Google ID token cookie for short-lived `StartFaceLivenessSession`-scoped creds. `401`/`409` (reauth)/`500`                                                                  |
| `POST /api/face/session`        | `src/app/api/face/session/route.ts`         | Auth + same-origin; creates/reuses one liveness session for optional `{ intent: "enrollment" \| "verification" }` → `{ sessionId, intent }`. `409` already registered / not registered / another attempt pending |
| `POST /api/face/result`         | `src/app/api/face/result/route.ts`          | Auth + same-origin; reads one owned result (Rekognition `Get` at most once, never polls), then registers/verifies in Face Collection → `{ outcome, confidence?, reason?, recognition? }`. `404` wrong owner      |

## Route protection (`src/proxy.ts`)

Next.js 16 renamed `middleware` → **proxy**. The `proxy.ts` runs an optimistic
cookie-presence check on every matched route:

- no `atk_session` cookie + protected route → redirect to `/signin`
- has cookie + `/signin` → redirect to `/`

Matcher excludes `api`, `_next/static`, `_next/image`, `favicon.ico`, and `*.svg`.
The real database-backed check is `getCurrentUser()` (`src/lib/auth.ts`). Private
Route Handlers and Server Actions must use `requireCurrentUser()` themselves;
the proxy does not protect API routes.

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

## Face Liveness enrollment flow

```
/register-face (Server, gated)
   └─ FaceLivenessRegistration (Client)
        │ press "เริ่มลงทะเบียนใบหน้า"
        ▼
   POST /api/face/session ──► faceEnrollmentService.createOrReuseAttempt
        │   (Rekognition CreateFaceLivenessSession ×1, user → pending)
        ▼ sessionId
   <FaceLivenessDetectorCore> ── config.credentialProvider
        │   GET /api/face/credentials ──► Cognito GetId + GetCredentialsForIdentity
        │   (Google ID token cookie → temp StartFaceLivenessSession creds)
        │   detector runs StartFaceLivenessSession ×1 in the browser
        ▼ onAnalysisComplete
   POST /api/face/result ──► faceEnrollmentService.getAttemptResult
        (Rekognition GetFaceLivenessSessionResults ×1, never polls;
         accepted ≥ threshold → SearchFacesByImage duplicate check
         → IndexFaces → user_face_profiles + user registered)
```

Normal attempt = 3 Rekognition calls (Create + Start + Get). A transient
not-ready result permits at most one delayed retry (4 calls); the app never
polls. Recognition calls happen only after accepted liveness: enrollment uses
`SearchFacesByImage` to avoid duplicate collection entries, then `IndexFaces`
only if no existing match is found. One active attempt per user is enforced by
a partial unique index plus idempotent reuse in the service.

## Face Recognition verification flow

The same session/result endpoints are verification-ready:

```
POST /api/face/session { intent: "verification" }
   └─ requires current user already has `faceEnrollmentStatus = registered`
      → create/reuse liveness attempt with intent `verification`

FaceLivenessDetectorCore runs as usual

POST /api/face/result { sessionId }
   └─ liveness accepted
      → SearchFacesByImage against AWS_FACE_COLLECTION_ID
      → map returned FaceId through user_face_profiles
      → accepted only when matched userId === current userId
         and similarity ≥ AWS_FACE_MATCH_THRESHOLD
```

## Notes / gaps

- Read API for shelves is `GET`-only; the first write/mutation endpoints are the
  face routes above (all `requireCurrentUser()`-gated; mutations also same-origin).
- Checkout button is disabled — `TODO(payment)` & `TODO(order)` in `cart/page.tsx`.
- Google OAuth and the application session are implemented; future API write routes must use `requireCurrentUser()` before acting on user data.
