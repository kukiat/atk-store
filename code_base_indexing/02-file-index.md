# 02 — File Index

Per-file purpose, key exports, and dependencies. Paths are relative to repo root.
`SO` = `"server-only"`, `UC` = `"use client"`.

## `src/app` — App Router (pages, layout, API)

| File                                        | Kind        | Purpose                                                                                                                                          | Key exports                                  |
| ------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| `src/app/layout.tsx`                        | Server      | Root layout; Noto Sans Thai font, `<html lang="th">`, metadata & viewport                                                                        | `default RootLayout`, `metadata`, `viewport` |
| `src/app/page.tsx`                          | Server      | Landing page; intro + buttons to demo shelves A12 / B03                                                                                          | `default HomePage`                           |
| `src/app/shelf/[id]/page.tsx`               | Server      | Shelf page; loads shelf+products via `shelfService`, renders `ProductCard` grid + `CartBar`; `notFound()` if missing                             | `default ShelfPage` (async)                  |
| `src/app/cart/page.tsx`                     | Client `UC` | Cart page; lists items, qty stepper, total, disabled checkout (`TODO payment/order`)                                                             | `default CartPage`                           |
| `src/app/signin/page.tsx`                   | Server      | Google sign-in page; theme card + Google button; renders `?error=` messages                                                                      | `default SignInPage` (async)                 |
| `src/app/api/shelf/[id]/route.ts`           | Route       | `GET /api/shelf/:id` → shelf JSON via `shelfService`; 404 if missing                                                                             | `GET`                                        |
| `src/app/api/auth/signin/google/route.ts`   | Route       | Builds Google OAuth URL with state, PKCE challenge and nonce; stores short-lived httpOnly correlation cookies                                    | `GET`                                        |
| `src/app/api/auth/callback/google/route.ts` | Route       | Validates callback correlation cookies, exchanges code, verifies Google ID token, upserts verified provider identity, opens hashed local session | `GET`                                        |
| `src/app/api/auth/signout/route.ts`         | Route       | Same-origin POST only; deletes hashed session + clears cookie → `/signin`                                                                        | `POST`                                       |
| `src/app/globals.css`                       | CSS         | Tailwind v4 + theme tokens / base styles                                                                                                         | —                                            |
| `src/app/favicon.ico`                       | Asset       | Favicon                                                                                                                                          | —                                            |

## `src/components` — UI components

| File                                  | Kind        | Purpose                                                                                            | Key exports                                                       |
| ------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `src/components/cart-bar.tsx`         | Client `UC` | Floating bottom bar showing cart count+total, links to `/cart`; hidden until hydrated / when empty | `CartBar`                                                         |
| `src/components/product-card.tsx`     | Client `UC` | Product card; price, stock badge, "add to cart" with transient "added" state                       | `ProductCard`                                                     |
| `src/components/quantity-stepper.tsx` | Client `UC` | +/- stepper with `min` clamp                                                                       | `QuantityStepper`                                                 |
| `src/components/ui/badge.tsx`         | Client/UI   | shadcn Badge (CVA variants)                                                                        | `Badge`, `badgeVariants`                                          |
| `src/components/ui/button.tsx`        | Client/UI   | shadcn Button (CVA variants, `render` slot)                                                        | `Button`, `buttonVariants`                                        |
| `src/components/ui/card.tsx`          | UI          | shadcn Card primitives                                                                             | `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter`, … |
| `src/components/ui/separator.tsx`     | UI          | shadcn Separator                                                                                   | `Separator`                                                       |
| `src/components/ui/sheet.tsx`         | UI          | shadcn Sheet (dialog/drawer)                                                                       | `Sheet`, `SheetContent`, `SheetTrigger`, …                        |

## `src/db` — Database (Drizzle)

| File               | Kind   | Purpose                                                                                                               | Key exports                                                                                                                                                                 |
| ------------------ | ------ | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/db/schema.ts` | Schema | Tables `shelves`, `products`, `shelf_products`, `users`, `sessions` + `auth_method` enum + relations + inferred types | `shelves`, `products`, `shelfProducts`, `users`, `sessions`, `authMethodEnum`, `*Relations`, types `Shelf`/`Product`/`ShelfProduct`/`User`/`NewUser`/`Session`/`AuthMethod` |
| `src/db/index.ts`  | `SO`   | Drizzle client; reads `DATABASE_URL`, reuses client across hot-reloads                                                | `db`                                                                                                                                                                        |
| `src/db/seed.ts`   | Script | Standalone seed (own pg client); 2 shelves, 5 products, placements; idempotent reset                                  | `main()` (run via `tsx`)                                                                                                                                                    |

## `src/services` — Business logic + data access (server-only)

| File                              | Kind | Purpose                                                                                                 | Key exports                                                           |
| --------------------------------- | ---- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/services/shelf.service.ts`   | `SO` | `ShelfService.getShelfWithProducts(id)` — normalizes id, joins products by position                     | `shelfService` singleton                                              |
| `src/services/product.service.ts` | `SO` | `ProductService.getProductById(id)`, `isInStock(product)`                                               | `productService` singleton                                            |
| `src/services/user.service.ts`    | `SO` | Provider-sub-based user upsert, hashed session create/lookup/delete, rejects ambiguous identity linking | `userService` singleton, `OAuthIdentityConflictError`, type `Session` |

