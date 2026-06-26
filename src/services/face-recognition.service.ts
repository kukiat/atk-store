import "server-only";

import {
  IndexFacesCommand,
  SearchFacesByImageCommand,
} from "@aws-sdk/client-rekognition";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  type FaceLivenessAttempt,
  type UserFaceProfile,
  userFaceProfiles,
} from "@/db/schema";
import {
  getFaceRecognitionConfig,
  getRekognitionClient,
} from "@/lib/aws-face-recognition";
import { getLivenessConfig } from "@/lib/aws-liveness";
import {
  createExternalImageId,
  decideFaceVerification,
  type FaceMatchDecision,
} from "@/lib/face-recognition-state";

export class FaceReferenceImageMissingError extends Error {
  constructor() {
    super("Accepted liveness attempt has no reference image");
    this.name = "FaceReferenceImageMissingError";
  }
}

export class FaceAlreadyBelongsToAnotherUserError extends Error {
  constructor() {
    super("Face already belongs to another user");
    this.name = "FaceAlreadyBelongsToAnotherUserError";
  }
}

export class FaceCouldNotBeIndexedError extends Error {
  constructor(message = "Rekognition did not index a face") {
    super(message);
    this.name = "FaceCouldNotBeIndexedError";
  }
}

export type FaceRegistrationResult = {
  profile: UserFaceProfile;
  source: "existing_profile" | "matched_profile" | "indexed";
  similarity?: number;
};

export type FaceVerificationResult = FaceMatchDecision;

type SearchMatch = {
  faceId: string;
  imageId?: string;
  similarity: number;
};

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

function isInvalidImageError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: string }).name === "InvalidParameterException"
  );
}

function requireReferenceS3Key(attempt: FaceLivenessAttempt): string {
  if (!attempt.referenceS3Key) throw new FaceReferenceImageMissingError();
  return attempt.referenceS3Key;
}

/**
 * Face recognition business logic. Per Rekognition docs, `IndexFaces` stores
 * AWS-managed facial features in the collection; our DB stores only returned
 * IDs and app ownership metadata.
 */
class FaceRecognitionService {
  async registerFaceFromAttempt(
    attempt: FaceLivenessAttempt,
  ): Promise<FaceRegistrationResult> {
    const referenceS3Key = requireReferenceS3Key(attempt);
    const config = getFaceRecognitionConfig();
    const { outputBucket } = getLivenessConfig();

    const existingProfile = await this.getProfileByUserId(attempt.userId);
    if (existingProfile) {
      return { profile: existingProfile, source: "existing_profile" };
    }

    const existingMatch = await this.searchBestFace(referenceS3Key);
    if (existingMatch) {
      const matchedProfile = await this.getProfileByFaceId(
        existingMatch.faceId,
      );
      if (matchedProfile?.userId === attempt.userId) {
        return {
          profile: matchedProfile,
          source: "matched_profile",
          similarity: existingMatch.similarity,
        };
      }

      // If the collection has a matching face but our DB cannot prove it belongs
      // to this user, fail closed instead of indexing a duplicate face vector.
      throw new FaceAlreadyBelongsToAnotherUserError();
    }

    const externalImageId = createExternalImageId(attempt.userId);
    const { FaceRecords } = await getRekognitionClient().send(
      new IndexFacesCommand({
        CollectionId: config.collectionId,
        Image: {
          S3Object: {
            Bucket: outputBucket,
            Name: referenceS3Key,
          },
        },
        ExternalImageId: externalImageId,
        MaxFaces: 1,
        QualityFilter: config.qualityFilter,
      }),
    );

    const face = FaceRecords?.[0]?.Face;
    if (!face?.FaceId) {
      throw new FaceCouldNotBeIndexedError();
    }

    const now = new Date();
    try {
      const [profile] = await db
        .insert(userFaceProfiles)
        .values({
          userId: attempt.userId,
          collectionId: config.collectionId,
          faceId: face.FaceId,
          imageId: face.ImageId ?? null,
          externalImageId,
          confidence: face.Confidence ?? null,
          referenceS3Key,
          livenessAttemptId: attempt.id,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (!profile) throw new FaceCouldNotBeIndexedError();
      return { profile, source: "indexed" };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const existing = await this.getProfileByUserId(attempt.userId);
        if (existing) return { profile: existing, source: "existing_profile" };
      }
      throw error;
    }
  }

  async verifyFaceFromAttempt(
    expectedUserId: number,
    attempt: FaceLivenessAttempt,
  ): Promise<FaceVerificationResult> {
    const referenceS3Key = requireReferenceS3Key(attempt);
    const config = getFaceRecognitionConfig();
    const match = await this.searchBestFace(referenceS3Key);

    if (!match) {
      return decideFaceVerification({
        expectedUserId,
        matchedUserId: null,
        matchedFaceId: null,
        similarity: null,
        threshold: config.matchThreshold,
      });
    }

    const profile = await this.getProfileByFaceId(match.faceId);
    return decideFaceVerification({
      expectedUserId,
      matchedUserId: profile?.userId ?? null,
      matchedFaceId: match.faceId,
      similarity: match.similarity,
      threshold: config.matchThreshold,
    });
  }

  async getProfileByUserId(userId: number): Promise<UserFaceProfile | null> {
    const [profile] = await db
      .select()
      .from(userFaceProfiles)
      .where(eq(userFaceProfiles.userId, userId))
      .limit(1);

    return profile ?? null;
  }

  private async getProfileByFaceId(
    faceId: string,
  ): Promise<UserFaceProfile | null> {
    const [profile] = await db
      .select()
      .from(userFaceProfiles)
      .where(eq(userFaceProfiles.faceId, faceId))
      .limit(1);

    return profile ?? null;
  }

  private async searchBestFace(
    referenceS3Key: string,
  ): Promise<SearchMatch | null> {
    const config = getFaceRecognitionConfig();
    const { outputBucket } = getLivenessConfig();

    try {
      const { FaceMatches } = await getRekognitionClient().send(
        new SearchFacesByImageCommand({
          CollectionId: config.collectionId,
          Image: {
            S3Object: {
              Bucket: outputBucket,
              Name: referenceS3Key,
            },
          },
          FaceMatchThreshold: config.matchThreshold,
          MaxFaces: 1,
          QualityFilter: config.qualityFilter,
        }),
      );

      const match = FaceMatches?.[0];
      if (!match?.Face?.FaceId || typeof match.Similarity !== "number") {
        return null;
      }

      return {
        faceId: match.Face.FaceId,
        imageId: match.Face.ImageId,
        similarity: match.Similarity,
      };
    } catch (error) {
      if (isInvalidImageError(error)) {
        return null;
      }
      throw error;
    }
  }
}

export const faceRecognitionService = new FaceRecognitionService();
