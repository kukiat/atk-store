# 03 — Symbol Index

Flat lookup of exported symbols → location & signature. Grouped by kind.

## Components (React)

| Symbol                                                                 | File                                  | Props / notes                           |
| ---------------------------------------------------------------------- | ------------------------------------- | --------------------------------------- |
| `RootLayout` (default)                                                 | `src/app/layout.tsx`                  | `{ children }` — root HTML/body shell   |
| `HomePage` (default)                                                   | `src/app/page.tsx`                    | Landing page                            |
| `ShelfPage` (default, async)                                           | `src/app/shelf/[id]/page.tsx`         | `{ params: Promise<{ id }> }`           |
| `CartPage` (default)                                                   | `src/app/cart/page.tsx`               | Client cart UI                          |
| `SignInPage` (default, async)                                          | `src/app/signin/page.tsx`             | `{ searchParams: Promise<{ error? }> }` |
| `CartBar`                                                              | `src/components/cart-bar.tsx`         | No props; reads cart store              |
| `ProductCard`                                                          | `src/components/product-card.tsx`     | `{ product: Product }`                  |
| `QuantityStepper`                                                      | `src/components/quantity-stepper.tsx` | `{ value, onChange, min? }`             |
| `Badge`, `badgeVariants`                                               | `src/components/ui/badge.tsx`         | shadcn                                  |
| `Button`, `buttonVariants`                                             | `src/components/ui/button.tsx`        | shadcn (`render` slot)                  |
| `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter` (+more) | `src/components/ui/card.tsx`          | shadcn                                  |
| `Separator`                                                            | `src/components/ui/separator.tsx`     | shadcn                                  |
| `Sheet`, `SheetContent`, `SheetTrigger` (+more)                        | `src/components/ui/sheet.tsx`         | shadcn                                  |

## Route handlers

| Symbol | File                                        | Signature                                                                                              |
| ------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `GET`  | `src/app/api/shelf/[id]/route.ts`           | `(request, { params: Promise<{ id }> }) → NextResponse`                                                |
| `GET`  | `src/app/api/auth/signin/google/route.ts`   | `() → OAuth redirect with state/PKCE/nonce cookies`                                                    |
| `GET`  | `src/app/api/auth/callback/google/route.ts` | `(request) → validate correlation + Google ID token, upsert user, set hashed session cookie, redirect` |
| `POST` | `src/app/api/auth/signout/route.ts`         | `(same-origin request) → delete session, clear cookie, redirect`                                       |

## Proxy (Next.js 16 route guard)

| Symbol   | File           | Signature                                                           |
| -------- | -------------- | ------------------------------------------------------------------- |
| `proxy`  | `src/proxy.ts` | `(request: NextRequest) → NextResponse` — optimistic auth redirects |
| `config` | `src/proxy.ts` | `{ matcher }` — excludes api/\_next/static/assets                   |

## Services (server-only singletons)

