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
import { faceLivenessAttempts, users } from "@/db/schema";
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
  enrollmentStatusForOutcome,
  isAttemptReusable,
  type LivenessDecision,
  type RekognitionLivenessStatus,
} from "@/lib/liveness-state";

export class FaceAlreadyRegisteredError extends Error {
  constructor() {
    super("Face is already registered for this user");
    this.name = "FaceAlreadyRegisteredError";
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
 * Rekognition, and only marks a user registered on an accepted backend result.
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
  ): Promise<{ sessionId: string; reused: boolean }> {
    const [user] = await db
      .select({ status: users.faceEnrollmentStatus })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw new LivenessAttemptNotFoundError();
    if (user.status === "registered") throw new FaceAlreadyRegisteredError();

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
      if (isAttemptReusable(existing, now)) {
        return { sessionId: existing.sessionId, reused: true };
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

    await db
      .update(users)
      .set({ faceEnrollmentStatus: "pending", updatedAt: now })
      .where(eq(users.id, userId));

    return { sessionId: SessionId, reused: false };
  }

  /**
   * Read a single owned liveness result. Calls Rekognition `Get` exactly once
   * per invocation (never polls); terminal attempts return their stored result
   * without any AWS call. Marks the user registered only on an accepted result.
   */
  async getAttemptResult(
    userId: number,
    sessionId: string,
  ): Promise<LivenessDecision> {
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
      return {
        outcome: attempt.status === "succeeded" ? "accepted" : "rejected",
        confidence: attempt.confidence ?? undefined,
      };
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

    await db
      .update(faceLivenessAttempts)
      .set({
        status: attemptStatusForOutcome(decision.outcome),
        confidence: decision.confidence ?? null,
        referenceS3Key,
        updatedAt: now,
      })
      .where(eq(faceLivenessAttempts.id, attempt.id));

    await db
      .update(users)
      .set({
        faceEnrollmentStatus: enrollmentStatusForOutcome(decision.outcome),
        faceRegisteredAt: decision.outcome === "accepted" ? now : null,
        updatedAt: now,
      })
      .where(eq(users.id, userId));

    return decision;
  }
}

export const faceEnrollmentService = new FaceEnrollmentService();
