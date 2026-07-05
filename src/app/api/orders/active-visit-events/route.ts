import { type NextRequest, NextResponse } from "next/server";

import {
  AuthenticationRequiredError,
  requireCurrentUser,
} from "@/lib/auth";
import { subscribeCartUpdated } from "@/services/cart-events.service";
import { cartSyncService } from "@/services/cart-sync.service";
import { clientVisitService } from "@/services/client-visit.service";
import { subscribeCheckoutStatus } from "@/services/order-events.service";
import { orderService } from "@/services/order.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const encoder = new TextEncoder();

function encodeEvent(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser();

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;

        async function sendLatestStatus() {
          if (closed) return;

          try {
            const status =
              await orderService.getLatestVisitCheckoutStatusForUser(user.id);
            controller.enqueue(encodeEvent("checkout-status", status));
          } catch (error) {
            controller.enqueue(
              encodeEvent("checkout-error", {
                message:
                  error instanceof Error
                    ? error.message
                    : "Unable to read checkout status",
              }),
            );
          }
        }

        async function sendLatestCart() {
          if (closed) return;

          try {
            const activeVisit = await clientVisitService.getActiveVisitForUser(
              user.id,
            );
            const cart = activeVisit
              ? await cartSyncService.getCart(activeVisit.id)
              : null;

            controller.enqueue(
              encodeEvent("cart-updated", {
                visit: activeVisit
                  ? {
                      id: activeVisit.id,
                      status: activeVisit.status,
                    }
                  : null,
                cart,
              }),
            );
          } catch (error) {
            controller.enqueue(
              encodeEvent("cart-error", {
                message:
                  error instanceof Error
                    ? error.message
                    : "Unable to read active cart",
              }),
            );
          }
        }

        const unsubscribe = subscribeCheckoutStatus(user.id, () => {
          void sendLatestStatus();
        });
        const unsubscribeCart = subscribeCartUpdated(user.id, () => {
          void sendLatestCart();
        });
        const keepAliveId = setInterval(() => {
          if (!closed) controller.enqueue(encoder.encode(": keep-alive\n\n"));
        }, 25_000);

        request.signal.addEventListener(
          "abort",
          () => {
            closed = true;
            clearInterval(keepAliveId);
            unsubscribe();
            unsubscribeCart();
            controller.close();
          },
          { once: true },
        );

        void sendLatestStatus();
        void sendLatestCart();
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
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: "unauthorized" },
        {
          status: 401,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    throw error;
  }
}
