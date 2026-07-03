import { type NextRequest, NextResponse } from "next/server";

import { hasSameOrigin, requireCurrentUser } from "@/lib/auth";
import { adminUserService } from "@/services/admin-user.service";
import { iotSessionService } from "@/services/iot-session.service";

export const runtime = "nodejs";

function readOptionalText(value: unknown): string | null {
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

  const user = await requireCurrentUser();
  await adminUserService.getActor(user);

  const body = (await request.json()) as Record<string, unknown>;
  const pickedCount = Number(body.pickedCount);
  if (!Number.isInteger(pickedCount) || pickedCount < 0) {
    return NextResponse.json(
      { error: "pickedCount must be a non-negative integer" },
      { status: 400 },
    );
  }

  const session = await iotSessionService.applyPickedCount({
    sessionId: readOptionalText(body.sessionId),
    channelId: readOptionalText(body.channelId),
    shelfId: readOptionalText(body.shelfId),
    pickedCount,
    rawPayload: body,
  });

  return NextResponse.json({ session });
}
