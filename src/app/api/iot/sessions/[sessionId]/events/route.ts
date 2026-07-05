import { type NextRequest, NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { isMobileOrTabletRequest } from "@/lib/device";
import { subscribeIotSessionUpdated } from "@/services/iot-session-events.service";
import { iotSessionService } from "@/services/iot-session.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const encoder = new TextEncoder();

function encodeEvent(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  if (!isMobileOrTabletRequest(request)) {
    return NextResponse.json(
      { error: "IOT session events are available on mobile/tablet only" },
      { status: 403 },
    );
  }

  const user = await requireCurrentUser();
  const { sessionId } = await context.params;
  const initialSession = iotSessionService.getSession(sessionId);

  if (!initialSession || initialSession.userId !== user.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      function sendLatestSession() {
        if (closed) return;

        const session = iotSessionService.getSession(sessionId);
        if (!session || session.userId !== user.id) {
          controller.enqueue(
            encodeEvent("iot-session-error", {
              message: "Session not found",
            }),
          );
          return;
        }

        controller.enqueue(encodeEvent("iot-session-updated", { session }));
      }

      const unsubscribe = subscribeIotSessionUpdated(
        sessionId,
        sendLatestSession,
      );
      const keepAliveId = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(": keep-alive\n\n"));
      }, 25_000);

      request.signal.addEventListener(
        "abort",
        () => {
          closed = true;
          clearInterval(keepAliveId);
          unsubscribe();
          controller.close();
        },
        { once: true },
      );

      sendLatestSession();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store, no-transform",
      "Content-Type": "text/event-stream; charset=utf-8",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
