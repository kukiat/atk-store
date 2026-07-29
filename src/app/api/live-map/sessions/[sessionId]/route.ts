import { NextResponse } from "next/server";

import { hasSameOrigin, requireCurrentUser } from "@/lib/auth";
import {
  type NavigationMode,
  type NavigationStatus,
  navigationSessionService,
} from "@/services/navigation-session.service";

function isMode(value: unknown): value is NavigationMode {
  return value === "map" || value === "ar";
}

function isStatus(value: unknown): value is NavigationStatus {
  return value === "navigating" || value === "arrived" || value === "cancelled";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const user = await requireCurrentUser();
    const { sessionId } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    if (
      typeof body.x !== "number" ||
      typeof body.z !== "number" ||
      !isMode(body.mode) ||
      !isStatus(body.status)
    ) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    return NextResponse.json(
      await navigationSessionService.update(user.id, sessionId, {
        x: body.x,
        z: body.z,
        mode: body.mode,
        status: body.status,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "unknown_error" },
      { status: 400 },
    );
  }
}
