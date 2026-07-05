import { NextResponse } from "next/server";

import {
  AuthenticationRequiredError,
  requireCurrentUser,
} from "@/lib/auth";
import { orderService } from "@/services/order.service";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" } as const;

export async function GET() {
  try {
    const user = await requireCurrentUser();
    const status = await orderService.getLatestVisitCheckoutStatusForUser(
      user.id,
    );

    return NextResponse.json(status, { headers: noStore });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401, headers: noStore },
      );
    }

    throw error;
  }
}
