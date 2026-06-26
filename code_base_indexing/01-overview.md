# 01 — Overview

## Project

**ATK Store** is a mobile-first "smart shelf scan-to-shop" starter web app. A customer
scans a QR code on a physical shelf, lands on that shelf's product page, adds items to a
client-side cart, and reviews the cart. Payment and orders are intentionally left as
`TODO` markers for extension.

- **Name / version:** `atk-store` 0.1.0 (private)
- **Primary language:** TypeScript
- **UI language / locale:** Thai (`th`), currency THB (satang minor units)

## Tech stack

| Area       | Choice                                               | Notes                                     |
| ---------- | ---------------------------------------------------- | ----------------------------------------- |
| Framework  | Next.js 16 (App Router)                              | Server Components by default              |
| UI runtime | React 19                                             |                                           |
| Styling    | Tailwind CSS v4 + `tw-animate-css`                   | via `@tailwindcss/postcss`                |
| Components | shadcn/ui (`components.json`) + `@base-ui/react`     | New York / base style                     |
| Icons      | `lucide-react`                                       |                                           |
| State      | Zustand 5 (+ `persist`)                              | client cart → `localStorage` (`atk-cart`) |
| ORM        | Drizzle ORM 0.45 + `drizzle-kit`                     | dialect `postgresql`                      |
| Driver     | `postgres` (postgres-js)                             |                                           |
| Database   | PostgreSQL 16 (Docker, local)                        | `docker-compose.yml`                      |
| Utilities  | `clsx`, `tailwind-merge`, `class-variance-authority` | `cn()` helper                             |

## Architecture

Both Server Components and API routes call the **same service singletons** so business
logic and data access live in exactly one place (`src/services/`). Services and the
Drizzle client are marked `"server-only"` to prevent leaking into client bundles.

```
app/shelf/[id]/page.tsx (Server Component) ─┐
app/api/shelf/[id]/route.ts (Route Handler) ─┴─► shelfService ─► db (Drizzle) ─► Postgres
```

