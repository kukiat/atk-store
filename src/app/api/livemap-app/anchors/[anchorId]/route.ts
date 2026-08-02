import { type NextRequest, NextResponse } from "next/server";

import {
  LivemapAppValidationError,
  parseAnchorId,
} from "@/lib/livemap-app-contract";
import {
  authorizeLivemapApp,
  livemapBadRequest,
  livemapNoStoreHeaders,
} from "@/lib/livemap-app-route";
import { livemapAppService } from "@/services/livemap-app.service";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ anchorId: string }> },
) {
  const authError = authorizeLivemapApp(request);
  if (authError) return authError;

  try {
    const anchorId = parseAnchorId((await params).anchorId);
    const inventories = await livemapAppService.findByAnchor(anchorId);
    return NextResponse.json(
      { anchorId, inventories },
      { headers: livemapNoStoreHeaders },
    );
  } catch (error) {
    if (error instanceof LivemapAppValidationError) {
      return livemapBadRequest(error);
    }
    throw error;
  }
}
