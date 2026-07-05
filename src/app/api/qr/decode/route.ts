import { type NextRequest, NextResponse } from "next/server";

import { hasSameOrigin, requireCurrentUser } from "@/lib/auth";
import { isMobileOrTabletRequest } from "@/lib/device";
import { decodeShelfQrPayload } from "@/lib/qr-payload";
import { shelfService } from "@/services/shelf.service";
import {
  StoreScanNotAllowedError,
  storeAccessService,
} from "@/services/store-access.service";

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 },
    );
  }

  if (!isMobileOrTabletRequest(request)) {
    return NextResponse.json(
      { error: "QR decode is available on mobile/tablet only" },
      { status: 403 },
    );
  }

  const user = await requireCurrentUser();
  try {
    await storeAccessService.requireScanEligibility(user.id);
  } catch (error) {
    if (error instanceof StoreScanNotAllowedError) {
      return NextResponse.json(
        { error: error.eligibility.message, reason: error.eligibility.reason },
        { status: 409 },
      );
    }
    throw error;
  }

  const body = (await request.json()) as { encodedPayload?: unknown };
  if (typeof body.encodedPayload !== "string") {
    return NextResponse.json(
      { error: "encodedPayload is required" },
      { status: 400 },
    );
  }

  try {
    const payload = decodeShelfQrPayload(body.encodedPayload);
    const shelves = await shelfService.listShelvesByIds(payload.shelfIds);

    return NextResponse.json({ shelfIds: payload.shelfIds, shelves });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid QR payload" },
      { status: 400 },
    );
  }
}
