import type { LivenessAttemptStatus } from "@/db/schema";

/**
 * Pure liveness state-machine logic, free of AWS, DB, and `server-only` so it
 * can be unit-tested without network access. The service layer composes these
 * functions; AWS/DB side effects live there, not here.
 */

/** Statuses returned by `GetFaceLivenessSessionResults`. */
export type RekognitionLivenessStatus =
  | "CREATED"
  | "IN_PROGRESS"
  | "SUCCEEDED"
  | "FAILED"
  | "EXPIRED";

/**
 * The decision returned to an owner UI.
 * - `accepted`: liveness succeeded and the score met the threshold.
 * - `rejected`: terminal failure (failed/expired, or below threshold).
 * - `pending`: not finished yet; at most one delayed retry is permitted.
 */
export type LivenessOutcome = "accepted" | "rejected" | "pending";

export type LivenessDecision = {
  outcome: LivenessOutcome;
  confidence?: number;
};

/**
 * Map a Rekognition result to an enrollment decision. The threshold is applied
 * here so the client never decides acceptance.
 */
export function decideLivenessOutcome(input: {
  status: RekognitionLivenessStatus;
  confidence: number | null | undefined;
  threshold: number;
}): LivenessDecision {
  const { status, confidence, threshold } = input;

  if (status === "SUCCEEDED") {
    const score = typeof confidence === "number" ? confidence : 0;
    return {
      outcome: score >= threshold ? "accepted" : "rejected",
      confidence: score,
    };
  }

  if (status === "FAILED" || status === "EXPIRED") {
    return { outcome: "rejected" };
  }

  // CREATED or IN_PROGRESS: not ready. Caller may retry once, never poll.
  return { outcome: "pending" };
}

/**
 * An attempt can be reused (idempotently) only while it is still `pending` and
 * has not passed its session expiry. Terminal or expired attempts force the
 * caller to start a brand-new attempt.
 */
export function isAttemptReusable(
  attempt: { status: LivenessAttemptStatus; expiresAt: Date },
  now: Date = new Date(),
): boolean {
  return (
    attempt.status === "pending" && attempt.expiresAt.getTime() > now.getTime()
  );
}

/**
 * The terminal attempt status implied by a decision. A `pending` outcome leaves
 * the attempt `pending` so its single delayed retry can resolve it.
 */
export function attemptStatusForOutcome(
  outcome: LivenessOutcome,
): LivenessAttemptStatus {
  switch (outcome) {
    case "accepted":
      return "succeeded";
    case "rejected":
      return "failed";
    case "pending":
      return "pending";
  }
}
