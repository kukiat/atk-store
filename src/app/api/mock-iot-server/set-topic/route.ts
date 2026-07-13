import { NextResponse } from "next/server";

import {
  isMockIotServerEnabled,
  MockIotServerError,
  setMockIotTopic,
} from "@/services/mock-iot-server.service";

export async function POST(request: Request) {
  if (!isMockIotServerEnabled()) {
    return NextResponse.json(
      { accepted: false, error: "Mock IOT server is disabled" },
      { status: 404 },
    );
  }

  try {
    const body = (await request.json()) as {
      uuid?: unknown;
      email?: unknown;
      sku?: unknown;
    };
    if (typeof body.uuid !== "string") {
      throw new MockIotServerError("uuid is required");
    }
    if (typeof body.email !== "string") {
      throw new MockIotServerError("email is required");
    }
    if (typeof body.sku !== "string") {
      throw new MockIotServerError("sku is required");
    }

    return NextResponse.json(
      await setMockIotTopic({
        uuid: body.uuid,
        email: body.email,
        sku: body.sku,
      }),
    );
  } catch (error) {
    if (error instanceof MockIotServerError) {
      return NextResponse.json(
        { accepted: false, error: error.message },
        { status: error.status },
      );
    }

    throw error;
  }
}
