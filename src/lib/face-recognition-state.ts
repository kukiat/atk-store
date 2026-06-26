import type { FaceRecognitionOutcome } from "@/db/schema";

/**
 * Pure face-recognition helpers. The AWS service returns raw matches; these
 * helpers keep app-specific naming and decision rules unit-testable.
 */

export type FaceMatchDecision = {
  outcome: Extract<FaceRecognitionOutcome, "verified" | "mismatch">;
  matchedUserId: number | null;
  matchedFaceId: string | null;
  similarity: number | null;
};

export function createExternalImageId(userId: number): string {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("userId must be a positive integer");
  }

  // Keep this free of email/PII. Rekognition accepts app-defined IDs; this one
  // is stable, URL-safe, and enough to correlate AWS metadata with our DB.
  return `atk-store-user-${userId}`;
}

export function decideFaceVerification(input: {
  expectedUserId: number;
  matchedUserId: number | null;
  matchedFaceId: string | null;
  similarity: number | null;
  threshold: number;
}): FaceMatchDecision {
  const {
    expectedUserId,
    matchedUserId,
    matchedFaceId,
    similarity,
    threshold,
  } = input;

  const verified =
    matchedUserId === expectedUserId &&
    matchedFaceId !== null &&
    typeof similarity === "number" &&
    similarity >= threshold;

  return {
    outcome: verified ? "verified" : "mismatch",
    matchedUserId,
    matchedFaceId,
    similarity,
  };
}
