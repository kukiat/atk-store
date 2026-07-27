# Client Attendance Animation Handoff

Status: approved for implementation on 2026-07-18.

## Trigger

The handoff applies only to a recognized frame submitted to
`POST /api/client-attendance/recognize` with direction `entry` or `exit`.
Manual attendance overrides and `sighting` events do not publish this handoff.

## Transition Rules

- Entry publishes only when that request creates a new `inside` visit.
- Exit publishes only when that request changes an open visit from `inside` to
  `exited`.
- A request that observes the target state already present does not upload an
  image and does not call the animation server.
- A database error while stamping a recognized user's visit publishes a
  best-effort `fail` result and then preserves the original stamp error.

## Success Order

1. Persist the visit transition.
2. Upload the exact frame from the successful request.
3. Send the animation status with the uploaded public URL in
   `payload.imageURL`.
4. For a genuine entry transition only, load the store map and publish the
   inside-camera handoff after the `verify` animation request succeeds.

Entry images use `S3_ENTRY_IMAGE_FOLDER`; exit images use
`S3_EXIT_IMAGE_FOLDER`.

## Animation Contract

The endpoint is:

```text
POST {ANIMATION_SERVER_URL}/users/{userId}/status
```

Entry success:

```json
{
  "action": "verify",
  "payload": {
    "result": "pass",
    "imageURL": "https://..."
  }
}
```

Exit success uses action `pay` with the same payload shape. Stamp failures use
the matching action and `payload.result = "fail"` without `imageURL`.

## Inside-Camera Handoff Contract

The inside-camera handoff applies only to the winning recognized `entry`
transition. It is not published for `exit`, `sighting`, manual overrides, or a
duplicate entry request that observes an already-open visit.

`INSIDE_WORKER_SERVER_URL` is the base URL. When it is empty,
`ANIMATION_SERVER_URL` is used as a fallback. Both requests authenticate with:

```text
x-inside-worker-key: {INSIDE_WORKER_API_KEY}
```

First, load the configured start point:

```text
GET {INSIDE_WORKER_SERVER_URL}/inside-worker/maps/{storeId}
```

The map may be returned directly or inside a `data` or `map` envelope. Its
required entry shape is:

```json
{
  "entry": {
    "start": { "x": 1.5, "y": 0, "z": -12 },
    "radius": 1.25,
    "ttlMs": 15000
  }
}
```

Then publish:

```text
POST {INSIDE_WORKER_SERVER_URL}/inside-worker/handoffs
```

```json
{
  "handoffId": "entry-101",
  "userId": 42,
  "storeId": "atk-default",
  "sourceCameraId": "front-door",
  "occurredAt": "2026-07-18T07:00:00.000Z",
  "start": { "x": 1.5, "y": 0, "z": -12 },
  "startRadius": 1.25,
  "ttlMs": 15000
}
```

`handoffId` is deterministic from the attendance event ID so delivery retries
remain idempotent. `occurredAt` uses the worker capture time when present and
falls back to the persisted event creation time. The default store ID is
`atk-default` and can be changed with `INSIDE_WORKER_STORE_ID`.

The visit's persisted `entryEventId` is the durable outbox record. After S3
upload, normal entry integration first stores `insideHandoffAnimationPendingAt`
and the image URL. It then sends the idempotent animation command and writes
`insideHandoffReadyAt`; a crash at either point is resumed by the outbox worker.
The animation command carries `entry-{eventId}` as its idempotency key, so a
committed request whose response was lost is acknowledged without emitting the
entry transition twice.
Manual overrides never receive this server-owned stage. Successful handoff
delivery writes `insideHandoffDeliveredAt`.
Run `npm run inside-worker:outbox` with the application so failed deliveries
continue retrying after request or process failures. The dashboard endpoint is
idempotent for the deterministic handoff ID.

## Failure Handling

- S3 upload and animation HTTP delivery each receive at most three attempts.
- Inside-worker map lookup and handoff delivery each receive at most three
  attempts.
- Attendance S3 calls disable the AWS SDK's internal retry layer so the
  coordinator remains the single three-attempt boundary.
- S3 retries reuse an event-based object key to avoid duplicate objects after an
  ambiguous upload response.
- S3 must succeed before a success notification can be sent because
  `payload.imageURL` is required.
- Exhausted post-stamp side effects are logged and do not roll back a persisted
  visit transition.
- An animation failure does not upload the image again; only the HTTP delivery
  is retried.
- A map or handoff failure happens after successful entry animation delivery
  and does not repeat the upload or animation request.
