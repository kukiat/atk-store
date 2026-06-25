# ATK Store — Face Liveness Enrollment Plan

Created: 2026-06-24

This plan is implementation-ready but no source code, packages, or AWS resources
are changed by the planning phase.

## Planning evidence

- Existing app: Next.js 16.2.9 App Router, React 19, Tailwind v4, shadcn/ui,
  Drizzle/PostgreSQL, custom Google OAuth and database sessions.
- Current auth: the callback receives a Google `id_token` but discards it; the
  browser has only the `atk_session` httpOnly cookie.
- AWS: Identity Pool and the browser's restricted `StartFaceLivenessSession`
  role exist; the backend local AWS profile works; Tokyo output S3 is private,
  SSE-S3 encrypted, and budget alert is configured.
- Rekognition guidance: the supplied `tmp/pdfs/rekognition-dg.pdf` specifies
  backend Create/Get, client Start, a three-minute single-use session lifetime,
  and an output bucket in the caller account and endpoint Region (pp. 707-712).
- Quality baseline: `npm run lint` passes; ESLint and Prettier are configured.
- Memory check: `.claude/state/memory-bridge-events.jsonl` has only session-stop
  events; no prior feature decision was available.

## Phase G: Google OAuth and application-session hardening

Purpose: make the existing local Google sign-in flow trustworthy before it gates
biometric enrollment or other private APIs. This phase deliberately does not
involve AWS or Cognito.

| Task | Content                                                                                                                                                                               | DoD                                                                                                                                                    | Depends | Status  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ------- |
| G.1  | Add OAuth `state`, PKCE, and nonce generation with short-lived httpOnly cookies; validate and clear them at callback. [feature:security] [tdd:required]                               | Missing, mismatched, and expired callback state is rejected before token exchange; a valid local callback passes its stored verifier and nonce.        | -       | cc:done |
| G.2  | Verify Google ID-token signature and claims; use verified `sub` and verified email rather than userinfo/access-token data. [feature:security] [tdd:required]                          | Invalid issuer, audience, expiry, nonce, signature, or unverified email fails closed and no user/session row is created.                               | G.1     | cc:done |
| G.3  | Make Google provider identity unique, reject ambiguous email linking, and hash opaque application session tokens before storing them in PostgreSQL. [feature:security] [tdd:required] | A raw `atk_session` value is absent from DB storage; a provider-sub mismatch for an existing email is rejected.                                        | G.2     | cc:done |
| G.4  | Add explicit route-level session/origin guards, convert logout to POST-only, remove unused offline consent, and minimize auth logging. [feature:security] [tdd:required]              | Protected-handler helper returns a valid DB-backed user or 401; cross-origin signout is rejected; GET signout is unavailable.                          | G.3     | cc:done |
| G.5  | Add/execute focused auth tests, lint, production build, and update code-base indexing.                                                                                                | Tests cover state, claims, session hashing, and origin validation; lint/build pass; `code_base_indexing/` reflects the new auth modules/routes/schema. | G.1-G.4 | cc:WIP  |

## Phase 0: Prove the credential bridge and call budget

Purpose: remove the only integration uncertainty before collecting biometric data.

| Task | Content                                                                                                                                    | DoD                                                                                                                                                                         | Depends | Status  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------- |
| 0.1  | Define and spike the session-owned Google-token to Cognito Identity Pool credential bridge [needs-spike] [feature:security] [tdd:required] | A signed-in local user can obtain detector-scoped temporary credentials without any Google token, AWS profile key, or client secret appearing in a browser response or log. | -       | cc:TODO |
| 0.2  | Define the per-attempt state machine and request budget: normal = Create + Start + Get; transient = one bounded delayed Get retry only.    | State transitions, retry eligibility, and 3/4-call upper bound are documented in an API contract and covered by tests.                                                      | 0.1     | cc:TODO |
| 0.3  | Add a focused test baseline for server/client liveness logic if the existing lint-only setup cannot run those tests. [tdd:required]        | A test command executes one mocked liveness state-machine test without calling AWS.                                                                                         | -       | cc:TODO |

## Phase 1: Persist enrollment and attempt ownership

