import "server-only";

import {
  GetCredentialsForIdentityCommand,
  GetIdCommand,
} from "@aws-sdk/client-cognito-identity";
import {
  CreateFaceLivenessSessionCommand,
  GetFaceLivenessSessionResultsCommand,
} from "@aws-sdk/client-rekognition";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  type FaceLivenessAttempt,
  type FaceLivenessIntent,
  faceLivenessAttempts,
  users,
} from "@/db/schema";
import {
  getCognitoIdentityClient,
  getLivenessConfig,
  getRekognitionClient,
  GOOGLE_LOGINS_KEY,
} from "@/lib/aws-liveness";
import { createOpaqueToken } from "@/lib/auth-tokens";
import {
  attemptStatusForOutcome,
  decideLivenessOutcome,
  isAttemptReusable,
  type LivenessDecision,
  type RekognitionLivenessStatus,
} from "@/lib/liveness-state";
import {
  FaceAlreadyBelongsToAnotherUserError,
  FaceCouldNotBeIndexedError,
  FaceReferenceImageMissingError,
  faceRecognitionService,
  type FaceRegistrationResult,
} from "@/services/face-recognition.service";

export class FaceAlreadyRegisteredError extends Error {
  constructor() {
    super("Face is already registered for this user");
    this.name = "FaceAlreadyRegisteredError";
  }
}

export class FaceNotRegisteredError extends Error {
  constructor() {
    super("Face is not registered for this user");
    this.name = "FaceNotRegisteredError";
  }
}

export class LivenessAttemptInProgressError extends Error {
  constructor() {
    super("A different liveness attempt is already in progress");
    this.name = "LivenessAttemptInProgressError";
  }
}

export class LivenessAttemptNotFoundError extends Error {
  constructor() {
    super("Liveness attempt not found for this user");
    this.name = "LivenessAttemptNotFoundError";
  }
}

/** Raised when the Google ID token is missing/expired and must be refreshed. */
export class CredentialBridgeError extends Error {
  constructor(message = "Could not obtain detector credentials") {
    super(message);
    this.name = "CredentialBridgeError";
  }
}

/** Short-lived AWS credentials returned to the browser detector. */
export type DetectorCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration?: string;
};

export type FaceAttemptResult = LivenessDecision & {
  reason?:
    | "face_already_registered"
    | "face_not_indexed"
    | "face_mismatch"
    | "face_not_registered";
  recognition?: {
    outcome: "registered" | "verified" | "mismatch";
    faceId?: string;
    matchedUserId?: number | null;
    similarity?: number | null;
    source?: FaceRegistrationResult["source"];
  };
};

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

/**
 * Face-enrollment business logic. Keeps every privileged or costly decision on
 * the server: it creates at most one live attempt per user, never polls
 * Rekognition, and only marks a user registered after liveness passes and a
 * Rekognition face profile is indexed.
 */
class FaceEnrollmentService {
  /**
   * Exchange a verified Google ID token for temporary, detector-scoped AWS
   * credentials via the Cognito Identity Pool. The Logins token (not the
   * caller) determines the returned identity, so no long-lived key is exposed.
   */
  async getDetectorCredentials(
    googleIdToken: string,
  ): Promise<DetectorCredentials> {
    const { identityPoolId } = getLivenessConfig();
    const client = getCognitoIdentityClient();
    const Logins = { [GOOGLE_LOGINS_KEY]: googleIdToken };

    try {
      const { IdentityId } = await client.send(
        new GetIdCommand({ IdentityPoolId: identityPoolId, Logins }),
      );
      if (!IdentityId) throw new CredentialBridgeError();

      const { Credentials } = await client.send(
        new GetCredentialsForIdentityCommand({ IdentityId, Logins }),
      );

      if (
        !Credentials?.AccessKeyId ||
        !Credentials.SecretKey ||
        !Credentials.SessionToken
      ) {
        throw new CredentialBridgeError();
      }

      return {
        accessKeyId: Credentials.AccessKeyId,
        secretAccessKey: Credentials.SecretKey,
        sessionToken: Credentials.SessionToken,
        expiration: Credentials.Expiration?.toISOString(),
      };
    } catch (error) {
      if (error instanceof CredentialBridgeError) throw error;
      // NotAuthorizedException / ResourceNotFoundException / expired token, etc.
      throw new CredentialBridgeError();
    }
  }

