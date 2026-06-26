# 03 — Symbol Index

Flat lookup of exported symbols → location & signature. Grouped by kind.

## Components (React)

| Symbol                                                                 | File                                                | Props / notes                           |
| ---------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------- |
| `RootLayout` (default)                                                 | `src/app/layout.tsx`                                | `{ children }` — root HTML/body shell   |
| `HomePage` (default)                                                   | `src/app/page.tsx`                                  | Landing page                            |
| `ShelfPage` (default, async)                                           | `src/app/shelf/[id]/page.tsx`                       | `{ params: Promise<{ id }> }`           |
| `CartPage` (default)                                                   | `src/app/cart/page.tsx`                             | Client cart UI                          |
| `SignInPage` (default, async)                                          | `src/app/signin/page.tsx`                           | `{ searchParams: Promise<{ error? }> }` |
| `RegisterFacePage` (default, async)                                    | `src/app/register-face/page.tsx`                    | Gated face-enrollment page              |
| `VerifyFacePage` (default, async)                                      | `src/app/verify-face/page.tsx`                      | Debug face verification page            |
| `FaceAuthStatusNotice`                                                 | `src/components/face-auth-status-notice.tsx`        | Client face token preflight notice      |
| `FaceEnrollmentPrompt` (async)                                         | `src/components/face-enrollment-prompt.tsx`         | Quiet face-registration CTA             |
| `FaceLivenessRegistration`                                             | `src/components/face-liveness-registration.tsx`     | Client liveness + recognition UI        |
| `FaceVerificationDebugPrompt` (async)                                  | `src/components/face-verification-debug-prompt.tsx` | Debug verify CTA; env + profile gated   |
| `FaceVerificationDebug`                                                | `src/components/face-verification-debug.tsx`        | Client verification proof UI            |
| `CartBar`                                                              | `src/components/cart-bar.tsx`                       | No props; reads cart store              |
| `ProductCard`                                                          | `src/components/product-card.tsx`                   | `{ product: Product }`                  |
| `QuantityStepper`                                                      | `src/components/quantity-stepper.tsx`               | `{ value, onChange, min? }`             |
| `Badge`, `badgeVariants`                                               | `src/components/ui/badge.tsx`                       | shadcn                                  |
| `Button`, `buttonVariants`                                             | `src/components/ui/button.tsx`                      | shadcn (`render` slot)                  |
| `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter` (+more) | `src/components/ui/card.tsx`                        | shadcn                                  |
| `Separator`                                                            | `src/components/ui/separator.tsx`                   | shadcn                                  |
| `Sheet`, `SheetContent`, `SheetTrigger` (+more)                        | `src/components/ui/sheet.tsx`                       | shadcn                                  |

## Route handlers

| Symbol | File                                        | Signature                                                                                              |
| ------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `GET`  | `src/app/api/shelf/[id]/route.ts`           | `(request, { params: Promise<{ id }> }) → NextResponse`                                                |
| `GET`  | `src/app/api/auth/signin/google/route.ts`   | `() → OAuth redirect with state/PKCE/nonce cookies`                                                    |
| `GET`  | `src/app/api/auth/callback/google/route.ts` | `(request) → validate correlation + Google ID token, upsert user, set hashed session cookie, redirect` |
| `POST` | `src/app/api/auth/signout/route.ts`         | `(same-origin request) → delete session, clear cookie, redirect`                                       |
| `GET`  | `src/app/api/face/auth-status/route.ts`     | `(auth request) → cheap Google ID token freshness status; no AWS calls`                                |
| `GET`  | `src/app/api/face/credentials/route.ts`     | `(auth request) → Google ID token cookie → Cognito Identity Pool → detector-scoped temp creds`         |
| `POST` | `src/app/api/face/session/route.ts`         | `(same-origin auth request, optional intent) → create/reuse liveness session`                          |
| `POST` | `src/app/api/face/result/route.ts`          | `(same-origin auth request, sessionId) → liveness result + Face Collection register/verify decision`   |

## Proxy (Next.js 16 route guard)

