import { type NextRequest, NextResponse } from "next/server";

import { hasSameOrigin, requireCurrentUser } from "@/lib/auth";
import { isMobileOrTabletRequest } from "@/lib/device";
import { decodeShelfQrPayload } from "@/lib/qr-payload";
import { shelfService } from "@/services/shelf.service";

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

  await requireCurrentUser();

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
