import { NextResponse } from "next/server";

import {
  getMockIotProduct,
  isMockIotServerEnabled,
  MockIotServerError,
} from "@/services/mock-iot-server.service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ productId: string }> },
) {
  if (!isMockIotServerEnabled()) {
    return NextResponse.json(
      { error: "Mock IOT server is disabled" },
      { status: 404 },
    );
  }

  try {
    const { productId } = await context.params;
    return NextResponse.json(await getMockIotProduct(productId));
  } catch (error) {
    if (error instanceof MockIotServerError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
