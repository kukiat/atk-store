import { type NextRequest, NextResponse } from "next/server";

import { hasSameOrigin, requireCurrentUser } from "@/lib/auth";
import { isMobileOrTabletRequest } from "@/lib/device";
import { iotService } from "@/services/iot.service";
import {
  StoreScanNotAllowedError,
  storeAccessService,
} from "@/services/store-access.service";

function readInventoryId(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 },
    );
  }

  if (!isMobileOrTabletRequest(request)) {
    return NextResponse.json(
      { error: "IOT watch is available on mobile/tablet only" },
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

  const body = (await request.json()) as { inventoryId?: unknown };
  const inventoryId = readInventoryId(body.inventoryId);

  if (!inventoryId) {
    return NextResponse.json(
      { error: "inventoryId is required" },
      { status: 400 },
    );
  }

  try {
    const result = await iotService.openInventory(user, inventoryId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "IOT watch failed" },
      { status: 400 },
    );
  }
}
