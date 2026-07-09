import { type NextRequest, NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { isMobileOrTabletRequest } from "@/lib/device";
import { iotSessionService } from "@/services/iot-session.service";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  if (!isMobileOrTabletRequest(request)) {
    return NextResponse.json(
      { error: "IOT session status is available on mobile/tablet only" },
      { status: 403 },
    );
  }

  const user = await requireCurrentUser();
  const { sessionId } = await context.params;
  const session = await iotSessionService.getSession(sessionId);

  if (!session || session.userId !== user.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({ session });
}
