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

## Failure Handling

- S3 upload and animation HTTP delivery each receive at most three attempts.
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