## `src/store` — Client state

| File                | Kind        | Purpose                                                                             | Key exports                                            |
| ------------------- | ----------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `src/store/cart.ts` | Client `UC` | Zustand cart store with `persist` (`atk-cart`); add/remove/setQty/clear + selectors | `useCartStore`, `selectTotalCount`, `selectTotalCents` |

## `src/lib` — Utilities

| File                                | Kind        | Purpose                                                                                  | Key exports                                                                                     |
| ----------------------------------- | ----------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/lib/format.ts`                 | Util        | Format satang → THB currency string                                                      | `formatPrice`                                                                                   |
| `src/lib/use-hydrated.ts`           | Client `UC` | `useSyncExternalStore` hook: false during SSR/first render, then true                    | `useHydrated`                                                                                   |
| `src/lib/utils.ts`                  | Util        | `cn()` class merge (clsx + tailwind-merge)                                               | `cn`                                                                                            |
| `src/lib/auth.ts`                   | `SO`        | Secure DAL: `getCurrentUser()`, `requireCurrentUser()`, same-origin helper               | `getCurrentUser`, `requireCurrentUser`, `hasSameOrigin`, `AuthenticationRequiredError`          |
| `src/lib/auth-shared.ts`            | Shared      | Edge-safe session/OAuth cookie names and secure cookie options                           | `SESSION_COOKIE`, OAuth cookie constants, `SIGN_IN_PATH`, `PUBLIC_PATHS`, cookie-option helpers |
| `src/lib/auth-tokens.ts`            | Server util | Opaque token generation, SHA-256 session hashing, timing-safe comparison, PKCE challenge | `createOpaqueToken`, `hashSessionToken`, `tokensMatch`, `createPkceChallenge`                   |
| `src/lib/google-id-token.ts`        | `SO`        | Google JWKS signature/claim verification                                                 | `verifyGoogleIdToken`, re-exported identity types/errors                                        |
| `src/lib/google-id-token-claims.ts` | Util        | Pure Google identity-claim validation for tests                                          | `getGoogleIdentityFromClaims`, `GoogleIdTokenValidationError`, `GoogleIdentity`                 |

## `src/types`

| File                 | Purpose                                                                             | Key exports                                         |
| -------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------- |
| `src/types/index.ts` | Shared types; re-exports `Product`/`Shelf`, defines `ShelfWithProducts`, `CartItem` | `Product`, `Shelf`, `ShelfWithProducts`, `CartItem` |

## `src/proxy.ts` — Route guard

| File           | Kind            | Purpose                                                                                                             | Key exports       |
| -------------- | --------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `src/proxy.ts` | Proxy (Next 16) | Optimistic auth gate: redirect unauthenticated → `/signin`, authenticated away from `/signin`. Cookie-presence only | `proxy`, `config` |

## Root config & meta

| File                              | Purpose                                                     |
| --------------------------------- | ----------------------------------------------------------- |
| `package.json`                    | Deps & npm scripts (`test`, `test:watch` via Vitest)        |
| `vitest.config.ts`                | Test config; Node environment + `@/*` alias                 |
| `tsconfig.json`                   | TS config; `@/*` → `./src/*`, strict, bundler resolution    |
| `next.config.ts`                  | Next.js config (currently empty)                            |
| `drizzle.config.ts`               | drizzle-kit config; schema path, `postgresql`, loads `.env` |
| `docker-compose.yml`              | Local Postgres 16 (`atk_store`, port 5432)                  |
| `components.json`                 | shadcn/ui config                                            |
| `eslint.config.mjs`               | ESLint flat config (next)                                   |
| `postcss.config.mjs`              | PostCSS (Tailwind v4)                                       |
| `.prettierrc` / `.prettierignore` | Prettier config                                             |
| `.env.example`                    | `DATABASE_URL` template                                     |
| `README.md`                       | Project readme (Thai)                                       |
| `documents/hardware.md`           | Hardware notes                                              |
| `public/*.svg`                    | Static assets (next, vercel, file, globe, window)           |
