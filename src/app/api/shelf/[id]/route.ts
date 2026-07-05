import { type NextRequest, NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { isMobileOrTabletRequest } from "@/lib/device";
import { shelfService } from "@/services/shelf.service";
import {
  StoreScanNotAllowedError,
  storeAccessService,
} from "@/services/store-access.service";

// GET /api/shelf/:id -> shelf with active inventories.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isMobileOrTabletRequest(request)) {
    return NextResponse.json(
      { error: "Shelf API is available on mobile/tablet only" },
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

  const { id } = await params;
  const shelf = await shelfService.getShelfWithInventories(id);

  if (!shelf) {
    return NextResponse.json({ error: "Shelf not found" }, { status: 404 });
  }

  return NextResponse.json(shelf);
}