| Symbol                       | File                              | Methods                                                                                                                                                               |
| ---------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shelfService`               | `src/services/shelf.service.ts`   | `getShelfWithProducts(shelfId: string): Promise<ShelfWithProducts \| null>`                                                                                           |
| `productService`             | `src/services/product.service.ts` | `getProductById(id: number): Promise<Product \| null>`, `isInStock(product): boolean`                                                                                 |
| `userService`                | `src/services/user.service.ts`    | `upsertOAuthUser(input): Promise<User>`, `createSession(userId): Promise<{token, expiresAt}>`, `getUserBySession(token): Promise<User\|null>`, `deleteSession(token)` |
| `OAuthIdentityConflictError` | `src/services/user.service.ts`    | Refuses silent email-to-different-provider-sub account linking                                                                                                        |

## Auth / DAL

| Symbol                                                                        | File                                | Signature                                                                             |
| ----------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------- |
| `getCurrentUser`                                                              | `src/lib/auth.ts`                   | `(): Promise<User \| null>` — React-cached, DB-backed                                 |
| `requireCurrentUser`                                                          | `src/lib/auth.ts`                   | `(): Promise<User>` — throws when a private Route Handler/Action has no valid session |
| `hasSameOrigin`                                                               | `src/lib/auth.ts`                   | `(request) => boolean` — POST mutation origin guard                                   |
| `createOpaqueToken`, `hashSessionToken`, `tokensMatch`, `createPkceChallenge` | `src/lib/auth-tokens.ts`            | OAuth/session security primitives                                                     |
| `verifyGoogleIdToken`                                                         | `src/lib/google-id-token.ts`        | `(idToken, nonce) => verified Google identity`                                        |
| `getGoogleIdentityFromClaims`                                                 | `src/lib/google-id-token-claims.ts` | Pure identity-claim validation                                                        |
| `SESSION_COOKIE`                                                              | `src/lib/auth-shared.ts`            | `"atk_session"`                                                                       |
| `SIGN_IN_PATH`                                                                | `src/lib/auth-shared.ts`            | `"/signin"`                                                                           |
| `PUBLIC_PATHS`                                                                | `src/lib/auth-shared.ts`            | `string[]` — routes reachable without a session                                       |
| `sessionCookieOptions`                                                        | `src/lib/auth-shared.ts`            | `(expiresAt: Date) → cookie options`                                                  |

## State store (Zustand)

| Symbol             | File                | Signature                                                                                |
| ------------------ | ------------------- | ---------------------------------------------------------------------------------------- |
| `useCartStore`     | `src/store/cart.ts` | store: `items`, `addItem(product, qty?)`, `removeItem(id)`, `setQty(id, qty)`, `clear()` |
| `selectTotalCount` | `src/store/cart.ts` | `(state) => number` — total units                                                        |
| `selectTotalCents` | `src/store/cart.ts` | `(state) => number` — total satang                                                       |

## Database

| Symbol                                                                                                   | File               | Kind                         |
| -------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------- |
| `db`                                                                                                     | `src/db/index.ts`  | Drizzle client (server-only) |
| `shelves`                                                                                                | `src/db/schema.ts` | pgTable                      |
| `products`                                                                                               | `src/db/schema.ts` | pgTable                      |
| `shelfProducts`                                                                                          | `src/db/schema.ts` | pgTable (join)               |
| `users`                                                                                                  | `src/db/schema.ts` | pgTable                      |
| `sessions`                                                                                               | `src/db/schema.ts` | pgTable                      |
| `authMethodEnum`                                                                                         | `src/db/schema.ts` | pgEnum (`auth_method`)       |
| `shelvesRelations`, `productsRelations`, `shelfProductsRelations`, `usersRelations`, `sessionsRelations` | `src/db/schema.ts` | Drizzle relations            |

## Hooks & utilities

| Symbol        | File                      | Signature                              |
| ------------- | ------------------------- | -------------------------------------- |
| `useHydrated` | `src/lib/use-hydrated.ts` | `(): boolean`                          |
| `formatPrice` | `src/lib/format.ts`       | `(cents: number): string` → `"฿35.00"` |
| `cn`          | `src/lib/utils.ts`        | `(...inputs: ClassValue[]): string`    |

## Types

| Symbol              | File                                         | Definition                                                 |
| ------------------- | -------------------------------------------- | ---------------------------------------------------------- |
| `Shelf`             | `src/db/schema.ts` (re-exported `src/types`) | `typeof shelves.$inferSelect`                              |
| `Product`           | `src/db/schema.ts` (re-exported `src/types`) | `typeof products.$inferSelect`                             |
| `ShelfProduct`      | `src/db/schema.ts`                           | `typeof shelfProducts.$inferSelect`                        |
| `User`              | `src/db/schema.ts`                           | `typeof users.$inferSelect`                                |
| `NewUser`           | `src/db/schema.ts`                           | `typeof users.$inferInsert`                                |
| `Session`           | `src/db/schema.ts`                           | `typeof sessions.$inferSelect`                             |
| `AuthMethod`        | `src/db/schema.ts`                           | `(typeof authMethodEnum.enumValues)[number]`               |
| `ShelfWithProducts` | `src/types/index.ts`                         | `Shelf & { products: Product[] }`                          |
| `CartItem`          | `src/types/index.ts`                         | `{ productId, sku, name, priceCents, imageUrl, quantity }` |
