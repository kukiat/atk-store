import { type NextRequest, NextResponse } from "next/server";

import {
  LivemapAppValidationError,
  parseAnchoredFilter,
  parseInventorySearch,
} from "@/lib/livemap-app-contract";
import {
  authorizeLivemapApp,
  livemapBadRequest,
  livemapNoStoreHeaders,
} from "@/lib/livemap-app-route";
import { livemapAppService } from "@/services/livemap-app.service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authError = authorizeLivemapApp(request);
  if (authError) return authError;

  try {
    const inventories = await livemapAppService.listInventories({
      query: parseInventorySearch(request.nextUrl.searchParams),
      anchored: parseAnchoredFilter(request.nextUrl.searchParams),
    });
    return NextResponse.json(
      { inventories },
      { headers: livemapNoStoreHeaders },
    );
  } catch (error) {
    if (error instanceof LivemapAppValidationError) {
      return livemapBadRequest(error);
    }
    throw error;
  }
}
