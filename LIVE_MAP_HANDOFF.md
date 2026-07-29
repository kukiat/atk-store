# ATK Store Live Map — Session Handoff

## Current objective

Continue the Live Map feature in this repository. The latest change moves QR
Anchor images from dynamically generated base64 Data URLs to public S3 PNG URLs
using `S3_LIVEMAP_IMAGE_FOLDER`.

## What has been done

- Back Office Live Map is available at `/admin/live-map`, beside Demo Status.
- The Admin canvas supports create, select/update, and delete for:
  - floor boundary
  - no-walk areas
  - walk paths
  - QR Anchors
  - product destinations
- Map readiness validation checks whether the boundary, paths, Anchors, and
  destinations are ready for navigation.
- The customer QR flow is available at `/live-map/start/[token]`.
- Customer Live Map supports:
  - product search and selection
  - calculated 2D route and remaining distance
  - elapsed navigation time
  - navigation session statistics
  - a WebAR prototype using the camera, device orientation, and motion
  - Anchor-yaw calibration, step estimation, map matching, off-route warnings,
    and arrival state
- Customer camera frames and video are neither uploaded nor stored.
- `navigation_sessions` and its API routes were added in
  `drizzle/0011_hot_scarlet_witch.sql`.

## QR Anchor S3 implementation

- Added nullable column:

  ```text
  auth.navigation_anchors.qr_image_url
  ```

- Added migration:

  ```text
  drizzle/0012_natural_giant_girl.sql
  ```

- When creating a new Anchor, the system now:
  1. creates the public token and customer Live Map URL
  2. generates the QR PNG
  3. uploads it to S3
  4. inserts the returned public URL into `qr_image_url`
- A legacy Anchor with a null `qr_image_url` is lazily migrated when Admin Live
  Map loads:
  1. generate its QR PNG
  2. upload it once
  3. update `qr_image_url`
- The Admin preview, Download QR, and Open / Print links use `qrImageUrl`.
- `.env.example` now contains:

  ```env
  S3_LIVEMAP_IMAGE_FOLDER=livemap
  ```

## Database and verification status

- Migrations 0011 and 0012 were applied to the database configured by the local
  `.env`.
- Existing Anchor `ENT1` was migrated successfully:
  - `qr_image_url` is non-null
  - it is not a `data:` or base64 URL
  - it points to the configured public S3 `/livemap/` folder
  - browser verification confirmed that the PNG loads at 512×512
- Tests passed: 77/77.
- Lint has no errors. Two unrelated existing warnings remain in
  `tmp/aws_face_constrain_builder/build.mjs`.
- Production build passed when network access was available for Google Fonts.

## Deployment status

- The user deployed the earlier full Live Map/WebAR implementation, which was
  verified at:

  ```text
  https://atk.hexdas.cloud/admin/live-map
  ```

- Deployment of the later S3 QR-image source changes has not been confirmed.
- The database migration and legacy `ENT1` S3 backfill have already been
  applied against the configured database.
- Before deploying the S3 source change, confirm the production runtime has:

  ```env
  S3_LIVEMAP_IMAGE_FOLDER=livemap
  ```

## Important decisions and constraints

- Phase 1 uses Floor 1, but the data model should remain extensible to multiple
  floors.
- Product positions are navigation destinations. Do not bind them to shelf
  geometry because IoT owns shelf placement.
- QR Anchors may be placed freely and include physical dimensions, mount
  height, yaw, and the expected customer start point.
- Customers must be logged in and have an active face-verified store visit.
- GPS is not used for indoor navigation.
- No customer video is stored or uploaded.
- Preserve the existing dirty worktree and do not overwrite unrelated changes.
- Repository Git rule: do not stage, commit, push, pull, merge, switch, reset,
  or otherwise mutate Git state unless the user explicitly requests that exact
  action.
- Prefix every shell command with `rtk`.
- This project uses Next.js 16.2.9 with project-specific rules in `AGENTS.md`.
  Read the relevant local Next.js documentation before modifying Next-specific
  APIs.

## Customer navigation accuracy contract

- The raw dead-reckoning position derived from accepted steps is the source of
  truth for remaining distance and arrival. Map matching must not overwrite it.
- Projection onto a Walk path is display-only and applies only within 0.55 m.
- Automatic arrival requires the raw position to stay within 0.45 m of the
  destination for at least 1.2 seconds with continuous sensor callbacks.
- A sensor callback gap over 0.5 seconds or pausing AR resets a pending arrival
  confirmation without clearing an already confirmed arrival.
- Once arrived, the state remains stable until the raw position moves more than
  0.9 m away.
- Walking away resumes both the customer UI and the persisted navigation
  session, clearing its previous completion timestamp and duration.
- Device-motion samples recorded during rapid rotation must not create walking
  steps. Normal turns must remain usable.
- Camera frames and customer video remain local to the browser and are not
  uploaded or stored.

## Relevant files

- `AGENTS.md`
- `src/app/admin/live-map/live-map-editor.tsx`
- `src/app/admin/live-map/actions.ts`
- `src/app/live-map/start/[token]/customer-live-map.tsx`
- `src/app/api/live-map/sessions/route.ts`
- `src/app/api/live-map/sessions/[sessionId]/route.ts`
- `src/services/live-map.service.ts`
- `src/services/s3-storage.service.ts`
- `src/services/s3-storage.service.test.ts`
- `src/services/navigation-session.service.ts`
- `src/lib/live-map-routing.ts`
- `src/lib/live-map-validation.ts`
- `src/db/schema.ts`
- `drizzle/0011_hot_scarlet_witch.sql`
- `drizzle/0012_natural_giant_girl.sql`

## Current Git/worktree state

- Branch: `features/live-map`
- Live Map and S3 changes are modified or untracked locally.
- Codex did not commit or push because the user did not explicitly request
  those exact Git actions.
- Start by running:

  ```bash
  rtk git status --short
  rtk git diff --stat
  ```

- Do not discard user changes.

## Open questions and blockers

- Confirm whether the latest S3 QR-image source change has been deployed.
- If it has not been deployed, obtain exact authorization before any Git commit
  or push.
- After deployment, verify that production Admin QR image URLs contain
  `/livemap/` and are not `data:` URLs.
- A real-phone physical walk test is still required to assess WebAR sensor
  accuracy and gyro/accelerometer drift.

## Suggested skills

- `browser:control-in-app-browser` for local or production UI verification.
- `chrome:control-chrome` when an existing signed-in Chrome session is required
  for Admin access.

## Recommended next steps

1. Inspect the dirty worktree and confirm that migrations 0011/0012 and all
   untracked Live Map files are included in the intended deployment.
2. Confirm `S3_LIVEMAP_IMAGE_FOLDER=livemap` exists in the production runtime.
3. If explicitly authorized, perform the requested Git actions and deploy.
4. Verify production `/admin/live-map`:
   - QR preview loads
   - preview/download/open links use an HTTPS S3 URL under `/livemap/`
   - no `data:image/...;base64` remains
5. Create a test QR Anchor only if the user authorizes creating production test
   data, then verify its S3 URL is inserted immediately.
6. Test WebAR on a real phone while standing in front of the physical QR
   Anchor.
