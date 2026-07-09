import { NextResponse } from "next/server";

import { IotApiAuthorizationError, requireIotApiKey } from "@/lib/iot-api-auth";
import { iotInventoryCatalogService } from "@/services/iot-inventory-catalog.service";

export const runtime = "nodejs";

function readInteger(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

export async function GET(request: Request) {
  try {
    requireIotApiKey(request);
  } catch (error) {
    if (error instanceof IotApiAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    throw error;
  }

  const url = new URL(request.url);
  const rows = await iotInventoryCatalogService.listInventories({
    limit: readInteger(url.searchParams.get("limit")),
    offset: readInteger(url.searchParams.get("offset")),
    search: url.searchParams.get("search"),
  });

  return NextResponse.json(rows);
}
