import { NextResponse } from "next/server";

import { hasSameOrigin, requireCurrentUser } from "@/lib/auth";
import {
  type NavigationMode,
  navigationSessionService,
} from "@/services/navigation-session.service";

function isMode(value: unknown): value is NavigationMode {
  return value === "map" || value === "ar";
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const user = await requireCurrentUser();
    const body = (await request.json()) as Record<string, unknown>;
    if (
      typeof body.anchorToken !== "string" ||
      typeof body.destinationId !== "string" ||
      typeof body.distanceMeters !== "number" ||
      !isMode(body.mode)
    ) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    return NextResponse.json(
      await navigationSessionService.start(user.id, {
        anchorToken: body.anchorToken,
        destinationId: body.destinationId,
        distanceMeters: body.distanceMeters,
        mode: body.mode,
      }),
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "unknown_error" },
      { status: 400 },
    );
  }
}
