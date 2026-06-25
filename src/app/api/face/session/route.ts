import { NextRequest, NextResponse } from "next/server";

import {
  AuthenticationRequiredError,
  hasSameOrigin,
  requireCurrentUser,
} from "@/lib/auth";
import { LivenessConfigError } from "@/lib/aws-liveness";
import {
  FaceAlreadyRegisteredError,
  faceEnrollmentService,
} from "@/services/face-enrollment.service";

const noStore = { "Cache-Control": "no-store" } as const;

/**
 * `POST /api/face/session`
 * Creates one Rekognition liveness session, or idempotently reuses the user's
 * in-flight attempt. Same-origin + authenticated only. Returns `{ sessionId }`.
 */
export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "bad_origin" }, { status: 403 });
  }

  let userId: number;
  try {
    userId = (await requireCurrentUser()).id;
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw error;
  }

  try {
    const { sessionId } = await faceEnrollmentService.createOrReuseAttempt(
      userId,
    );
    return NextResponse.json({ sessionId }, { headers: noStore });
  } catch (error) {
    if (error instanceof FaceAlreadyRegisteredError) {
      return NextResponse.json(
        { error: "already_registered" },
        { status: 409, headers: noStore },
      );
    }
    if (error instanceof LivenessConfigError) {
      console.error("[face/session] liveness is misconfigured");
      return NextResponse.json(
        { error: "misconfigured" },
        { status: 500, headers: noStore },
      );
    }
    console.error("[face/session] could not create liveness session");
    return NextResponse.json(
      { error: "session_failed" },
      { status: 500, headers: noStore },
    );
  }
}