The cart is purely client-side state (Zustand + `persist`); it never touches the server
yet (that's the `TODO(order)` extension point).

## Conventions

- **Path alias:** `@/*` → `src/*` (see `tsconfig.json`).
- **Money:** stored & passed as integer satang (`priceCents`); formatted with `formatPrice`.
- **Server-only modules:** `src/db/index.ts`, `src/services/*` import `"server-only"`.
- **Client modules:** start with `"use client"` (components, cart store, hooks that read DOM).
- **Hydration safety:** `useHydrated()` gates rendering of persisted cart state to avoid
  SSR/client mismatch.
- **Singletons:** `db`, `productService`, `shelfService`, `useCartStore`.

## Tooling / scripts

| Script            | Command                     | Purpose                        |
| ----------------- | --------------------------- | ------------------------------ |
| `dev`             | `next dev`                  | Dev server                     |
| `build` / `start` | `next build` / `next start` | Production build & serve       |
| `lint`            | `eslint`                    | Lint                           |
| `test`            | `vitest run`                | Run focused Node tests         |
| `test:watch`      | `vitest`                    | Watch focused Node tests       |
| `format`          | `prettier --write .`        | Format                         |
| `db:generate`     | `drizzle-kit generate`      | SQL migration from schema      |
| `db:migrate`      | `drizzle-kit migrate`       | Apply migrations               |
| `db:push`         | `drizzle-kit push`          | Push schema directly (dev)     |
| `db:seed`         | `tsx src/db/seed.ts`        | Seed sample shelves & products |
| `db:studio`       | `drizzle-kit studio`        | Drizzle Studio                 |

## Environment

- `DATABASE_URL` — Postgres connection string (`.env`, copied from `.env.example`).
  Local default targets the Docker Compose Postgres (`atk_store`, user/pass `postgres`).
- Face Liveness (server): `AWS_PROFILE` (backend Rekognition Create/Get creds),
  `AWS_LIVENESS_REGION`, `AWS_LIVENESS_OUTPUT_BUCKET`, `AWS_LIVENESS_OUTPUT_PREFIX`,
  `AWS_LIVENESS_SCORE_THRESHOLD`, `AWS_LIVENESS_AUDIT_IMAGES_LIMIT`.
- Face Liveness (browser): `NEXT_PUBLIC_AWS_LIVENESS_REGION`,
  `NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID` (Identity Pool federates Google for
  `StartFaceLivenessSession`-scoped temporary credentials).
- Face Recognition (server): `AWS_FACE_COLLECTION_ID`, `AWS_FACE_MATCH_THRESHOLD`.
  The Rekognition Face Collection stores AWS-managed face features; the app DB
  stores only returned IDs and ownership metadata.
- Face Recognition debug proof: `ENABLE_FACE_RECOGNITION_DEBUG=YES` reveals the
  `/verify-face` CTA only for users with a `user_face_profiles` row.
  `FACE_RECOGNITION_DEBUG_TIMEOUT_MS` defaults to 5000ms.

## Face Liveness + Face Recognition enrollment

- **Goal:** prove a signed-in customer is a real person via Amazon Rekognition
  Face Liveness, then index the accepted reference image into the Rekognition
  Face Collection and mark them `registered`.
- **Minimal calls:** a normal attempt makes exactly 3 Rekognition calls
  (backend `CreateFaceLivenessSession`, browser `StartFaceLivenessSession`,
  backend `GetFaceLivenessSessionResults`). Recognition calls are gated behind
  accepted liveness only: enrollment performs `SearchFacesByImage` to avoid
  duplicates, then `IndexFaces` only when no existing match is found. The app
  never polls; a transient not-ready result allows at most one delayed retry.
  One active attempt per user (partial unique index + idempotent reuse).
- **Credential bridge:** the OAuth callback stashes the verified Google ID token
  in a path-scoped (`/api/face`) httpOnly cookie; `GET /api/face/credentials`
  exchanges it through the Cognito Identity Pool for short-lived, detector-scoped
  credentials. `GET /api/face/auth-status` is a cheap no-AWS preflight that lets
  Home/camera UI detect an expired face token before creating a liveness session.
  The browser never receives an IAM key or the backend AWS profile.
- **UX:** `FaceEnrollmentPrompt` shows a quiet nudge for `not_registered`/`pending`
  users; `/register-face` requires an explicit start and never auto-launches the
  camera or creates an AWS session. `FaceVerificationDebugPrompt` is hidden unless
  explicitly enabled and the signed-in user already has a face profile.
  `FaceAuthStatusNotice` shows a Home-page reauth prompt when the app session is
  still valid but the Google ID token used for the face credential bridge expired.
- **Data:** `users.face_enrollment_status` is the server-authoritative flag the UI
  reads; `face_liveness_attempts` holds per-attempt liveness + recognition
  decisions; `user_face_profiles` maps app users to Rekognition `FaceId`s. The DB
  does not store face vectors.
- **Verification-ready:** `POST /api/face/session` accepts optional
  `{ intent: "verification" }`; `POST /api/face/result` searches the collection
  and returns accepted only when the matched `FaceId` maps back to the signed-in
  user at the configured threshold. `/verify-face` is the debug proof page for
  this path; it shows the current user's avatar/email/name after a verified match.
  The debug timeout is now a slow-scan notice only: the UI does not hard-unmount
  Amplify mid-stream because that can leave camera tracks/ReadableStreams in a
  bad cleanup race. Real mismatch/detector/result failures still fail closed to
  an admin-contact state.

## Authentication

- **Provider:** Google OAuth 2.0 (manual flow, no auth library).
- **Flow:** `/signin` → `/api/auth/signin/google` creates short-lived `state`, PKCE
  verifier and nonce cookies → Google consent → `/api/auth/callback/google` validates
  those cookies, validates the Google ID token signature and claims, upserts the verified
  provider identity, opens a DB session, and sets `atk_session` → `/`.
- **Session security:** the browser receives a random opaque token in an httpOnly cookie;
  the database stores only its SHA-256 hash. `getCurrentUser()` resolves it from DB and
  `requireCurrentUser()` is the mandatory guard for private Route Handlers/Actions.
- **Guarding:** `src/proxy.ts` only performs optimistic page redirect. It does not replace
  route-level authentication or resource-ownership authorization.
- **Identity mapping:** `users.auth_method` plus immutable provider account ID (Google OIDC
  `sub`) is unique. An existing email with another provider identity is rejected instead
  of being linked silently.
- **Env keys:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_URL`, `AUTH_SECRET`.

## Extension points (`TODO`)

- `TODO(payment)` — real checkout / payment (PromptPay, card) — `src/app/cart/page.tsx`
- `TODO(order)` — persist client cart → order table — `src/app/cart/page.tsx`
- Also unimplemented: per-shelf QR generation, admin panel, deploy/CI.
