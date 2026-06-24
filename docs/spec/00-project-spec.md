# ATK Store — Face Liveness Enrollment (Draft)

Status: planning draft, pending approval before implementation.

## Purpose

Let a signed-in ATK Store customer complete one Amazon Rekognition Face Liveness
check and retain a verified reference image in the Tokyo S3 bucket. This phase
proves the integration; it does not create a Face Collection or perform face
recognition.

## User workflow

1. A customer signs in with the existing Google OAuth flow.
2. A compact, non-blocking prompt appears only while the customer has not
   registered their face.
3. The customer explicitly chooses to register, reads the short data-use notice,
   and begins one liveness attempt.
4. The app shows the liveness result and marks the customer registered only after
   a successful backend decision.

## Core rules

- The registration page and every liveness API route require the existing
  database-backed application session.
- A normal attempt makes exactly three Rekognition calls: one backend
  `CreateFaceLivenessSession`, one client `StartFaceLivenessSession`, and one
  backend `GetFaceLivenessSessionResults` after the detector completion callback.
- The app must never poll Rekognition. A documented transient result may receive
  at most one delayed retry, so an exceptional attempt makes at most four calls.
- One user can own only one active attempt at a time. Repeated taps or requests
  reuse that attempt while it is valid; an expired or completed attempt requires
  an explicit new attempt.
- Browser code receives only short-lived AWS credentials. It never receives an
  IAM access key, backend AWS profile credentials, Google client secret, or S3
  object access beyond the detector's required streaming permission.
- Output images remain private in the Tokyo bucket and expire through the
  configured S3 lifecycle. Raw selfie video is not persisted by this app.
- In this phase, `registered` means liveness accepted and the reference image
  was recorded. It does not mean that a face vector was indexed.

## Data and contracts

- `users` gains a server-authoritative enrollment status and registration
  timestamp; the UI derives the prompt from this status.
- A separate liveness-attempt record stores ownership, AWS session ID, idempotency
  token, lifecycle status, score, and S3 object key metadata. It must not store
  raw biometric bytes or expose them to another user.
- The existing Google OAuth callback currently discards the Google ID token.
  A credential-bridge spike must prove a server-side, short-lived way to exchange
  a valid Google token through the Cognito Identity Pool and return only temporary
  credentials to the signed-in browser.

## Non-goals

- Face Collection, `IndexFaces`, `SearchFacesByImage`, and identifying a person
  such as “นาย A”.
- Making face registration block shelf browsing or checkout. The prompt is
  non-blocking unless the product rule changes later.
- Long-term biometric retention, custom KMS encryption, or a production hosting
  role. Those are separate phases.

## Open decisions

- Final confidence threshold: plan assumes the configured value of 90 for the
  proof-of-integration phase.
- Whether a later production flow should refresh Google tokens silently or require
  a short reauthentication when a token needed for the credential bridge has
  expired.