  /**
   * Create a new liveness session, or idempotently reuse the user's current
   * in-flight attempt. Returns the Rekognition `sessionId` for the browser.
   */
  async createOrReuseAttempt(
    userId: number,
    intent: FaceLivenessIntent = "enrollment",
  ): Promise<{ sessionId: string; reused: boolean }> {
    const [user] = await db
      .select({ status: users.faceEnrollmentStatus })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw new LivenessAttemptNotFoundError();
    if (intent === "enrollment" && user.status === "registered") {
      throw new FaceAlreadyRegisteredError();
    }
    if (intent === "verification" && user.status !== "registered") {
      throw new FaceNotRegisteredError();
    }

    const now = new Date();
    const [existing] = await db
      .select()
      .from(faceLivenessAttempts)
      .where(
        and(
          eq(faceLivenessAttempts.userId, userId),
          eq(faceLivenessAttempts.status, "pending"),
        ),
      )
      .orderBy(desc(faceLivenessAttempts.createdAt))
      .limit(1);

    if (existing) {
      if (isAttemptReusable(existing, now) && existing.intent === intent) {
        return { sessionId: existing.sessionId, reused: true };
      }
      if (isAttemptReusable(existing, now)) {
        throw new LivenessAttemptInProgressError();
      }
      // Stale in-flight attempt: retire it so the active-attempt index frees up.
      await db
        .update(faceLivenessAttempts)
        .set({ status: "expired", updatedAt: now })
        .where(eq(faceLivenessAttempts.id, existing.id));
    }

    const config = getLivenessConfig();
    const clientRequestToken = createOpaqueToken();

    const { SessionId } = await getRekognitionClient().send(
      new CreateFaceLivenessSessionCommand({
        ClientRequestToken: clientRequestToken,
        Settings: {
          OutputConfig: {
            S3Bucket: config.outputBucket,
            S3KeyPrefix: config.outputPrefix || undefined,
          },
          AuditImagesLimit: config.auditImagesLimit,
        },
      }),
    );

    if (!SessionId) {
      throw new Error("Rekognition did not return a session id");
    }

    const expiresAt = new Date(now.getTime() + config.sessionTtlMs);

    try {
      await db.insert(faceLivenessAttempts).values({
        userId,
        sessionId: SessionId,
        clientRequestToken,
        intent,
        status: "pending",
        expiresAt,
      });
    } catch (error) {
      // Another concurrent request won the active-attempt slot; reuse it.
      if (isUniqueViolation(error)) {
        const [winner] = await db
          .select()
          .from(faceLivenessAttempts)
          .where(
            and(
              eq(faceLivenessAttempts.userId, userId),
              eq(faceLivenessAttempts.status, "pending"),
            ),
          )
          .orderBy(desc(faceLivenessAttempts.createdAt))
          .limit(1);
        if (winner) return { sessionId: winner.sessionId, reused: true };
      }
      throw error;
    }

    if (intent === "enrollment") {
      await db
        .update(users)
        .set({ faceEnrollmentStatus: "pending", updatedAt: now })
        .where(eq(users.id, userId));
    }

    return { sessionId: SessionId, reused: false };
  }

  /**
   * Read a single owned liveness result. Calls Rekognition `Get` exactly once
   * per invocation (never polls); terminal attempts return their stored result
   * without any AWS call. Enrollment marks the user registered only after the
   * accepted liveness image is indexed into the Rekognition collection.
   */
  async getAttemptResult(
    userId: number,
    sessionId: string,
  ): Promise<FaceAttemptResult> {
    const [attempt] = await db
      .select()
      .from(faceLivenessAttempts)
      .where(eq(faceLivenessAttempts.sessionId, sessionId))
      .limit(1);

    // Hide existence from non-owners; both cases look like "not found".
    if (!attempt || attempt.userId !== userId) {
      throw new LivenessAttemptNotFoundError();
    }

    if (attempt.status !== "pending") {
      return this.getStoredAttemptResult(attempt);
    }

    const config = getLivenessConfig();
    const result = await getRekognitionClient().send(
      new GetFaceLivenessSessionResultsCommand({ SessionId: sessionId }),
    );

    const decision = decideLivenessOutcome({
      status: (result.Status as RekognitionLivenessStatus) ?? "CREATED",
      confidence: result.Confidence,
      threshold: config.scoreThreshold,
    });

    if (decision.outcome === "pending") {
      return decision;
    }

    const now = new Date();
    const referenceS3Key = result.ReferenceImage?.S3Object?.Name ?? null;
    const terminalStatus = attemptStatusForOutcome(decision.outcome);

    await db
      .update(faceLivenessAttempts)
      .set({
        status: terminalStatus,
        confidence: decision.confidence ?? null,
        referenceS3Key,
        updatedAt: now,
      })
      .where(eq(faceLivenessAttempts.id, attempt.id));

    const terminalAttempt: FaceLivenessAttempt = {
      ...attempt,
      status: terminalStatus,
      confidence: decision.confidence ?? null,
      referenceS3Key,
      updatedAt: now,
    };

    if (decision.outcome === "rejected") {
      if (attempt.intent === "enrollment") {
        await db
          .update(users)
          .set({
            faceEnrollmentStatus: "not_registered",
            faceRegisteredAt: null,
            updatedAt: now,
          })
          .where(eq(users.id, userId));
      }

      return decision;
    }

    return this.completeAcceptedAttempt(terminalAttempt);
  }

