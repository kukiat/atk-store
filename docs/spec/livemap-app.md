# LiveMap native app and API

Status: implementation contract

## Purpose

Provide a dedicated Flutter operator app for placing shelf markers as ARCore
Cloud Anchors and associating each returned Cloud Anchor ID with one ATK Store
inventory record. The same app lets staff select a mapped product and resolve
its anchor in the camera view.

## API contract

All routes live under `/api/livemap-app`, run on the Node.js runtime, return
`Cache-Control: no-store`, and require the `x-livemap-app-key` request header.
The server compares that value against the required `LIVEMAP_APP_API_KEY`
environment variable using a timing-safe comparison. Missing or invalid keys
return `401`; a missing server setting returns `500` without exposing its value.

- `GET /api/livemap-app/inventories?q=<text>&anchored=<true|false>` lists active,
  non-deleted inventory records. `q` is an optional case-insensitive name or
  description search. `anchored` optionally limits results by anchor presence.
- `PUT /api/livemap-app/anchors` accepts `{ "anchorId": string,
  "inventoryId": UUID }`, updates that inventory, and returns the mapped record.
- `GET /api/livemap-app/anchors/<anchorId>` returns active, non-deleted inventory
  records mapped to the exact anchor ID so an operator can confirm a resolved
  shelf marker.

`anchorId` is stored as nullable text on `inventories`. Existing products remain
valid while unmapped. Multiple inventory records may intentionally share an
anchor because one physical shelf marker can represent more than one product.

## Mobile workflow

The app has two English destinations:

1. **Anchor Setup** opens the AR camera, detects horizontal/vertical planes,
   places a local anchor on tap, hosts it to the ARCore Cloud Anchor service,
   displays the returned anchor ID, lets the operator select an inventory item,
   and saves the mapping through the API.
2. **Product Finder** searches only mapped inventory, then opens the AR camera
   and resolves the selected Cloud Anchor ID so its marker appears in the scene.

The app reads `ATK_API_URL`, `ARCORE_API_KEY`, and `LIVEMAP_APP_API_KEY` from its
bundled `.env`. These values are client-visible configuration, not server-grade
secrets. Production access should therefore use a restricted/rotatable app key;
ARCore API-key restrictions must include the Android package/signing identity
and iOS bundle identifier.

## Platform requirements

- Android declares camera, internet, AR camera feature, ARCore metadata, and a
  minimum SDK compatible with ARCore.
- iOS declares camera and local-network descriptions, requires an ARKit-capable
   device, and targets an ARCore/ARKit-compatible iOS version.

The Android platform view must receive the requested plane-detection mode at
creation time. The initial ARCore session must not start with plane finding
disabled and depend on a later asynchronous method-channel call to enable it.
- AR device behavior is not considered testable in a simulator. Static analysis,
  unit/widget tests, and platform configuration checks are the local acceptance
  baseline; physical Android and iOS device verification remains required before
  production use.
