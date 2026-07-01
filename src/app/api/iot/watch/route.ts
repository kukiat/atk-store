import { type NextRequest, NextResponse } from "next/server";

import { hasSameOrigin, requireCurrentUser } from "@/lib/auth";
import { isMobileOrTabletRequest } from "@/lib/device";
import { iotService } from "@/services/iot.service";
import type { CartItem } from "@/types";

function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Partial<CartItem>;
  return (
    typeof item.inventoryId === "string" &&
    typeof item.shelfId === "string" &&
    typeof item.name === "string" &&
    typeof item.price === "number" &&
    typeof item.weightPerPiece === "number" &&
    typeof item.unitId === "string" &&
    typeof item.quantity === "number" &&
    Number.isFinite(item.quantity) &&
    item.quantity > 0
  );
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
  const body = (await request.json()) as { items?: unknown };
  const items = Array.isArray(body.items) ? body.items : [];

  if (!items.every(isCartItem)) {
    return NextResponse.json(
      { error: "Invalid cart payload" },
      { status: 400 },
    );
  }

  const result = await iotService.watchCart(user, items);
  return NextResponse.json(result);
}
