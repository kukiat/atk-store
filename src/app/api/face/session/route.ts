import { NextRequest, NextResponse } from "next/server";

import {
  AuthenticationRequiredError,
  hasSameOrigin,
  requireCurrentUser,
} from "@/lib/auth";
import { LivenessConfigError } from "@/lib/aws-liveness";
import {
  FaceAlreadyRegisteredError,
  FaceNotRegisteredError,
  LivenessAttemptInProgressError,
  faceEnrollmentService,
} from "@/services/face-enrollment.service";
import type { FaceLivenessIntent } from "@/db/schema";

const noStore = { "Cache-Control": "no-store" } as const;

/**
 * `POST /api/face/session` body: optional `{ intent: "enrollment" | "verification" }`
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

  const body = (await request.json().catch(() => null)) as {
    intent?: unknown;
  } | null;
  const intent = parseIntent(body?.intent);
  if (!intent) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    const { sessionId } = await faceEnrollmentService.createOrReuseAttempt(
      userId,
      intent,
    );
    return NextResponse.json({ sessionId, intent }, { headers: noStore });
  } catch (error) {
    if (error instanceof FaceAlreadyRegisteredError) {
      return NextResponse.json(
        { error: "already_registered" },
        { status: 409, headers: noStore },
      );
    }
    if (error instanceof FaceNotRegisteredError) {
      return NextResponse.json(
        { error: "face_not_registered" },
        { status: 409, headers: noStore },
      );
    }
    if (error instanceof LivenessAttemptInProgressError) {
      return NextResponse.json(
        { error: "attempt_in_progress" },
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

function parseIntent(value: unknown): FaceLivenessIntent | null {
  if (value === undefined || value === null) return "enrollment";
  if (value === "enrollment" || value === "verification") return value;
  return null;
}
