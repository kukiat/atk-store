import { NextRequest, NextResponse } from "next/server";

import { AuthenticationRequiredError, requireCurrentUser } from "@/lib/auth";
import { GOOGLE_ID_TOKEN_COOKIE } from "@/lib/auth-shared";
import { getFaceTokenStatus } from "@/lib/face-token";

const noStore = { "Cache-Control": "no-store" } as const;

/**
 * Cheap preflight for camera flows. Because the Google ID token cookie is
 * path-scoped to /api/face, Server Components on `/` cannot see it. This route
 * lets the Home page and camera pages detect "please sign in again" before
 * creating a Rekognition liveness session or opening the detector.
 *
 * No AWS APIs are called here.
 */
export async function GET(request: NextRequest) {
  try {
    await requireCurrentUser();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { ready: false, reason: "unauthorized" },
        { status: 401, headers: noStore },
      );
    }
    throw error;
  }

  const tokenStatus = getFaceTokenStatus(
    request.cookies.get(GOOGLE_ID_TOKEN_COOKIE)?.value,
  );

  if (!tokenStatus.ready) {
    return NextResponse.json(tokenStatus, {
      status: 409,
      headers: noStore,
    });
  }

  return NextResponse.json(tokenStatus, { headers: noStore });
}
