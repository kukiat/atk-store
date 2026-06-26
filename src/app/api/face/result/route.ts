import { NextRequest, NextResponse } from "next/server";

import {
  AuthenticationRequiredError,
  hasSameOrigin,
  requireCurrentUser,
} from "@/lib/auth";
import { FaceRecognitionConfigError } from "@/lib/aws-face-recognition";
import { LivenessConfigError } from "@/lib/aws-liveness";
import {
  faceEnrollmentService,
  LivenessAttemptNotFoundError,
} from "@/services/face-enrollment.service";

const noStore = { "Cache-Control": "no-store" } as const;

/**
 * `POST /api/face/result`  body: `{ sessionId }`
 * Reads one owned liveness result (Rekognition `Get` is called at most once per
 * request; this endpoint never polls). Returns `{ outcome, confidence?,
 * reason?, recognition? }`.
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

  const body = (await request.json().catch(() => null)) as {
    sessionId?: unknown;
  } | null;
  const sessionId = body?.sessionId;
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    const decision = await faceEnrollmentService.getAttemptResult(
      userId,
      sessionId,
    );
    return NextResponse.json(
      {
        outcome: decision.outcome,
        confidence: decision.confidence,
        reason: decision.reason,
        recognition: decision.recognition,
      },
      { headers: noStore },
    );
  } catch (error) {
    if (error instanceof LivenessAttemptNotFoundError) {
      return NextResponse.json(
        { error: "not_found" },
        { status: 404, headers: noStore },
      );
    }
    if (
      error instanceof LivenessConfigError ||
      error instanceof FaceRecognitionConfigError
    ) {
      console.error("[face/result] face auth/recognition is misconfigured");
      return NextResponse.json(
        { error: "misconfigured" },
        { status: 500, headers: noStore },
      );
    }
    console.error("[face/result] could not read liveness result");
    return NextResponse.json(
      { error: "result_failed" },
      { status: 500, headers: noStore },
    );
  }
}
