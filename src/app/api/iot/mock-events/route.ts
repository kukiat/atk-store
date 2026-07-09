import { type NextRequest, NextResponse } from "next/server";

import { hasSameOrigin, requireCurrentUser } from "@/lib/auth";
import { adminUserService } from "@/services/admin-user.service";
import { iotEventProcessorService } from "@/services/iot-event-processor.service";
import { normalizeLoadcellMessage } from "@/services/iot-loadcell-contract";
import { iotSessionService } from "@/services/iot-session.service";

export const runtime = "nodejs";

function readOptionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readCount(value: unknown) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 0) {
    throw new Error("pickedCount must be a non-negative integer");
  }
  return count;
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
  const sessionId = readOptionalText(body.sessionId);
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }
  const session = await iotSessionService.getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const branchCode = session.branchCode;
  const eventType = readOptionalText(body.type) ?? "picked_count";
  const kind = eventType === "door_closed" ? "status" : "event";
  const topic = `${session.sessionId}/loadcell/${branchCode}/${session.inventoryId}/${kind}`;
  const payload =
    eventType === "door_closed"
      ? {
          branch: branchCode,
          seq: Date.now(),
          status: "shelf_closed",
          timestamp: new Date().toISOString(),
        }
      : {
          branch: branchCode,
          event: "item_picked",
          seq: Date.now(),
          sku: session.inventoryId,
          itemName: session.inventoryName,
          pickedQty: readCount(body.pickedCount),
          currentQty:
            typeof body.currentQty === "number"
              ? body.currentQty
              : session.currentQty,
          timestamp: new Date().toISOString(),
        };

  try {
    const result = await iotEventProcessorService.process(
      normalizeLoadcellMessage(topic, payload),
    );
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid mock event" },
      { status: 400 },
    );
  }
}
