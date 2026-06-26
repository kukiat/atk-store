import { NextRequest, NextResponse } from "next/server";

import { AuthenticationRequiredError, requireCurrentUser } from "@/lib/auth";
import { GOOGLE_ID_TOKEN_COOKIE } from "@/lib/auth-shared";
import { LivenessConfigError } from "@/lib/aws-liveness";
import { getFaceTokenStatus } from "@/lib/face-token";
import {
  CredentialBridgeError,
  faceEnrollmentService,
} from "@/services/face-enrollment.service";

const noStore = { "Cache-Control": "no-store" } as const;

/**
 * `GET /api/face/credentials`
 * Returns short-lived, `StartFaceLivenessSession`-scoped AWS credentials for the
 * signed-in user's browser detector. Requires a valid app session and a
 * non-expired Google ID token (set at sign-in). 409 signals "sign in again".
 */
export async function GET(request: NextRequest) {
  try {
    await requireCurrentUser();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw error;
  }

  const googleIdToken = request.cookies.get(GOOGLE_ID_TOKEN_COOKIE)?.value;
  if (!googleIdToken || !getFaceTokenStatus(googleIdToken).ready) {
    return NextResponse.json(
      { error: "reauth_required" },
      { status: 409, headers: noStore },
    );
  }

  try {
    const credentials =
      await faceEnrollmentService.getDetectorCredentials(googleIdToken);
    return NextResponse.json(credentials, { headers: noStore });
  } catch (error) {
    if (error instanceof CredentialBridgeError) {
      return NextResponse.json(
        { error: "reauth_required" },
        { status: 409, headers: noStore },
      );
    }
    if (error instanceof LivenessConfigError) {
      console.error("[face/credentials] liveness is misconfigured");
      return NextResponse.json(
        { error: "misconfigured" },
        { status: 500, headers: noStore },
      );
    }
    console.error("[face/credentials] credential bridge failed");
    return NextResponse.json(
      { error: "credentials_failed" },
      { status: 500, headers: noStore },
    );
  }
}
