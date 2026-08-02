import { NextResponse } from "next/server";

import {
  LivemapAppAuthConfigError,
  LivemapAppAuthError,
  requireLivemapAppApiKey,
} from "@/lib/livemap-app-auth";
import { LivemapAppValidationError } from "@/lib/livemap-app-contract";

export const livemapNoStoreHeaders = { "Cache-Control": "no-store" } as const;

export function authorizeLivemapApp(request: Request): NextResponse | null {
  try {
    requireLivemapAppApiKey(request);
    return null;
  } catch (error) {
    if (error instanceof LivemapAppAuthError) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401, headers: livemapNoStoreHeaders },
      );
    }
    if (error instanceof LivemapAppAuthConfigError) {
      return NextResponse.json(
        { error: "server_misconfigured", message: error.message },
        { status: 500, headers: livemapNoStoreHeaders },
      );
    }
    throw error;
  }
}

export function livemapBadRequest(error: unknown): NextResponse {
  const message =
    error instanceof LivemapAppValidationError || error instanceof SyntaxError
      ? error.message
      : "Invalid request";
  return NextResponse.json(
    { error: "bad_request", message },
    { status: 400, headers: livemapNoStoreHeaders },
  );
}
