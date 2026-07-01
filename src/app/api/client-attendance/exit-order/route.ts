import { type NextRequest, NextResponse } from "next/server";

import {
  ClientAttendanceAuthConfigError,
  ClientAttendanceAuthError,
  requireClientAttendanceApiKey,
} from "@/lib/client-attendance-auth";
import { orderService } from "@/services/order.service";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" } as const;

export async function POST(request: NextRequest) {
  try {
    requireClientAttendanceApiKey(request);

    const body = (await request.json()) as { clientVisitId?: unknown };
    const clientVisitId = Number(body.clientVisitId);
    if (!Number.isInteger(clientVisitId) || clientVisitId <= 0) {
      return NextResponse.json(
        { error: "bad_request", message: "clientVisitId is required" },
        { status: 400, headers: noStore },
      );
    }

    const order = await orderService.createPaidMockOrderFromCart(clientVisitId);
    return NextResponse.json({ order }, { headers: noStore });
  } catch (error) {
    if (error instanceof ClientAttendanceAuthError) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401, headers: noStore },
      );
    }

    if (error instanceof ClientAttendanceAuthConfigError) {
      return NextResponse.json(
        { error: "server_misconfigured", message: error.message },
        { status: 500, headers: noStore },
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "bad_request", message: error.message },
        { status: 400, headers: noStore },
      );
    }

    throw error;
  }
}
