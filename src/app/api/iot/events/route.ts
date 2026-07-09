import { NextResponse } from "next/server";

import {
  IotApiAuthorizationError,
  requireIotApiKey,
} from "@/lib/iot-api-auth";
import { iotEventProcessorService } from "@/services/iot-event-processor.service";
import { normalizeLoadcellMessage } from "@/services/iot-loadcell-contract";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireIotApiKey(request);
  } catch (error) {
    if (error instanceof IotApiAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    throw error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  try {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw new Error("Request body must be a JSON object");
    }
    const payload = body as { topic?: unknown; payload?: unknown };
    if (typeof payload.topic !== "string") {
      throw new Error("topic is required");
    }
    if (
      typeof payload.payload !== "object" ||
      payload.payload === null ||
      Array.isArray(payload.payload)
    ) {
      throw new Error("payload must be a JSON object");
    }

    const event = normalizeLoadcellMessage(
      payload.topic,
      payload.payload as Record<string, unknown>,
    );
    const result = await iotEventProcessorService.process(event);
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid IOT event" },
      { status: 400 },
    );
  }
}
