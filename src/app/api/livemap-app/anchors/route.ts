import { NextResponse } from "next/server";

import {
  LivemapAppValidationError,
  parseAnchorMapping,
} from "@/lib/livemap-app-contract";
import {
  authorizeLivemapApp,
  livemapBadRequest,
  livemapNoStoreHeaders,
} from "@/lib/livemap-app-route";
import {
  LivemapInventoryNotFoundError,
  livemapAppService,
} from "@/services/livemap-app.service";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  const authError = authorizeLivemapApp(request);
  if (authError) return authError;

  try {
    const mapping = parseAnchorMapping(await request.json());
    const inventory = await livemapAppService.mapAnchor(mapping);
    return NextResponse.json(
      { inventory },
      { headers: livemapNoStoreHeaders },
    );
  } catch (error) {
    if (error instanceof LivemapInventoryNotFoundError) {
      return NextResponse.json(
        { error: "not_found", message: error.message },
        { status: 404, headers: livemapNoStoreHeaders },
      );
    }
    if (
      error instanceof LivemapAppValidationError ||
      error instanceof SyntaxError
    ) {
      return livemapBadRequest(error);
    }
    throw error;
  }
}