Purpose: let the server deduplicate requests and let the UI accurately prompt each customer.

| Task | Content                                                                                                                                                    | DoD                                                                                                                                 | Depends  | Status  |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| 1.1  | Add migration/schema for customer enrollment status/timestamp and private liveness attempt records [feature:security] [tdd:required]                       | Migration applies locally; one user cannot own two active attempts; no column stores raw image bytes or AWS long-lived credentials. | 0.2, 0.3 | cc:TODO |
| 1.2  | Add server-only enrollment service with ownership checks, idempotent active-attempt reuse, and explicit terminal states. [feature:security] [tdd:required] | Unit tests prove duplicate create requests reuse the same active attempt and another user cannot read it.                           | 1.1      | cc:TODO |

## Phase 2: Add minimal-call backend contracts

Purpose: keep all costly or privileged decisions on the server.

| Task | Content                                                                                                                                                                                        | DoD                                                                                                                                         | Depends  | Status  |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| 2.1  | Implement authenticated route handlers for temporary detector credentials, one liveness-session creation, and one owned-session result read. [feature:security] [tdd:required]                 | Unauthenticated requests return 401; wrong-owner requests return 404; mocked normal flow invokes Create once and Get once.                  | Phase 1  | cc:TODO |
| 2.2  | Add server validation for environment shape, S3 output config, score threshold, session expiration, and bounded transient retry. [feature:security] [tdd:required]                             | Invalid configuration fails closed; a normal request causes no polling; a transient result permits only one delayed retry.                  | 2.1      | cc:TODO |
| 2.3  | Record only the result metadata needed for registration, mark the user registered only on accepted result, and return an intentionally small client payload. [feature:security] [tdd:required] | Score/decision and registration state are persisted; S3 key/raw result details are not returned unless explicitly required by the owner UI. | 2.1, 2.2 | cc:TODO |

## Phase 3: Add the quiet post-login enrollment UX

Purpose: guide a signed-in customer without starting a camera or creating an AWS session automatically.

| Task | Content                                                                                                                                                                                                                               | DoD                                                                                                                             | Depends  | Status  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| 3.1  | Add an authenticated, mobile-first header prompt that appears only for `not_registered` users and links to a dedicated registration page. [feature:a11y] [tdd:required]                                                               | Signed-out pages show no prompt; registered users show no prompt; the CTA is keyboard-accessible and does not call any AWS API. | 1.1      | cc:TODO |
| 3.2  | Build the registration page in the existing monochrome Tailwind/shadcn theme, including short consent/retention text, explicit start CTA, loading/error/success states, and no automatic camera launch. [feature:a11y] [tdd:required] | Visual smoke check in mobile viewport shows each state; pressing start once cannot create duplicate client requests.            | 2.3, 3.1 | cc:TODO |
| 3.3  | Integrate `FaceLivenessDetector` with a ref/state guard: start exactly once, call the result route only after `onAnalysisComplete`, and render the backend decision. [feature:a11y] [tdd:required]                                    | Mocked client test proves one start/result request per attempt; manual browser check shows no camera/API action before the CTA. | 2.3, 3.2 | cc:TODO |

## Phase 4: Controlled AWS proof and handoff

Purpose: prove the full path once within the $5 alert budget and leave an auditable baseline.

| Task | Content                                                                                                                                       | DoD                                                                                                                                                              | Depends | Status  |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------- |
| 4.1  | Run one controlled signed-in liveness attempt against Tokyo and inspect the owned result/S3 object metadata. [needs-spike] [feature:security] | One attempt reaches a recorded terminal state; server evidence shows Create=1 and Get=1 (or the single documented retry); no browser leak of secret credentials. | Phase 3 | cc:TODO |
| 4.2  | Run lint, tests, production build, and mobile visual smoke; update the codebase index to reflect new routes/schema/components.                | `npm run lint`, test command, and build pass; `code_base_indexing/` matches the changed source tree.                                                             | 4.1     | cc:TODO |

## Explicitly deferred

- Face Collection and face-vector indexing/search.
- Production IAM role/VPS deployment hardening.
- Making enrollment a hard gate for shopping.
