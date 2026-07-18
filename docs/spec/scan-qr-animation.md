# Scan QR Animation Handoff

Status: approved for implementation on 2026-07-18.

## Endpoint

```text
POST {ANIMATION_SERVER_URL}/users/{userId}/status
```

Request:

```json
{
  "action": "scanQR",
  "payload": {
    "result": "pass",
    "sku": "inventory-id",
    "userId": 42
  }
}
```

`result` is `pass` or `fail`.

## Flow

- `pass` is published only after `pick-sessions` and local IOT session creation
  both succeed.
- `fail` is published when `pick-sessions` returns a non-2xx response, has a
  network error, or local IOT session creation fails.
- Mock IOT mode and no-URL mode continue to local session creation and publish
  `pass` when that creation succeeds.
- Animation delivery receives at most three attempts.
- Exhausted Animation errors do not change the IOT result. They are appended as
  JSON lines to `log/dashboard/log.txt`.