| Symbol   | File           | Signature                                                           |
| -------- | -------------- | ------------------------------------------------------------------- |
| `proxy`  | `src/proxy.ts` | `(request: NextRequest) → NextResponse` — optimistic auth redirects |
| `config` | `src/proxy.ts` | `{ matcher }` — excludes api/\_next/static/assets                   |

## Services (server-only singletons)

| Symbol                       | File                                                                                  | Methods                                                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shelfService`               | `src/services/shelf.service.ts`                                                       | `getShelfWithProducts(shelfId: string): Promise<ShelfWithProducts \| null>`                                                                                           |
| `productService`             | `src/services/product.service.ts`                                                     | `getProductById(id: number): Promise<Product \| null>`, `isInStock(product): boolean`                                                                                 |
| `userService`                | `src/services/user.service.ts`                                                        | `upsertOAuthUser(input): Promise<User>`, `createSession(userId): Promise<{token, expiresAt}>`, `getUserBySession(token): Promise<User\|null>`, `deleteSession(token)` |
| `OAuthIdentityConflictError` | `src/services/user.service.ts`                                                        | Refuses silent email-to-different-provider-sub account linking                                                                                                        |
| `faceEnrollmentService`      | `src/services/face-enrollment.service.ts`                                             | `getDetectorCredentials(googleIdToken)`, `createOrReuseAttempt(userId, intent?)`, `getAttemptResult(userId, sessionId)`                                               |
| `faceRecognitionService`     | `src/services/face-recognition.service.ts`                                            | `registerFaceFromAttempt(attempt)`, `verifyFaceFromAttempt(expectedUserId, attempt)`, `getProfileByUserId(userId)`                                                    |
| face domain errors           | `src/services/face-enrollment.service.ts`, `src/services/face-recognition.service.ts` | route-safe errors for already registered, not registered, duplicate face, missing reference, not indexed                                                              |

## Auth / DAL

| Symbol                                                                        | File                                                   | Signature                                                                             |
| ----------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `getCurrentUser`                                                              | `src/lib/auth.ts`                                      | `(): Promise<User \| null>` — React-cached, DB-backed                                 |
| `requireCurrentUser`                                                          | `src/lib/auth.ts`                                      | `(): Promise<User>` — throws when a private Route Handler/Action has no valid session |
| `hasSameOrigin`                                                               | `src/lib/auth.ts`                                      | `(request) => boolean` — POST mutation origin guard                                   |
| `createOpaqueToken`, `hashSessionToken`, `tokensMatch`, `createPkceChallenge` | `src/lib/auth-tokens.ts`                               | OAuth/session security primitives                                                     |
| `verifyGoogleIdToken`                                                         | `src/lib/google-id-token.ts`                           | `(idToken, nonce) => verified Google identity`                                        |
| `getGoogleIdentityFromClaims`                                                 | `src/lib/google-id-token-claims.ts`                    | Pure identity-claim validation                                                        |
| `getLivenessConfig`, `getRekognitionClient`, `getCognitoIdentityClient`       | `src/lib/aws-liveness.ts`                              | Lazy-validated liveness/Cognito config and AWS clients                                |
| `getFaceRecognitionConfig`                                                    | `src/lib/aws-face-recognition.ts`                      | Lazy-validated Face Collection config (`AWS_FACE_COLLECTION_ID`, threshold)           |
| `getFaceTokenStatus`                                                          | `src/lib/face-token.ts`                                | `(token?) → ready/reauth freshness result for face credential bridge UX`              |
| `createExternalImageId`, `decideFaceVerification`                             | `src/lib/face-recognition-state.ts`                    | Pure recognition helpers for non-PII external IDs and expected-user matching          |
| `stopFaceCameraStreams`, `useFaceCameraCleanup`                               | `src/lib/face-camera-cleanup.ts`                       | Best-effort cleanup for Amplify-owned camera streams                                  |
| `useSuppressReadableStreamCancelError`                                        | `src/lib/use-suppress-readable-stream-cancel-error.ts` | Client hook suppressing known Amplify stream cleanup noise while camera is active     |
| `SESSION_COOKIE`                                                              | `src/lib/auth-shared.ts`                               | `"atk_session"`                                                                       |
| `SIGN_IN_PATH`                                                                | `src/lib/auth-shared.ts`                               | `"/signin"`                                                                           |
| `PUBLIC_PATHS`                                                                | `src/lib/auth-shared.ts`                               | `string[]` — routes reachable without a session                                       |
| `sessionCookieOptions`                                                        | `src/lib/auth-shared.ts`                               | `(expiresAt: Date) → cookie options`                                                  |

## State store (Zustand)

| Symbol             | File                | Signature                                                                                |
| ------------------ | ------------------- | ---------------------------------------------------------------------------------------- |
| `useCartStore`     | `src/store/cart.ts` | store: `items`, `addItem(product, qty?)`, `removeItem(id)`, `setQty(id, qty)`, `clear()` |
| `selectTotalCount` | `src/store/cart.ts` | `(state) => number` — total units                                                        |
| `selectTotalCents` | `src/store/cart.ts` | `(state) => number` — total satang                                                       |

## Database

| Symbol                                                                                                                            | File               | Kind                                            |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------- |
| `db`                                                                                                                              | `src/db/index.ts`  | Drizzle client (server-only)                    |
| `shelves`, `products`, `shelfProducts`                                                                                            | `src/db/schema.ts` | catalog/shelf pgTables                          |
| `users`, `sessions`                                                                                                               | `src/db/schema.ts` | auth/session pgTables                           |
| `faceLivenessAttempts`, `userFaceProfiles`                                                                                        | `src/db/schema.ts` | liveness attempt + user↔FaceId mapping pgTables |
| `authMethodEnum`, `faceEnrollmentStatusEnum`, `livenessAttemptStatusEnum`, `faceLivenessIntentEnum`, `faceRecognitionOutcomeEnum` | `src/db/schema.ts` | pgEnums                                         |
| `*Relations`                                                                                                                      | `src/db/schema.ts` | Drizzle relations                               |

## Hooks & utilities

| Symbol        | File                      | Signature                              |
| ------------- | ------------------------- | -------------------------------------- |
| `useHydrated` | `src/lib/use-hydrated.ts` | `(): boolean`                          |
| `formatPrice` | `src/lib/format.ts`       | `(cents: number): string` → `"฿35.00"` |
| `cn`          | `src/lib/utils.ts`        | `(...inputs: ClassValue[]): string`    |

## Types

| Symbol                                                                                          | File                                         | Definition                                                 |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------- |
| `Shelf`                                                                                         | `src/db/schema.ts` (re-exported `src/types`) | `typeof shelves.$inferSelect`                              |
| `Product`                                                                                       | `src/db/schema.ts` (re-exported `src/types`) | `typeof products.$inferSelect`                             |
| `ShelfProduct`                                                                                  | `src/db/schema.ts`                           | `typeof shelfProducts.$inferSelect`                        |
| `User`                                                                                          | `src/db/schema.ts`                           | `typeof users.$inferSelect`                                |
| `NewUser`                                                                                       | `src/db/schema.ts`                           | `typeof users.$inferInsert`                                |
| `Session`                                                                                       | `src/db/schema.ts`                           | `typeof sessions.$inferSelect`                             |
| `FaceLivenessAttempt`                                                                           | `src/db/schema.ts`                           | `typeof faceLivenessAttempts.$inferSelect`                 |
| `UserFaceProfile`                                                                               | `src/db/schema.ts`                           | `typeof userFaceProfiles.$inferSelect`                     |
| `AuthMethod`                                                                                    | `src/db/schema.ts`                           | `(typeof authMethodEnum.enumValues)[number]`               |
| `FaceEnrollmentStatus`, `LivenessAttemptStatus`, `FaceLivenessIntent`, `FaceRecognitionOutcome` | `src/db/schema.ts`                           | enum unions                                                |
| `ShelfWithProducts`                                                                             | `src/types/index.ts`                         | `Shelf & { products: Product[] }`                          |
| `CartItem`                                                                                      | `src/types/index.ts`                         | `{ productId, sku, name, priceCents, imageUrl, quantity }` |
