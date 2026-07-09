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
  const initialSession = await iotSessionService.getSession(sessionId);

  if (!initialSession || initialSession.userId !== user.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      function safeEnqueue(chunk: Uint8Array) {
        if (closed) return;

        try {
          controller.enqueue(chunk);
        } catch (error) {
          if (
            error instanceof Error &&
            "code" in error &&
            error.code === "ERR_INVALID_STATE"
          ) {
            closed = true;
            return;
          }

          throw error;
        }
      }

      function safeClose() {
        if (closed) return;
        closed = true;

        try {
          controller.close();
        } catch (error) {
          if (
            error instanceof Error &&
            "code" in error &&
            error.code === "ERR_INVALID_STATE"
          ) {
            return;
          }

          throw error;
        }
      }

      async function sendLatestSession() {
        if (closed) return;

        const session = await iotSessionService.getSession(sessionId);
        if (!session || session.userId !== user.id) {
          safeEnqueue(
            encodeEvent("iot-session-error", {
              message: "Session not found",
            }),
          );
          return;
        }

        safeEnqueue(encodeEvent("iot-session-updated", { session }));
      }

      const unsubscribe = subscribeIotSessionUpdated(sessionId, () => {
        void sendLatestSession();
      });
      const keepAliveId = setInterval(() => {
        safeEnqueue(encoder.encode(": keep-alive\n\n"));
      }, 25_000);

      request.signal.addEventListener(
        "abort",
        () => {
          clearInterval(keepAliveId);
          unsubscribe();
          safeClose();
        },
        { once: true },
      );

      void sendLatestSession();
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