  private async getStoredAttemptResult(
    attempt: FaceLivenessAttempt,
  ): Promise<FaceAttemptResult> {
    if (attempt.status !== "succeeded") {
      return {
        outcome: "rejected",
        confidence: attempt.confidence ?? undefined,
      };
    }

    switch (attempt.recognitionOutcome) {
      case "registered":
        return {
          outcome: "accepted",
          confidence: attempt.confidence ?? undefined,
          recognition: {
            outcome: "registered",
            faceId: attempt.matchedFaceId ?? undefined,
            matchedUserId: attempt.matchedUserId,
            similarity: attempt.faceSimilarity,
          },
        };
      case "verified":
        return {
          outcome: "accepted",
          confidence: attempt.confidence ?? undefined,
          recognition: {
            outcome: "verified",
            faceId: attempt.matchedFaceId ?? undefined,
            matchedUserId: attempt.matchedUserId,
            similarity: attempt.faceSimilarity,
          },
        };
      case "duplicate":
        return {
          outcome: "rejected",
          confidence: attempt.confidence ?? undefined,
          reason: "face_already_registered",
        };
      case "not_indexed":
        return {
          outcome: "rejected",
          confidence: attempt.confidence ?? undefined,
          reason: "face_not_indexed",
        };
      case "mismatch":
        return {
          outcome: "rejected",
          confidence: attempt.confidence ?? undefined,
          reason: "face_mismatch",
          recognition: {
            outcome: "mismatch",
            faceId: attempt.matchedFaceId ?? undefined,
            matchedUserId: attempt.matchedUserId,
            similarity: attempt.faceSimilarity,
          },
        };
      default:
        // Recover from a previous request that stored the terminal liveness
        // result but crashed before writing recognition metadata.
        return this.completeAcceptedAttempt(attempt);
    }
  }

  private async completeAcceptedAttempt(
    attempt: FaceLivenessAttempt,
  ): Promise<FaceAttemptResult> {
    if (attempt.intent === "verification") {
      return this.completeVerificationAttempt(attempt);
    }

    return this.completeEnrollmentAttempt(attempt);
  }

  private async completeEnrollmentAttempt(
    attempt: FaceLivenessAttempt,
  ): Promise<FaceAttemptResult> {
    try {
      const registration =
        await faceRecognitionService.registerFaceFromAttempt(attempt);
      const now = new Date();

      await db
        .update(faceLivenessAttempts)
        .set({
          recognitionOutcome: "registered",
          matchedFaceId: registration.profile.faceId,
          matchedUserId: attempt.userId,
          faceSimilarity: registration.similarity ?? null,
          updatedAt: now,
        })
        .where(eq(faceLivenessAttempts.id, attempt.id));

      await db
        .update(users)
        .set({
          faceEnrollmentStatus: "registered",
          faceRegisteredAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, attempt.userId));

      return {
        outcome: "accepted",
        confidence: attempt.confidence ?? undefined,
        recognition: {
          outcome: "registered",
          faceId: registration.profile.faceId,
          matchedUserId: attempt.userId,
          similarity: registration.similarity ?? null,
          source: registration.source,
        },
      };
    } catch (error) {
      if (error instanceof FaceAlreadyBelongsToAnotherUserError) {
        return this.rejectRecognizedAttempt(attempt, "duplicate");
      }
      if (
        error instanceof FaceCouldNotBeIndexedError ||
        error instanceof FaceReferenceImageMissingError
      ) {
        return this.rejectRecognizedAttempt(attempt, "not_indexed");
      }
      throw error;
    }
  }

  private async completeVerificationAttempt(
    attempt: FaceLivenessAttempt,
  ): Promise<FaceAttemptResult> {
    const verification = await faceRecognitionService.verifyFaceFromAttempt(
      attempt.userId,
      attempt,
    );
    const now = new Date();

    await db
      .update(faceLivenessAttempts)
      .set({
        recognitionOutcome: verification.outcome,
        matchedFaceId: verification.matchedFaceId,
        matchedUserId: verification.matchedUserId,
        faceSimilarity: verification.similarity,
        updatedAt: now,
      })
      .where(eq(faceLivenessAttempts.id, attempt.id));

    return {
      outcome: verification.outcome === "verified" ? "accepted" : "rejected",
      confidence: attempt.confidence ?? undefined,
      reason: verification.outcome === "verified" ? undefined : "face_mismatch",
      recognition: {
        outcome: verification.outcome,
        faceId: verification.matchedFaceId ?? undefined,
        matchedUserId: verification.matchedUserId,
        similarity: verification.similarity,
      },
    };
  }

  private async rejectRecognizedAttempt(
    attempt: FaceLivenessAttempt,
    outcome: "duplicate" | "not_indexed",
  ): Promise<FaceAttemptResult> {
    const now = new Date();

    await db
      .update(faceLivenessAttempts)
      .set({
        recognitionOutcome: outcome,
        updatedAt: now,
      })
      .where(eq(faceLivenessAttempts.id, attempt.id));

    await db
      .update(users)
      .set({
        faceEnrollmentStatus: "not_registered",
        faceRegisteredAt: null,
        updatedAt: now,
      })
      .where(eq(users.id, attempt.userId));

    return {
      outcome: "rejected",
      confidence: attempt.confidence ?? undefined,
      reason:
        outcome === "duplicate"
          ? "face_already_registered"
          : "face_not_indexed",
    };
  }
}

export const faceEnrollmentService = new FaceEnrollmentService();
